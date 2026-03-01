import { useMemo, useState } from "react";

import { usePracticeStore } from "../store/usePracticeStore";

const focusOptions = [
  "CD",
  "CI",
  "Coordinadas",
  "Subordinadas sustantivas",
  "Subordinadas adjetivas",
  "CReg",
  "Atributo",
  "Pasiva",
];

const topicKey = (value: string) => value.trim().toLowerCase();

interface ControlsPanelProps {
  onGenerateSentence: () => Promise<void>;
}

export function ControlsPanel({ onGenerateSentence }: ControlsPanelProps) {
  const settings = usePracticeStore((state) => state.settings);
  const customFocusTopics = usePracticeStore((state) => state.customFocusTopics);
  const setSetting = usePracticeStore((state) => state.setSetting);
  const setFocusTopics = usePracticeStore((state) => state.setFocusTopics);
  const setCustomFocusTopics = usePracticeStore((state) => state.setCustomFocusTopics);
  const isGenerating = usePracticeStore((state) => state.isGenerating);
  const targetFeatures = usePracticeStore((state) => state.sentenceState.targetFeatures);
  const [customTopic, setCustomTopic] = useState("");

  const selectedFocus = useMemo(
    () => new Set(settings.focusTopics.map((topic) => topicKey(topic))),
    [settings.focusTopics],
  );
  const visibleTopics = useMemo(() => {
    const merged = [...focusOptions];
    customFocusTopics.forEach((topic) => {
      const exists = merged.some((entry) => topicKey(entry) === topicKey(topic));
      if (!exists) {
        merged.push(topic);
      }
    });
    return merged;
  }, [customFocusTopics]);

  const toggleFocusTopic = (topic: string) => {
    const key = topicKey(topic);
    if (selectedFocus.has(key)) {
      setFocusTopics(settings.focusTopics.filter((item) => topicKey(item) !== key));
    } else {
      setFocusTopics([...settings.focusTopics, topic]);
    }
  };

  const addCustomTopic = () => {
    const cleaned = customTopic.trim();
    if (!cleaned) {
      return;
    }
    const existing = visibleTopics.find((topic) => topicKey(topic) === topicKey(cleaned));
    if (existing) {
      if (!selectedFocus.has(topicKey(existing))) {
        setFocusTopics([...settings.focusTopics, existing]);
      }
      setCustomTopic("");
      return;
    }
    setCustomFocusTopics([...customFocusTopics, cleaned]);
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
          <select
            value={settings.difficulty}
            onChange={(event) => setSetting("difficulty", Number(event.target.value) as 1 | 2 | 3)}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
      </div>

      <div className="field">
        <span>Foco sintactico</span>
        <div className="chip-wrap">
          {visibleTopics.map((topic) => (
            <button
              key={topic}
              type="button"
              className={selectedFocus.has(topicKey(topic)) ? "chip active" : "chip"}
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
          Mostrar categoria gramatical sobre palabras
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
          Diseno compacto
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
          <h3>Objetivos de la frase</h3>
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
