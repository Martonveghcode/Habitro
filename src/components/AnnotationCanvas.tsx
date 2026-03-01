import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";

import { TRACK_IDS, usePracticeStore } from "../store/usePracticeStore";

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
      {draftLabel.trim() ? draftLabel : "Etiqueta pendiente"} [{selectedSpan.start}-{selectedSpan.end}]
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
        {annotation.label} (L{annotation.level}) [{annotation.span.start}-{annotation.span.end}]
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

  const laneLabel = laneId.startsWith("lane-") ? `Capa ${laneId.replace("lane-", "")}` : laneId;

  return (
    <div ref={setNodeRef} className={isOver ? "track-lane over" : "track-lane"}>
      <div className="track-title">{laneLabel}</div>
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
  const setDraft = usePracticeStore((state) => state.setAnnotationDraft);
  const addAnnotationToLane = usePracticeStore((state) => state.addAnnotationToLane);
  const moveAnnotation = usePracticeStore((state) => state.moveAnnotation);

  const onDragEnd = (event: DragEndEvent) => {
    if (!event.over) {
      return;
    }
    const targetLane = String(event.over.id);
    if (!TRACK_IDS.includes(targetLane as (typeof TRACK_IDS)[number])) {
      return;
    }

    const activeId = String(event.active.id);
    if (activeId.startsWith("new:") && selectedSpan) {
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

      <div className="annotation-draft">
        <label className="field">
          <span>Etiqueta</span>
          <input
            value={draft.label}
            onChange={(event) => setDraft({ label: event.target.value })}
            placeholder="Ej: CD, CI, Termino, Sujeto..."
          />
        </label>

        <label className="field">
          <span>Tipo</span>
          <select value={draft.kind} onChange={(event) => setDraft({ kind: event.target.value as typeof draft.kind })}>
            <option value="wordFunction">Funcion de palabra</option>
            <option value="groupFunction">Funcion de grupo</option>
            <option value="clause">Proposicion</option>
            <option value="sentenceType">Tipo de oracion</option>
          </select>
        </label>

        <label className="field">
          <span>Nivel</span>
          <select
            value={draft.level}
            onChange={(event) => setDraft({ level: Number(event.target.value) as typeof draft.level })}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </label>
      </div>

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
