import { useEffect, useMemo, useRef, useState } from "react";

import { usePracticeStore } from "../store/usePracticeStore";

const posOptions = [
  "sustantivo",
  "pronombre",
  "verbo",
  "adjetivo",
  "adverbio",
  "determinante",
  "preposicion",
  "conjuncion",
  "interjeccion",
  "otro",
];

export function SentenceWorkspace() {
  const settings = usePracticeStore((state) => state.settings);
  const sentenceState = usePracticeStore((state) => state.sentenceState);
  const selectedSpan = usePracticeStore((state) => state.selectedSpan);
  const setSelectedSpan = usePracticeStore((state) => state.setSelectedSpan);
  const tokenPosAssignments = usePracticeStore((state) => state.tokenPosAssignments);
  const setTokenPos = usePracticeStore((state) => state.setTokenPos);
  const sentenceTypeBuild = usePracticeStore((state) => state.sentenceTypeBuild);
  const setSentenceTypeTags = usePracticeStore((state) => state.setSentenceTypeTags);
  const [sentenceTypeInput, setSentenceTypeInput] = useState("");
  const selectionAnchorRef = useRef<number | null>(null);
  const isPointerSelectingRef = useRef(false);
  const didDragSelectRef = useRef(false);

  const posByToken = useMemo(() => {
    const map = new Map<number, string>();
    tokenPosAssignments.forEach((entry) => map.set(entry.tokenIndex, entry.pos));
    return map;
  }, [tokenPosAssignments]);

  const handleTokenClick = (tokenIndex: number, withExtend: boolean) => {
    if (!selectedSpan) {
      setSelectedSpan({ start: tokenIndex, end: tokenIndex });
      return;
    }

    if (withExtend) {
      setSelectedSpan({
        start: Math.min(selectedSpan.start, tokenIndex),
        end: Math.max(selectedSpan.start, tokenIndex),
      });
      return;
    }

    if (selectedSpan.start === selectedSpan.end && tokenIndex !== selectedSpan.start) {
      setSelectedSpan({
        start: Math.min(selectedSpan.start, tokenIndex),
        end: Math.max(selectedSpan.start, tokenIndex),
      });
      return;
    }

    if (tokenIndex < selectedSpan.start) {
      setSelectedSpan({ start: tokenIndex, end: selectedSpan.end });
      return;
    }

    if (tokenIndex > selectedSpan.end) {
      setSelectedSpan({ start: selectedSpan.start, end: tokenIndex });
      return;
    }

    setSelectedSpan({ start: tokenIndex, end: tokenIndex });
  };

  const handleTokenMouseDown = (tokenIndex: number, withExtend: boolean) => {
    if (withExtend) {
      handleTokenClick(tokenIndex, true);
      return;
    }
    selectionAnchorRef.current = tokenIndex;
    isPointerSelectingRef.current = true;
    didDragSelectRef.current = false;
  };

  const handleTokenMouseEnter = (tokenIndex: number) => {
    if (!isPointerSelectingRef.current || selectionAnchorRef.current === null) {
      return;
    }
    if (selectionAnchorRef.current === tokenIndex) {
      return;
    }
    didDragSelectRef.current = true;
    setSelectedSpan({
      start: Math.min(selectionAnchorRef.current, tokenIndex),
      end: Math.max(selectionAnchorRef.current, tokenIndex),
    });
  };

  const stopPointerSelection = () => {
    isPointerSelectingRef.current = false;
    selectionAnchorRef.current = null;
  };

  useEffect(() => {
    window.addEventListener("mouseup", stopPointerSelection);
    return () => window.removeEventListener("mouseup", stopPointerSelection);
  }, []);

  const addSentenceTypeTag = () => {
    const cleaned = sentenceTypeInput.trim();
    if (!cleaned || sentenceTypeBuild.tags.includes(cleaned)) {
      return;
    }
    setSentenceTypeTags([...sentenceTypeBuild.tags, cleaned]);
    setSentenceTypeInput("");
  };

  const removeSentenceTypeTag = (tag: string) => {
    setSentenceTypeTags(sentenceTypeBuild.tags.filter((entry) => entry !== tag));
  };

  if (!sentenceState.sentence) {
    return (
      <section className="panel workspace-panel">
        <header className="panel-header">
          <h2>Oracion actual</h2>
        </header>
        <p className="muted">Genera una oracion para empezar.</p>
      </section>
    );
  }

  return (
    <section className="panel workspace-panel">
      <header className="panel-header">
        <h2>Oracion actual</h2>
      </header>

      <div className={settings.compactLayout ? "token-grid compact" : "token-grid"}>
        {sentenceState.tokens.map((token) => {
          const isSelected =
            selectedSpan !== null && token.index >= selectedSpan.start && token.index <= selectedSpan.end;
          return (
            <button
              key={`${token.text}_${token.index}`}
              type="button"
              className={isSelected ? "token-chip selected" : "token-chip"}
              onMouseDown={(event) => {
                if (event.button !== 0) {
                  return;
                }
                event.preventDefault();
                handleTokenMouseDown(token.index, event.shiftKey);
              }}
              onMouseEnter={() => handleTokenMouseEnter(token.index)}
              onMouseUp={stopPointerSelection}
              onClick={(event) => {
                if (didDragSelectRef.current) {
                  didDragSelectRef.current = false;
                  return;
                }
                handleTokenClick(token.index, event.shiftKey);
              }}
            >
              {token.text}
            </button>
          );
        })}
      </div>
      <p className="muted">
        Seleccion de tramo: haz clic en una palabra y luego en la palabra final (o usa Shift + clic).
      </p>

      {settings.showPosRow ? (
        <div className="pos-grid">
          {sentenceState.tokens.map((token) => (
            <label key={`pos_${token.index}`} className="pos-cell">
              <span>{token.text}</span>
              <input
                list="pos-options"
                value={posByToken.get(token.index) ?? ""}
                onChange={(event) => setTokenPos(token.index, event.target.value)}
                disabled={token.isPunctuation}
                placeholder={token.isPunctuation ? "signo" : "categoria"}
              />
            </label>
          ))}
          <datalist id="pos-options">
            {posOptions.map((pos) => (
              <option key={pos} value={pos} />
            ))}
          </datalist>
        </div>
      ) : null}

      <div className="sentence-type-builder">
        <h3>Constructor de tipo de oracion</h3>
        <div className="chip-wrap">
          {sentenceTypeBuild.tags.map((tag) => (
            <button key={tag} type="button" className="chip active" onClick={() => removeSentenceTypeTag(tag)}>
              {tag}
            </button>
          ))}
        </div>
        <div className="inline-row">
          <input
            value={sentenceTypeInput}
            onChange={(event) => setSentenceTypeInput(event.target.value)}
            placeholder="Agregar descriptor"
          />
          <button type="button" className="ghost-btn" onClick={addSentenceTypeTag}>
            Anadir
          </button>
        </div>
      </div>
    </section>
  );
}
