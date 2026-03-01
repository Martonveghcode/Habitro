import { useMemo, useState } from "react";

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

  const posByToken = useMemo(() => {
    const map = new Map<number, string>();
    tokenPosAssignments.forEach((entry) => map.set(entry.tokenIndex, entry.pos));
    return map;
  }, [tokenPosAssignments]);

  const handleTokenClick = (tokenIndex: number, withExtend: boolean) => {
    if (!selectedSpan || !withExtend) {
      setSelectedSpan({ start: tokenIndex, end: tokenIndex });
      return;
    }
    setSelectedSpan({
      start: Math.min(selectedSpan.start, tokenIndex),
      end: Math.max(selectedSpan.start, tokenIndex),
    });
  };

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
              onClick={(event) => handleTokenClick(token.index, event.shiftKey)}
            >
              {token.text}
            </button>
          );
        })}
      </div>

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
                placeholder={token.isPunctuation ? "punct" : "POS"}
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
