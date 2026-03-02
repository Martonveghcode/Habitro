import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";

import type { AnnotationKind } from "../types/syntax";
import { TRACK_IDS, usePracticeStore } from "../store/usePracticeStore";

const laneMeta: Record<string, { title: string; kind: AnnotationKind }> = {
  "lane-1": { title: "Nivel 1 - Funcion de palabra", kind: "wordFunction" },
  "lane-2": { title: "Nivel 2 - Funcion de grupo", kind: "groupFunction" },
  "lane-3": { title: "Nivel 3 - Funcion apilada", kind: "groupFunction" },
  "lane-4": { title: "Nivel 4 - Proposicion", kind: "clause" },
  "lane-5": { title: "Nivel 5 - Tipo de oracion", kind: "sentenceType" },
};

const kindLabels: Record<AnnotationKind, string> = {
  wordFunction: "Palabra",
  groupFunction: "Grupo",
  clause: "Proposicion",
  sentenceType: "Tipo oracion",
};

const presetLabelsByKind: Record<AnnotationKind, string[]> = {
  wordFunction: ["NN", "NV", "Nucleo", "Det", "Pron", "Adj", "Adv", "Prep", "Conj"],
  groupFunction: ["CD", "CI", "CC", "CReg", "Atributo", "CPvo", "Termino", "CN", "CAg", "Sujeto", "Predicado"],
  clause: ["Principal", "Coordinada", "Subordinada sustantiva", "Subordinada adjetiva", "Subordinada adverbial"],
  sentenceType: ["Oracion simple", "Oracion compuesta", "Predicativa", "Copulativa", "Activa", "Pasiva"],
};

const kindOrder: AnnotationKind[] = ["wordFunction", "groupFunction", "clause", "sentenceType"];
const kindDefaultLevel: Record<AnnotationKind, 1 | 2 | 3 | 4 | 5> = {
  wordFunction: 1,
  groupFunction: 2,
  clause: 4,
  sentenceType: 5,
};

const normalizeText = (value: string) => value.trim().toLowerCase();

function SelectedSpanDraggable() {
  const selectedSpan = usePracticeStore((state) => state.selectedSpan);
  const draftLabel = usePracticeStore((state) => state.annotationDraft.label);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: selectedSpan ? `new:${selectedSpan.start}:${selectedSpan.end}` : "new:none",
    disabled: !selectedSpan,
  });

  if (!selectedSpan) {
    return <p className="muted">Selecciona un tramo de tokens para crear una anotacion.</p>;
  }

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.65 : 1,
  };

  return (
    <button ref={setNodeRef} style={style} {...listeners} {...attributes} className="drag-pill" type="button">
      {draftLabel.trim() ? draftLabel : "Selecciona etiqueta"} [{selectedSpan.start}-{selectedSpan.end}]
    </button>
  );
}

function AnnotationCard({ annotationId }: { annotationId: string }) {
  const annotation = usePracticeStore((state) => state.annotations.find((item) => item.id === annotationId));
  const deleteAnnotation = usePracticeStore((state) => state.deleteAnnotation);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ann:${annotationId}`,
  });

  if (!annotation) {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.6 : 1,
      }}
      className="annotation-card"
    >
      <button className="annotation-chip" type="button" {...listeners} {...attributes}>
        {annotation.label} [{annotation.span.start}-{annotation.span.end}]
      </button>
      <button className="icon-btn" type="button" onClick={() => deleteAnnotation(annotation.id)}>
        x
      </button>
    </div>
  );
}

function TrackLane({ laneId }: { laneId: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: laneId,
  });

  const allAnnotations = usePracticeStore((state) => state.annotations);
  const annotationIds = useMemo(
    () => allAnnotations.filter((annotation) => annotation.laneId === laneId).map((item) => item.id),
    [allAnnotations, laneId],
  );

  return (
    <div ref={setNodeRef} className={isOver ? "track-lane over" : "track-lane"}>
      <div className="track-title">{laneMeta[laneId]?.title ?? laneId}</div>
      <div className="track-items">
        {annotationIds.length === 0 ? <span className="muted">Arrastra aqui</span> : null}
        {annotationIds.map((annotationId) => (
          <AnnotationCard key={annotationId} annotationId={annotationId} />
        ))}
      </div>
    </div>
  );
}

export function AnnotationCanvas() {
  const selectedSpan = usePracticeStore((state) => state.selectedSpan);
  const draft = usePracticeStore((state) => state.annotationDraft);
  const customAnnotationLabels = usePracticeStore((state) => state.customAnnotationLabels);
  const setDraft = usePracticeStore((state) => state.setAnnotationDraft);
  const addCustomAnnotationLabel = usePracticeStore((state) => state.addCustomAnnotationLabel);
  const addAnnotationToLane = usePracticeStore((state) => state.addAnnotationToLane);
  const moveAnnotation = usePracticeStore((state) => state.moveAnnotation);
  const [labelKind, setLabelKind] = useState<AnnotationKind>("groupFunction");
  const [customLabelInput, setCustomLabelInput] = useState("");

  const availableLabels = useMemo(() => {
    const combined = [...presetLabelsByKind[labelKind], ...customAnnotationLabels[labelKind]];
    const seen = new Set<string>();
    return combined.filter((label) => {
      const key = normalizeText(label);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [customAnnotationLabels, labelKind]);

  const setLabelFromChip = (label: string) => {
    setDraft({
      label,
      kind: labelKind,
      level: kindDefaultLevel[labelKind],
    });
  };

  const addCustomLabel = () => {
    const cleaned = customLabelInput.trim();
    if (!cleaned) {
      return;
    }
    addCustomAnnotationLabel(labelKind, cleaned);
    setLabelFromChip(cleaned);
    setCustomLabelInput("");
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (!event.over) {
      return;
    }
    const targetLane = String(event.over.id);
    if (!TRACK_IDS.includes(targetLane as (typeof TRACK_IDS)[number])) {
      return;
    }

    const laneKind = laneMeta[targetLane]?.kind;
    if (!laneKind) {
      return;
    }

    const activeId = String(event.active.id);
    if (activeId.startsWith("new:") && selectedSpan) {
      if (!draft.label.trim()) {
        return;
      }
      setDraft({
        kind: laneKind,
        level: kindDefaultLevel[laneKind],
      });
      addAnnotationToLane(targetLane);
      return;
    }

    if (activeId.startsWith("ann:")) {
      const annotationId = activeId.replace("ann:", "");
      moveAnnotation(annotationId, targetLane);
    }
  };

  return (
    <section className="panel annotation-panel">
      <header className="panel-header">
        <h2>Capas de anotacion (arrastrar y soltar)</h2>
      </header>

      <div className="field">
        <span>Etiquetas rapidas</span>
        <div className="chip-wrap">
          {kindOrder.map((kind) => (
            <button
              key={kind}
              type="button"
              className={kind === labelKind ? "chip active" : "chip"}
              onClick={() => setLabelKind(kind)}
            >
              {kindLabels[kind]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Selecciona etiqueta</span>
        <div className="chip-wrap">
          {availableLabels.map((label) => (
            <button
              key={`${labelKind}:${label}`}
              type="button"
              className={normalizeText(draft.label) === normalizeText(label) ? "chip active" : "chip"}
              onClick={() => setLabelFromChip(label)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="inline-row">
        <input
          value={customLabelInput}
          onChange={(event) => setCustomLabelInput(event.target.value)}
          placeholder={`Agregar etiqueta personalizada (${kindLabels[labelKind]})`}
        />
        <button type="button" className="ghost-btn" onClick={addCustomLabel}>
          Agregar
        </button>
      </div>

      <p className="muted">
        Flujo: 1) selecciona palabras, 2) elige etiqueta, 3) arrastra el bloque a la linea correcta.
      </p>

      <DndContext onDragEnd={onDragEnd}>
        <div className="drag-source">
          <SelectedSpanDraggable />
        </div>
        <div className="track-grid">
          {TRACK_IDS.map((laneId) => (
            <TrackLane key={laneId} laneId={laneId} />
          ))}
        </div>
      </DndContext>
    </section>
  );
}
