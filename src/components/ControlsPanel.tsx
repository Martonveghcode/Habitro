import { useMemo, useState } from "react";

import { usePracticeStore } from "../store/usePracticeStore";

const focusOptions = [
  "CD",
  "CI",
  "Coordinadas",
  "Subordinadas sustantivas",
  "Subordinadas adjetivas",
  "CRég",
  "Atributo",
  "Pasiva",
];

interface ControlsPanelProps {
  onGenerateSentence: () => Promise<void>;
}

export function ControlsPanel({ onGenerateSentence }: ControlsPanelProps) {
  const settings = usePracticeStore((state) => state.settings);
  const setSetting = usePracticeStore((state) => state.setSetting);
  const setFocusTopics = usePracticeStore((state) => state.setFocusTopics);
  const isGenerating = usePracticeStore((state) => state.isGenerating);
  const targetFeatures = usePracticeStore((state) => state.sentenceState.targetFeatures);
  const [customTopic, setCustomTopic] = useState("");

  const selectedFocus = useMemo(() => new Set(settings.focusTopics), [settings.focusTopics]);

  const toggleFocusTopic = (topic: string) => {
    if (selectedFocus.has(topic)) {
      setFocusTopics(settings.focusTopics.filter((item) => item !== topic));
    } else {
      setFocusTopics([...settings.focusTopics, topic]);
    }
  };

  const addCustomTopic = () => {
    const cleaned = customTopic.trim();
    if (!cleaned || selectedFocus.has(cleaned)) {
      return;
    }
    setFocusTopics([...settings.focusTopics, cleaned]);
    setCustomTopic("");
  };

  return (
    <section className="panel controls-panel">
      <header className="panel-header">
        <h2>Control de practica</h2>
      </header>

      <div className="field-grid">
        <label className="field">
          <span>Tipo de oracion</span>
          <select
            value={settings.sentenceType}
            onChange={(event) => setSetting("sentenceType", event.target.value as "simple" | "compuesta")}
          >
            <option value="simple">Simple</option>
            <option value="compuesta">Compuesta</option>
          </select>
        </label>

        <label className="field">
          <span>Dificultad</span>
          <select value={settings.difficulty} onChange={(event) => setSetting("difficulty", Number(event.target.value) as 1 | 2 | 3)}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
      </div>

      <div className="field">
        <span>Foco sintactico</span>
        <div className="chip-wrap">
          {focusOptions.map((topic) => (
            <button
              key={topic}
              type="button"
              className={selectedFocus.has(topic) ? "chip active" : "chip"}
              onClick={() => toggleFocusTopic(topic)}
            >
              {topic}
            </button>
          ))}
        </div>
        <div className="inline-row">
          <input
            value={customTopic}
            onChange={(event) => setCustomTopic(event.target.value)}
            placeholder="Agregar foco personalizado"
          />
          <button type="button" className="ghost-btn" onClick={addCustomTopic}>
            Agregar
          </button>
        </div>
      </div>

      <div className="toggle-grid">
        <label>
          <input
            type="checkbox"
            checked={settings.showPosRow}
            onChange={(event) => setSetting("showPosRow", event.target.checked)}
          />
          Mostrar POS sobre palabras
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.simplifyPunctuation}
            onChange={(event) => setSetting("simplifyPunctuation", event.target.checked)}
          />
          Simplificar puntuacion
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.compactLayout}
            onChange={(event) => setSetting("compactLayout", event.target.checked)}
          />
          Layout compacto
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.personalizedMode}
            onChange={(event) => setSetting("personalizedMode", event.target.checked)}
          />
          Modo personalizado
        </label>
      </div>

      <button type="button" className="primary-btn" onClick={onGenerateSentence} disabled={isGenerating}>
        {isGenerating ? "Generando..." : "Generar oracion"}
      </button>

      {targetFeatures.length > 0 ? (
        <div className="target-features">
          <h3>Features objetivo</h3>
          <ul>
            {targetFeatures.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
