import { useEffect, useMemo, useState } from "react";

import {
  MODEL_OPTIONS,
  MORFO_MORPHEME_TYPES,
  MORFO_WORD_TYPES,
  SE_FUNCTIONS,
  SE_VALUES,
} from "./data";
import {
  chooseMorfoTarget,
  chooseSeTarget,
  createId,
  evaluateMorfoGuess,
  evaluateSeGuess,
  fallbackMorfoBatch,
  fallbackSeBatch,
  fetchRecentMorfoLabels,
  fetchRecentMorfoWords,
  fetchRecentSeLabels,
  fetchRecentSeSentences,
  loadStorageState,
  makeMorfoAttempt,
  makeSeAttempt,
  morfoLearningProfile,
  popMixTargeted,
  resetMorfoAttempts,
  resetSeAttempts,
  saveStorageState,
  seAccuracy,
  seLearningProfile,
} from "./logic";
import {
  requestMorfoGeneration,
  requestMorfoQuestion,
  requestMorfoRecheck,
  requestSeGeneration,
  requestSeQuestion,
  requestSeRecheck,
} from "./api";
import type {
  MorfoAttempt,
  MorfoEvaluation,
  MorfoItem,
  MorfoSettings,
  MorfoStrategy,
  QuestionResult,
  RecheckResultMorfo,
  RecheckResultSe,
  SeAttempt,
  SeEvaluation,
  SeItem,
  SeSettings,
  SeStrategy,
  StorageState,
  SummaryRow,
} from "./types";

type SectionName = "se" | "morfologia";
type PageName = "practice" | "history" | "settings";

function cx(...tokens: Array<string | false | null | undefined>): string {
  return tokens.filter(Boolean).join(" ");
}

function ratioLabel(targetWeight: number, normalWeight: number): string {
  const safeTarget = Math.max(0, targetWeight);
  const safeNormal = Math.max(0, normalWeight);
  const total = safeTarget + safeNormal || 100;
  return `${((safeTarget / total) * 100).toFixed(1)}% debilidades / ${((safeNormal / total) * 100).toFixed(1)}% normal`;
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function ChoicePill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={cx("choice-pill", active && "active")} type="button" onClick={onClick}>
      {label}
    </button>
  );
}

function SummaryList({ rows }: { rows: SummaryRow[] }) {
  if (rows.length === 0) {
    return <p className="muted-line">-</p>;
  }
  return (
    <div className="chip-cloud">
      {rows.map((row) => (
        <span className="stat-chip" key={row.label}>
          {row.label}
          <strong>{Math.round(row.failRate * 100)}%</strong>
        </span>
      ))}
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  if (rows.length === 0) {
    return <p className="muted-line">Sin datos todavia.</p>;
  }
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MultiToggleList({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="chip-cloud">
      {options.map((option) => (
        <button
          key={option}
          className={cx("choice-pill", selected.includes(option) && "active")}
          type="button"
          onClick={() => onToggle(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function GeminiKeyPanel({
  apiKey,
  onApiKeyChange,
}: {
  apiKey: string;
  onApiKeyChange: (value: string) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const hasSavedKey = apiKey.trim().length > 0;

  return (
    <div className="info-block">
      <p className="panel-kicker">Gemini API Key</p>
      <div className="field-block">
        <FieldLabel
          label="Clave local del navegador"
          hint="Se guarda automaticamente solo en este navegador y se envia solo a /api/ai cuando pides ayuda a Gemini."
        />
        <input
          autoComplete="off"
          className="mono-input"
          placeholder="AIza..."
          spellCheck={false}
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(event) => onApiKeyChange(event.target.value)}
        />
      </div>

      <div className="button-row">
        <button className="ghost-btn" type="button" onClick={() => setShowKey((current) => !current)}>
          {showKey ? "Ocultar clave" : "Mostrar clave"}
        </button>
        <button className="ghost-btn" disabled={!hasSavedKey} type="button" onClick={() => onApiKeyChange("")}>
          Borrar clave
        </button>
      </div>

      <p className="muted-line">
        {hasSavedKey
          ? "Clave local guardada. Tiene prioridad sobre la configuracion del sitio en Netlify para este navegador."
          : "Sin clave local. Pega una aqui para activar Gemini sin tocar variables de entorno en Netlify."}
      </p>
    </div>
  );
}

function shuffleList<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = current;
  }
  return next;
}

export function NetlifyPracticeApp() {
  const [storageState, setStorageState] = useState<StorageState>(() => loadStorageState());
  const [activeSection, setActiveSection] = useState<SectionName>("se");
  const [sePage, setSePage] = useState<PageName>("practice");
  const [morfoPage, setMorfoPage] = useState<PageName>("practice");
  const hasLocalApiKey = storageState.geminiApiKey.trim().length > 0;

  useEffect(() => {
    saveStorageState(storageState);
  }, [storageState]);

  const updateSeSettings = (next: SeSettings) => {
    setStorageState((current) => ({ ...current, seSettings: next }));
  };

  const updateMorfoSettings = (next: MorfoSettings) => {
    setStorageState((current) => ({ ...current, morfoSettings: next }));
  };

  const updateSeAttempts = (next: SeAttempt[]) => {
    setStorageState((current) => ({ ...current, seAttempts: next }));
  };

  const updateMorfoAttempts = (next: MorfoAttempt[]) => {
    setStorageState((current) => ({ ...current, morfoAttempts: next }));
  };

  const updateGeminiApiKey = (next: string) => {
    setStorageState((current) => ({ ...current, geminiApiKey: next }));
  };

  const currentPage = activeSection === "se" ? sePage : morfoPage;

  return (
    <div className="practice-shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="eyebrow">Netlify Edition</p>
          <h1>Sintaxis + Morfologia</h1>
          <p className="muted-line">
            Reescritura del Streamlit original para hosting estatico con funciones serverless.
          </p>
        </div>

        <div className="panel side-panel">
          <p className="panel-kicker">Seccion</p>
          <div className="stack">
            <ChoicePill active={activeSection === "se"} label="Valores del se" onClick={() => setActiveSection("se")} />
            <ChoicePill
              active={activeSection === "morfologia"}
              label="Morfologia"
              onClick={() => setActiveSection("morfologia")}
            />
          </div>
        </div>

        <div className="panel side-panel">
          <p className="panel-kicker">Pagina</p>
          <div className="stack">
            <ChoicePill
              active={currentPage === "practice"}
              label="Practicar"
              onClick={() => (activeSection === "se" ? setSePage("practice") : setMorfoPage("practice"))}
            />
            <ChoicePill
              active={currentPage === "history"}
              label="Historial"
              onClick={() => (activeSection === "se" ? setSePage("history") : setMorfoPage("history"))}
            />
            <ChoicePill
              active={currentPage === "settings"}
              label="Ajustes"
              onClick={() => (activeSection === "se" ? setSePage("settings") : setMorfoPage("settings"))}
            />
          </div>
        </div>

        <div className="panel side-panel status-panel">
          <p className="panel-kicker">Persistencia</p>
          <p className="muted-line">
            El historial ya no usa SQLite. Se guarda en el navegador actual para que Netlify pueda servir la app como sitio
            estatico.
          </p>
          <p className="muted-line">
            {hasLocalApiKey
              ? "Hay una clave Gemini guardada en este navegador. La app la enviara solo a /api/ai cuando uses generacion, recheck o preguntas."
              : "Puedes pegar una GEMINI_API_KEY en Ajustes. Si no hay clave local ni clave del sitio en Netlify, la app usa el banco local."}
          </p>
        </div>
      </aside>

      <main className="main-stage">
        <SeWorkspace
          active={activeSection === "se"}
          page={sePage}
          settings={storageState.seSettings}
          attempts={storageState.seAttempts}
          apiKey={storageState.geminiApiKey}
          onApiKeyChange={updateGeminiApiKey}
          onSettingsChange={updateSeSettings}
          onAttemptsChange={updateSeAttempts}
        />
        <MorfoWorkspace
          active={activeSection === "morfologia"}
          page={morfoPage}
          settings={storageState.morfoSettings}
          attempts={storageState.morfoAttempts}
          apiKey={storageState.geminiApiKey}
          onApiKeyChange={updateGeminiApiKey}
          onSettingsChange={updateMorfoSettings}
          onAttemptsChange={updateMorfoAttempts}
        />
      </main>
    </div>
  );
}

function SeWorkspace({
  active,
  page,
  settings,
  attempts,
  apiKey,
  onApiKeyChange,
  onSettingsChange,
  onAttemptsChange,
}: {
  active: boolean;
  page: PageName;
  settings: SeSettings;
  attempts: SeAttempt[];
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  onSettingsChange: (settings: SeSettings) => void;
  onAttemptsChange: (attempts: SeAttempt[]) => void;
}) {
  const profile = useMemo(() => seLearningProfile(attempts, settings.profileId), [attempts, settings.profileId]);
  const profileAttempts = useMemo(
    () => attempts.filter((attempt) => attempt.profileId === settings.profileId),
    [attempts, settings.profileId],
  );
  const [currentItem, setCurrentItem] = useState<SeItem | null>(null);
  const [queue, setQueue] = useState<SeItem[]>([]);
  const [checkedItemId, setCheckedItemId] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, SeEvaluation>>({});
  const [rechecks, setRechecks] = useState<Record<string, RecheckResultSe>>({});
  const [answers, setAnswers] = useState<Record<string, QuestionResult>>({});
  const [guessValue, setGuessValue] = useState<string>(SE_VALUES[0]);
  const [guessFunction, setGuessFunction] = useState<string>(SE_FUNCTIONS[0]);
  const [questionInput, setQuestionInput] = useState("");
  const [mixBucket, setMixBucket] = useState<boolean[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [historyOnlyErrors, setHistoryOnlyErrors] = useState(true);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [statusNote, setStatusNote] = useState("Listo para generar lote.");
  const [statusTone, setStatusTone] = useState<"info" | "warn">("info");
  const [profileDraft, setProfileDraft] = useState(settings.profileId);
  const [selectedModelDraft, setSelectedModelDraft] = useState(
    MODEL_OPTIONS.some((option) => option.value === settings.modelName) ? settings.modelName : "custom",
  );
  const [customModelDraft, setCustomModelDraft] = useState(
    MODEL_OPTIONS.some((option) => option.value === settings.modelName) ? "" : settings.modelName,
  );

  const mixText = ratioLabel(settings.targetWeight, settings.normalWeight);
  const weakValueLabels = profile.weakValues.map((row) => row.label);
  const weakFunctionLabels = profile.weakFunctions.map((row) => row.label);
  const visibleAttempts = historyOnlyErrors
    ? profileAttempts.filter((attempt) => !attempt.valueOk || !attempt.functionOk)
    : profileAttempts;

  useEffect(() => {
    setGuessValue(SE_VALUES[0]);
    setGuessFunction(SE_FUNCTIONS[0]);
    setQuestionInput("");
  }, [currentItem?.id]);

  useEffect(() => {
    setProfileDraft(settings.profileId);
    if (MODEL_OPTIONS.some((option) => option.value === settings.modelName)) {
      setSelectedModelDraft(settings.modelName);
      setCustomModelDraft("");
    } else {
      setSelectedModelDraft("custom");
      setCustomModelDraft(settings.modelName);
    }
  }, [settings.profileId, settings.modelName]);

  useEffect(() => {
    setMixBucket([]);
  }, [settings.targetWeight, settings.normalWeight]);

  const toggleFocusValue = (value: string) => {
    const nextFocusValues = settings.focusValues.includes(value)
      ? settings.focusValues.filter((entry) => entry !== value)
      : [...settings.focusValues, value];
    onSettingsChange({ ...settings, focusValues: nextFocusValues });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let nextQueue = [...queue];
      if (nextQueue.length === 0) {
        const batchSize = settings.personalized ? 3 : 10;
        let workingBucket = [...mixBucket];
        const strategies: SeStrategy[] = [];

        for (let index = 0; index < batchSize; index += 1) {
          let forceTargeted: boolean | undefined;
          if (settings.personalized && settings.focusValues.length === 0 && (weakValueLabels.length > 0 || weakFunctionLabels.length > 0)) {
            const [targeted, nextBucket] = popMixTargeted(workingBucket, settings.targetWeight, settings.normalWeight);
            forceTargeted = targeted;
            workingBucket = nextBucket;
          }

          strategies.push(
            chooseSeTarget(profile, settings.focusValues, settings.personalized, forceTargeted, mixText),
          );
        }

        setMixBucket(workingBucket);

        const recentSentences = fetchRecentSeSentences(attempts, settings.profileId, 14);
        const recentLabels = fetchRecentSeLabels(attempts, settings.profileId, 10);
        const fallbackItems = fallbackSeBatch(settings.difficulty, strategies, recentSentences);
        const prepared: SeItem[] = [];
        const seen = new Set<string>();
        const pushCandidate = (candidate: Omit<SeItem, "id"> | SeItem) => {
          const key = candidate.sentence.trim().toLowerCase();
          if (!key || seen.has(key) || prepared.length >= batchSize) {
            return;
          }
          seen.add(key);
          prepared.push("id" in candidate ? candidate : { ...candidate, id: createId("se") });
        };

        try {
          const remoteItems = await requestSeGeneration({
            apiKey,
            modelName: settings.modelName,
            difficulty: settings.difficulty,
            strategies,
            profile,
            recentSentences,
            recentLabels,
          });
          remoteItems.forEach(pushCandidate);
          fallbackItems.forEach(pushCandidate);
          setStatusNote(remoteItems.length > 0 ? "Lote servido por Gemini con relleno local de seguridad." : "Gemini no devolvio items validos. Modo local activado.");
          setStatusTone(remoteItems.length > 0 ? "info" : "warn");
        } catch (error) {
          fallbackItems.forEach(pushCandidate);
          setStatusNote(error instanceof Error ? `${error.message} Se uso el banco local.` : "Fallo de Gemini. Se uso el banco local.");
          setStatusTone("warn");
        }

        while (prepared.length < batchSize) {
          const extraFallback = fallbackSeBatch(settings.difficulty, strategies, recentSentences);
          const beforeLength = prepared.length;
          extraFallback.forEach(pushCandidate);
          if (prepared.length === beforeLength) {
            break;
          }
        }

        nextQueue = settings.personalized ? prepared : shuffleList(prepared);
      }

      const [nextItem, ...rest] = nextQueue;
      setCurrentItem(nextItem ?? null);
      setQueue(rest);
      setCheckedItemId(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCheck = () => {
    if (!currentItem) {
      return;
    }
    const evaluation = evaluateSeGuess(currentItem, guessValue, guessFunction);
    setEvaluations((current) => ({ ...current, [currentItem.id]: evaluation }));

    if (checkedItemId !== currentItem.id) {
      onAttemptsChange([...attempts, makeSeAttempt(currentItem, settings, evaluation)]);
      setCheckedItemId(currentItem.id);
    }
  };

  const handleRecheck = async () => {
    if (!currentItem) {
      return;
    }
    setIsRechecking(true);
    try {
      const result = await requestSeRecheck({
        apiKey,
        modelName: settings.modelName,
        sentence: currentItem.sentence,
        seValue: currentItem.seValue,
        seFunction: currentItem.seFunction,
        acceptedFunctions: currentItem.acceptedFunctions,
        phraseType: currentItem.phraseType,
        explanation: currentItem.explanation,
      });
      setRechecks((current) => ({ ...current, [currentItem.id]: result }));
    } catch (error) {
      setRechecks((current) => ({
        ...current,
        [currentItem.id]: {
          success: true,
          model: "modo local",
          isCorrect: true,
          correctedValue: currentItem.seValue,
          correctedFunction: currentItem.seFunction,
          issues: [],
          correctionNote:
            error instanceof Error
              ? `${error.message} Se confirma la respuesta del banco local.`
              : "Sin acceso a Gemini. Se confirma la respuesta del banco local.",
        },
      }));
    } finally {
      setIsRechecking(false);
    }
  };

  const handleAsk = async () => {
    if (!currentItem || !questionInput.trim()) {
      return;
    }
    setIsAsking(true);
    try {
      const result = await requestSeQuestion({
        apiKey,
        modelName: settings.modelName,
        item: {
          sentence: currentItem.sentence,
          seValue: currentItem.seValue,
          seFunction: currentItem.seFunction,
          phraseType: currentItem.phraseType,
          explanation: currentItem.explanation,
        },
        question: questionInput.trim(),
        recheckResult: rechecks[currentItem.id],
      });
      setAnswers((current) => ({ ...current, [currentItem.id]: result }));
    } catch (error) {
      setAnswers((current) => ({
        ...current,
        [currentItem.id]: {
          success: true,
          model: "modo local",
          answer:
            `Modo local: ${currentItem.explanation}\n\nTipo de oracion: ${currentItem.phraseType}.\n\n` +
            (error instanceof Error
              ? `${error.message} Pega una GEMINI_API_KEY valida en Ajustes si quieres respuestas desarrolladas.`
              : "Pega una GEMINI_API_KEY valida en Ajustes si quieres respuestas desarrolladas."),
        },
      }));
    } finally {
      setIsAsking(false);
    }
  };

  const saveSettingsDraft = () => {
    const resolvedModel = selectedModelDraft === "custom" ? customModelDraft.trim() || MODEL_OPTIONS[0].value : selectedModelDraft;
    onSettingsChange({
      ...settings,
      profileId: profileDraft.trim() || "alumno",
      modelName: resolvedModel,
    });
  };

  const evaluation = currentItem ? evaluations[currentItem.id] : null;
  const recheck = currentItem ? rechecks[currentItem.id] : null;
  const answer = currentItem ? answers[currentItem.id] : null;

  return (
    <section className={cx("workspace", !active && "hidden-workspace")}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Valores del se</p>
          <h2>Practica guiada</h2>
        </div>
        <div className="meta-strip">
          <span>Perfil: {settings.profileId}</span>
          <span>Modelo: {settings.modelName}</span>
          <span>Intentos: {profile.totalAttempts}</span>
        </div>
      </header>

      {page === "practice" ? (
        <div className="page-grid">
          <div className="panel control-panel">
            <p className="panel-kicker">Configuracion</p>
            <div className="field-block">
              <FieldLabel label="Dificultad" hint="Se mantiene por seccion." />
              <div className="chip-cloud">
                {[1, 2, 3].map((difficulty) => (
                  <ChoicePill
                    key={difficulty}
                    active={settings.difficulty === difficulty}
                    label={`D${difficulty}`}
                    onClick={() => onSettingsChange({ ...settings, difficulty: difficulty as 1 | 2 | 3 })}
                  />
                ))}
              </div>
            </div>

            <div className="field-block">
              <FieldLabel label="Modo" hint="Usa refuerzo de debilidades cuando hay historial." />
              <label className="checkbox-line">
                <input
                  checked={settings.personalized}
                  onChange={(event) => onSettingsChange({ ...settings, personalized: event.target.checked })}
                  type="checkbox"
                />
                <span>Personalizado</span>
              </label>
            </div>

            <div className="field-block">
              <FieldLabel label="Foco manual" hint="Selecciona uno o varios valores para forzar el lote." />
              <MultiToggleList options={SE_VALUES} selected={settings.focusValues} onToggle={toggleFocusValue} />
            </div>

            <div className="field-grid compact-grid">
              <div>
                <FieldLabel label="Peso debilidades" />
                <input
                  max={100}
                  min={0}
                  step={5}
                  type="number"
                  value={settings.targetWeight}
                  onChange={(event) => onSettingsChange({ ...settings, targetWeight: Number(event.target.value) || 0 })}
                />
              </div>
              <div>
                <FieldLabel label="Peso normal" />
                <input
                  max={100}
                  min={0}
                  step={5}
                  type="number"
                  value={settings.normalWeight}
                  onChange={(event) => onSettingsChange({ ...settings, normalWeight: Number(event.target.value) || 0 })}
                />
              </div>
            </div>

            <p className="muted-line">Mezcla actual: {mixText}</p>

            <div className={cx("inline-banner", statusTone === "warn" && "warn")}>{statusNote}</div>

            <button className="primary-btn" disabled={isGenerating} type="button" onClick={handleGenerate}>
              {isGenerating ? "Preparando lote..." : queue.length > 0 ? "Siguiente frase" : "Generar lote"}
            </button>

            {settings.personalized && (weakValueLabels.length > 0 || weakFunctionLabels.length > 0) ? (
              <div className="info-block">
                <p className="panel-kicker">Refuerzo activo</p>
                <p className="muted-line">
                  Valores: {weakValueLabels.join(", ") || "-"}
                  <br />
                  Funciones: {weakFunctionLabels.join(", ") || "-"}
                </p>
              </div>
            ) : null}
          </div>

          <div className="panel practice-panel">
            {!currentItem ? (
              <div className="empty-state">
                <h3>Genera una frase para empezar.</h3>
                <p className="muted-line">Si Gemini falla o no tiene clave, el banco local sigue funcionando.</p>
              </div>
            ) : (
              <>
                <p className="panel-kicker">Frase</p>
                <h3 className="prompt-text">{currentItem.sentence}</h3>
                <div className="meta-strip">
                  <span>Modo: {currentItem.mode}</span>
                  <span>Restantes en cola: {queue.length}</span>
                </div>

                <div className="field-grid">
                  <div>
                    <FieldLabel label="Valor de se" />
                    <select value={guessValue} onChange={(event) => setGuessValue(event.target.value)}>
                      {SE_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel label="Funcion de se" />
                    <select value={guessFunction} onChange={(event) => setGuessFunction(event.target.value)}>
                      {SE_FUNCTIONS.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button className="primary-btn" type="button" onClick={handleCheck}>
                  Comprobar respuesta
                </button>

                {evaluation ? (
                  <>
                    <div className="result-panel">
                      <p>
                        Valor:{" "}
                        <strong className={evaluation.valueOk ? "result-ok" : "result-bad"}>
                          {evaluation.valueOk ? "correcto" : `incorrecto (correcto: ${currentItem.seValue})`}
                        </strong>
                      </p>
                      <p>
                        Funcion:{" "}
                        <strong className={evaluation.functionOk ? "result-ok" : "result-bad"}>
                          {evaluation.functionOk ? "correcta" : `incorrecta (correcta: ${currentItem.seFunction})`}
                        </strong>
                      </p>
                      <p>
                        Estado global:{" "}
                        <strong className={evaluation.overallOk ? "result-ok" : "result-bad"}>
                          {evaluation.overallOk ? "acierto" : "revisar"}
                        </strong>
                      </p>
                    </div>

                    <div className="info-block">
                      <p className="panel-kicker">Explicacion</p>
                      <p>{currentItem.phraseType}</p>
                      <p className="muted-line">{currentItem.explanation}</p>
                    </div>

                    <details className="details-panel">
                      <summary>Respuesta del modelo (inicial)</summary>
                      <div className="details-content">
                        <p>Valor propuesto: {currentItem.seValue}</p>
                        <p>Funcion propuesta: {currentItem.seFunction}</p>
                        <p>Tipo de oracion: {currentItem.phraseType}</p>
                        <button className="ghost-btn" disabled={isRechecking} type="button" onClick={handleRecheck}>
                          {isRechecking ? "Revisando..." : "Recheck"}
                        </button>

                        {recheck ? (
                          <div className="info-block">
                            {recheck.success ? (
                              <>
                                <p className={recheck.isCorrect ? "result-ok" : "result-bad"}>
                                  {recheck.isCorrect
                                    ? `Confirmado por ${recheck.model}: la respuesta inicial era correcta.`
                                    : `Recheck con ${recheck.model}: se detectaron discrepancias.`}
                                </p>
                                {!recheck.isCorrect ? (
                                  <p className="muted-line">
                                    Correccion sugerida: valor={recheck.correctedValue} | funcion={recheck.correctedFunction}
                                  </p>
                                ) : null}
                                {recheck.issues && recheck.issues.length > 0 ? (
                                  <ul>
                                    {recheck.issues.map((issue) => (
                                      <li key={issue}>{issue}</li>
                                    ))}
                                  </ul>
                                ) : null}
                                {recheck.correctionNote ? <p className="muted-line">{recheck.correctionNote}</p> : null}
                              </>
                            ) : (
                              <p className="result-bad">{recheck.error}</p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </details>

                    <div className="question-box">
                      <FieldLabel label="Pregunta sobre esta frase" hint="Opcional, con respuesta breve del modelo." />
                      <textarea
                        placeholder="Ej. Por que aqui es impersonal y no pasiva refleja?"
                        value={questionInput}
                        onChange={(event) => setQuestionInput(event.target.value)}
                      />
                      <button className="ghost-btn" disabled={isAsking || !questionInput.trim()} type="button" onClick={handleAsk}>
                        {isAsking ? "Consultando..." : "Preguntar"}
                      </button>
                      {answer ? (
                        <div className="info-block">
                          {answer.success ? <p>{answer.answer}</p> : <p className="result-bad">{answer.error}</p>}
                          {answer.success && answer.model ? <p className="muted-line">Modelo: {answer.model}</p> : null}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {page === "history" ? (
        <div className="page-grid single-column">
          <div className="panel">
            <div className="row-between">
              <div>
                <p className="panel-kicker">Historial</p>
                <h3>Aprendizaje local por perfil</h3>
              </div>
              <label className="checkbox-line">
                <input
                  checked={settings.hideHistory}
                  onChange={(event) => onSettingsChange({ ...settings, hideHistory: event.target.checked })}
                  type="checkbox"
                />
                <span>Ocultar historial</span>
              </label>
            </div>

            {settings.hideHistory ? (
              <p className="muted-line">Historial oculto para esta seccion.</p>
            ) : (
              <>
                <div className="row-between">
                  <p className="muted-line">
                    Intentos totales: {profile.totalAttempts} | Acierto completo: {seAccuracy(profileAttempts).toFixed(1)}%
                  </p>
                  <label className="checkbox-line">
                    <input checked={historyOnlyErrors} onChange={(event) => setHistoryOnlyErrors(event.target.checked)} type="checkbox" />
                    <span>Mostrar solo fallos</span>
                  </label>
                </div>

                <div className="stats-grid">
                  <div className="info-block">
                    <p className="panel-kicker">Mas dificiles (valor)</p>
                    <SummaryList rows={profile.weakValues} />
                  </div>
                  <div className="info-block">
                    <p className="panel-kicker">Mas dificiles (funcion)</p>
                    <SummaryList rows={profile.weakFunctions} />
                  </div>
                  <div className="info-block">
                    <p className="panel-kicker">Mejores (valor)</p>
                    <SummaryList rows={profile.strongValues} />
                  </div>
                  <div className="info-block">
                    <p className="panel-kicker">Mejores (funcion)</p>
                    <SummaryList rows={profile.strongFunctions} />
                  </div>
                </div>

                <div className="stack-lg">
                  <div>
                    <p className="panel-kicker">Rendimiento exacto por valor y funcion</p>
                    <DataTable
                      headers={["Eje", "Item", "OK", "Fallos", "Intentos", "Tasa fallo"]}
                      rows={[
                        ...profile.valueOverview.map((row) => ["valor", row.label, row.ok, row.fail, row.attempts, `${(row.failRate * 100).toFixed(1)}%`]),
                        ...profile.functionOverview.map((row) => [
                          "funcion",
                          row.label,
                          row.ok,
                          row.fail,
                          row.attempts,
                          `${(row.failRate * 100).toFixed(1)}%`,
                        ]),
                      ]}
                    />
                  </div>

                  <div>
                    <p className="panel-kicker">Combinaciones donde mas fallas</p>
                    <DataTable
                      headers={["Par", "OK", "Fallos", "Intentos", "Tasa fallo"]}
                      rows={profile.weakPairs.map((row) => [row.pair, row.ok, row.fail, row.attempts, `${(row.failRate * 100).toFixed(1)}%`])}
                    />
                  </div>

                  <div>
                    <p className="panel-kicker">Intentos guardados</p>
                    <DataTable
                      headers={["Fecha", "Frase", "Esperado", "Tu respuesta", "Estado", "Modo"]}
                      rows={visibleAttempts.map((attempt) => [
                        new Date(attempt.createdAt).toLocaleString(),
                        attempt.sentence,
                        `${attempt.expectedValue} / ${attempt.expectedFunction}`,
                        `${attempt.guessValue} / ${attempt.guessFunction}`,
                        attempt.valueOk && attempt.functionOk ? "OK" : "Fallo",
                        attempt.mode,
                      ])}
                    />
                  </div>
                </div>

                <div className="danger-zone">
                  <label className="checkbox-line">
                    <input checked={resetConfirmed} onChange={(event) => setResetConfirmed(event.target.checked)} type="checkbox" />
                    <span>Confirmo que quiero borrar todo el historial de este perfil</span>
                  </label>
                  <button
                    className="danger-btn"
                    disabled={!resetConfirmed}
                    type="button"
                    onClick={() => {
                      onAttemptsChange(resetSeAttempts(attempts, settings.profileId));
                      setResetConfirmed(false);
                    }}
                  >
                    Resetear historial
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {page === "settings" ? (
        <div className="page-grid single-column">
          <div className="panel">
            <p className="panel-kicker">Ajustes</p>
            <h3>Perfil y modelo</h3>

            <div className="field-grid">
              <div>
                <FieldLabel label="Perfil" hint="Afecta el historial local y el refuerzo personalizado." />
                <input value={profileDraft} onChange={(event) => setProfileDraft(event.target.value)} />
              </div>
              <div>
                <FieldLabel label="Modelo Gemini" hint="Si no hay clave valida, se usara el banco local." />
                <select value={selectedModelDraft} onChange={(event) => setSelectedModelDraft(event.target.value)}>
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value="custom">Personalizado (manual)</option>
                </select>
              </div>
            </div>

            <div>
              <FieldLabel label="Modelo personalizado" hint="Solo se usa si eliges la opcion manual." />
              <input
                disabled={selectedModelDraft !== "custom"}
                placeholder="ej. gemini-2.5-flash-lite"
                value={customModelDraft}
                onChange={(event) => setCustomModelDraft(event.target.value)}
              />
            </div>

            <button className="primary-btn" type="button" onClick={saveSettingsDraft}>
              Guardar ajustes
            </button>

            <GeminiKeyPanel apiKey={apiKey} onApiKeyChange={onApiKeyChange} />

            <div className="info-block">
              <p className="panel-kicker">Estado</p>
              <p className="muted-line">
                La app intentara usar primero la clave local que pegues aqui. Si no existe, usara la configuracion del sitio en
                Netlify. Si ambas faltan o fallan, practica con el banco local.
              </p>
              {settings.modelName.toLowerCase().startsWith("gemma") ? (
                <p className="muted-line">Compatibilidad Gemma activa: el servidor enviara prompt inline cuando corresponda.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MorfoWorkspace({
  active,
  page,
  settings,
  attempts,
  apiKey,
  onApiKeyChange,
  onSettingsChange,
  onAttemptsChange,
}: {
  active: boolean;
  page: PageName;
  settings: MorfoSettings;
  attempts: MorfoAttempt[];
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  onSettingsChange: (settings: MorfoSettings) => void;
  onAttemptsChange: (attempts: MorfoAttempt[]) => void;
}) {
  const profile = useMemo(() => morfoLearningProfile(attempts, settings.profileId), [attempts, settings.profileId]);
  const profileAttempts = useMemo(
    () => attempts.filter((attempt) => attempt.profileId === settings.profileId),
    [attempts, settings.profileId],
  );
  const [currentItem, setCurrentItem] = useState<MorfoItem | null>(null);
  const [queue, setQueue] = useState<MorfoItem[]>([]);
  const [checkedItemId, setCheckedItemId] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, MorfoEvaluation>>({});
  const [rechecks, setRechecks] = useState<Record<string, RecheckResultMorfo>>({});
  const [answers, setAnswers] = useState<Record<string, QuestionResult>>({});
  const [guessWordType, setGuessWordType] = useState<string>(MORFO_WORD_TYPES[0]);
  const [guessLexeme, setGuessLexeme] = useState("");
  const [guessMorphemesText, setGuessMorphemesText] = useState("");
  const [guessMorphemeTypes, setGuessMorphemeTypes] = useState<string[]>([]);
  const [questionInput, setQuestionInput] = useState("");
  const [mixBucket, setMixBucket] = useState<boolean[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [historyOnlyErrors, setHistoryOnlyErrors] = useState(true);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [statusNote, setStatusNote] = useState("Listo para generar lote.");
  const [statusTone, setStatusTone] = useState<"info" | "warn">("info");
  const [profileDraft, setProfileDraft] = useState(settings.profileId);
  const [selectedModelDraft, setSelectedModelDraft] = useState(
    MODEL_OPTIONS.some((option) => option.value === settings.modelName) ? settings.modelName : "custom",
  );
  const [customModelDraft, setCustomModelDraft] = useState(
    MODEL_OPTIONS.some((option) => option.value === settings.modelName) ? "" : settings.modelName,
  );

  const mixText = ratioLabel(settings.targetWeight, settings.normalWeight);
  const weakWordTypeLabels = profile.weakWordTypes.map((row) => row.label);
  const weakMorphemeTypeLabels = profile.weakMorphemeTypes.map((row) => row.label);
  const visibleAttempts = historyOnlyErrors
    ? profileAttempts.filter(
        (attempt) => !attempt.wordTypeOk || !attempt.lexemeOk || !attempt.morphemesOk || !attempt.morphemeTypesOk,
      )
    : profileAttempts;

  useEffect(() => {
    setGuessWordType(MORFO_WORD_TYPES[0]);
    setGuessLexeme("");
    setGuessMorphemesText("");
    setGuessMorphemeTypes([]);
    setQuestionInput("");
  }, [currentItem?.id]);

  useEffect(() => {
    setProfileDraft(settings.profileId);
    if (MODEL_OPTIONS.some((option) => option.value === settings.modelName)) {
      setSelectedModelDraft(settings.modelName);
      setCustomModelDraft("");
    } else {
      setSelectedModelDraft("custom");
      setCustomModelDraft(settings.modelName);
    }
  }, [settings.profileId, settings.modelName]);

  useEffect(() => {
    setMixBucket([]);
  }, [settings.targetWeight, settings.normalWeight]);

  const toggleFocusWordType = (value: string) => {
    const nextFocusWordTypes = settings.focusWordTypes.includes(value)
      ? settings.focusWordTypes.filter((entry) => entry !== value)
      : [...settings.focusWordTypes, value];
    onSettingsChange({ ...settings, focusWordTypes: nextFocusWordTypes });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let nextQueue = [...queue];
      if (nextQueue.length === 0) {
        const batchSize = settings.personalized ? 3 : 10;
        let workingBucket = [...mixBucket];
        const strategies: MorfoStrategy[] = [];

        for (let index = 0; index < batchSize; index += 1) {
          let forceTargeted: boolean | undefined;
          if (
            settings.personalized &&
            settings.focusWordTypes.length === 0 &&
            (weakWordTypeLabels.length > 0 || weakMorphemeTypeLabels.length > 0)
          ) {
            const [targeted, nextBucket] = popMixTargeted(workingBucket, settings.targetWeight, settings.normalWeight);
            forceTargeted = targeted;
            workingBucket = nextBucket;
          }

          strategies.push(
            chooseMorfoTarget(profile, settings.focusWordTypes, settings.personalized, forceTargeted, mixText),
          );
        }

        setMixBucket(workingBucket);

        const recentWords = fetchRecentMorfoWords(attempts, settings.profileId, 14);
        const recentLabels = fetchRecentMorfoLabels(attempts, settings.profileId, 10);
        const fallbackItems = fallbackMorfoBatch(settings.difficulty, strategies, recentWords);
        const prepared: MorfoItem[] = [];
        const seen = new Set<string>();
        const pushCandidate = (candidate: Omit<MorfoItem, "id"> | MorfoItem) => {
          const key = candidate.word.trim().toLowerCase();
          if (!key || seen.has(key) || prepared.length >= batchSize) {
            return;
          }
          seen.add(key);
          prepared.push("id" in candidate ? candidate : { ...candidate, id: createId("morfo") });
        };

        try {
          const remoteItems = await requestMorfoGeneration({
            apiKey,
            modelName: settings.modelName,
            difficulty: settings.difficulty,
            strategies,
            profile,
            recentWords,
            recentLabels,
          });
          remoteItems.forEach(pushCandidate);
          fallbackItems.forEach(pushCandidate);
          setStatusNote(remoteItems.length > 0 ? "Lote servido por Gemini con relleno local de seguridad." : "Gemini no devolvio items validos. Modo local activado.");
          setStatusTone(remoteItems.length > 0 ? "info" : "warn");
        } catch (error) {
          fallbackItems.forEach(pushCandidate);
          setStatusNote(error instanceof Error ? `${error.message} Se uso el banco local.` : "Fallo de Gemini. Se uso el banco local.");
          setStatusTone("warn");
        }

        while (prepared.length < batchSize) {
          const extraFallback = fallbackMorfoBatch(settings.difficulty, strategies, recentWords);
          const beforeLength = prepared.length;
          extraFallback.forEach(pushCandidate);
          if (prepared.length === beforeLength) {
            break;
          }
        }

        nextQueue = settings.personalized ? prepared : shuffleList(prepared);
      }

      const [nextItem, ...rest] = nextQueue;
      setCurrentItem(nextItem ?? null);
      setQueue(rest);
      setCheckedItemId(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCheck = () => {
    if (!currentItem) {
      return;
    }
    const evaluation = evaluateMorfoGuess(currentItem, guessWordType, guessLexeme, guessMorphemesText, guessMorphemeTypes);
    setEvaluations((current) => ({ ...current, [currentItem.id]: evaluation }));

    if (checkedItemId !== currentItem.id) {
      onAttemptsChange([...attempts, makeMorfoAttempt(currentItem, settings, evaluation)]);
      setCheckedItemId(currentItem.id);
    }
  };

  const handleRecheck = async () => {
    if (!currentItem) {
      return;
    }
    setIsRechecking(true);
    try {
      const result = await requestMorfoRecheck({
        apiKey,
        modelName: settings.modelName,
        word: currentItem.word,
        wordType: currentItem.wordType,
        lexeme: currentItem.lexeme,
        morphemes: currentItem.morphemes,
        morphemeTypes: currentItem.morphemeTypes,
        analysisType: currentItem.analysisType,
        explanation: currentItem.explanation,
      });
      setRechecks((current) => ({ ...current, [currentItem.id]: result }));
    } catch (error) {
      setRechecks((current) => ({
        ...current,
        [currentItem.id]: {
          success: true,
          model: "modo local",
          isCorrect: true,
          correctedWordType: currentItem.wordType,
          correctedLexeme: currentItem.lexeme,
          correctedMorphemes: currentItem.morphemes,
          correctedMorphemeTypes: currentItem.morphemeTypes,
          issues: [],
          correctionNote:
            error instanceof Error
              ? `${error.message} Se confirma la respuesta del banco local.`
              : "Sin acceso a Gemini. Se confirma la respuesta del banco local.",
        },
      }));
    } finally {
      setIsRechecking(false);
    }
  };

  const handleAsk = async () => {
    if (!currentItem || !questionInput.trim()) {
      return;
    }
    setIsAsking(true);
    try {
      const result = await requestMorfoQuestion({
        apiKey,
        modelName: settings.modelName,
        item: {
          word: currentItem.word,
          wordType: currentItem.wordType,
          lexeme: currentItem.lexeme,
          morphemes: currentItem.morphemes,
          morphemeTypes: currentItem.morphemeTypes,
          analysisType: currentItem.analysisType,
          explanation: currentItem.explanation,
        },
        question: questionInput.trim(),
        recheckResult: rechecks[currentItem.id],
      });
      setAnswers((current) => ({ ...current, [currentItem.id]: result }));
    } catch (error) {
      setAnswers((current) => ({
        ...current,
        [currentItem.id]: {
          success: true,
          model: "modo local",
          answer:
            `Modo local: ${currentItem.explanation}\n\nAnalisis: ${currentItem.analysisType}.\n\n` +
            (error instanceof Error
              ? `${error.message} Pega una GEMINI_API_KEY valida en Ajustes si quieres respuestas desarrolladas.`
              : "Pega una GEMINI_API_KEY valida en Ajustes si quieres respuestas desarrolladas."),
        },
      }));
    } finally {
      setIsAsking(false);
    }
  };

  const saveSettingsDraft = () => {
    const resolvedModel = selectedModelDraft === "custom" ? customModelDraft.trim() || MODEL_OPTIONS[0].value : selectedModelDraft;
    onSettingsChange({
      ...settings,
      profileId: profileDraft.trim() || "alumno",
      modelName: resolvedModel,
    });
  };

  const evaluation = currentItem ? evaluations[currentItem.id] : null;
  const recheck = currentItem ? rechecks[currentItem.id] : null;
  const answer = currentItem ? answers[currentItem.id] : null;

  return (
    <section className={cx("workspace", !active && "hidden-workspace")}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Morfologia</p>
          <h2>Analisis de palabras</h2>
        </div>
        <div className="meta-strip">
          <span>Perfil: {settings.profileId}</span>
          <span>Modelo: {settings.modelName}</span>
          <span>Intentos: {profile.totalAttempts}</span>
        </div>
      </header>

      {page === "practice" ? (
        <div className="page-grid">
          <div className="panel control-panel">
            <p className="panel-kicker">Configuracion</p>
            <div className="field-block">
              <FieldLabel label="Dificultad" hint="Se mantiene por seccion." />
              <div className="chip-cloud">
                {[1, 2, 3].map((difficulty) => (
                  <ChoicePill
                    key={difficulty}
                    active={settings.difficulty === difficulty}
                    label={`D${difficulty}`}
                    onClick={() => onSettingsChange({ ...settings, difficulty: difficulty as 1 | 2 | 3 })}
                  />
                ))}
              </div>
            </div>

            <div className="field-block">
              <FieldLabel label="Modo" hint="Usa refuerzo de debilidades cuando hay historial." />
              <label className="checkbox-line">
                <input
                  checked={settings.personalized}
                  onChange={(event) => onSettingsChange({ ...settings, personalized: event.target.checked })}
                  type="checkbox"
                />
                <span>Personalizado</span>
              </label>
            </div>

            <div className="field-block">
              <FieldLabel label="Foco manual" hint="Selecciona tipos de palabra para forzar el lote." />
              <MultiToggleList options={MORFO_WORD_TYPES} selected={settings.focusWordTypes} onToggle={toggleFocusWordType} />
            </div>

            <div className="field-grid compact-grid">
              <div>
                <FieldLabel label="Peso debilidades" />
                <input
                  max={100}
                  min={0}
                  step={5}
                  type="number"
                  value={settings.targetWeight}
                  onChange={(event) => onSettingsChange({ ...settings, targetWeight: Number(event.target.value) || 0 })}
                />
              </div>
              <div>
                <FieldLabel label="Peso normal" />
                <input
                  max={100}
                  min={0}
                  step={5}
                  type="number"
                  value={settings.normalWeight}
                  onChange={(event) => onSettingsChange({ ...settings, normalWeight: Number(event.target.value) || 0 })}
                />
              </div>
            </div>

            <p className="muted-line">Mezcla actual: {mixText}</p>
            <div className={cx("inline-banner", statusTone === "warn" && "warn")}>{statusNote}</div>

            <button className="primary-btn" disabled={isGenerating} type="button" onClick={handleGenerate}>
              {isGenerating ? "Preparando lote..." : queue.length > 0 ? "Siguiente palabra" : "Generar lote"}
            </button>

            {settings.personalized && (weakWordTypeLabels.length > 0 || weakMorphemeTypeLabels.length > 0) ? (
              <div className="info-block">
                <p className="panel-kicker">Refuerzo activo</p>
                <p className="muted-line">
                  Tipos de palabra: {weakWordTypeLabels.join(", ") || "-"}
                  <br />
                  Tipos de morfema: {weakMorphemeTypeLabels.join(", ") || "-"}
                </p>
              </div>
            ) : null}
          </div>

          <div className="panel practice-panel">
            {!currentItem ? (
              <div className="empty-state">
                <h3>Genera una palabra para empezar.</h3>
                <p className="muted-line">Si Gemini falla o no tiene clave, el banco local sigue funcionando.</p>
              </div>
            ) : (
              <>
                <p className="panel-kicker">Palabra</p>
                <h3 className="prompt-text">{currentItem.word}</h3>
                <div className="meta-strip">
                  <span>Modo: {currentItem.mode}</span>
                  <span>Restantes en cola: {queue.length}</span>
                </div>

                <div className="field-grid">
                  <div>
                    <FieldLabel label="Tipo de palabra" />
                    <select value={guessWordType} onChange={(event) => setGuessWordType(event.target.value)}>
                      {MORFO_WORD_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel label="Lexema" />
                    <input placeholder="Ej. cant / cas / just" value={guessLexeme} onChange={(event) => setGuessLexeme(event.target.value)} />
                  </div>
                </div>

                <div className="field-grid">
                  <div>
                    <FieldLabel label="Morfemas" hint="Separados por coma." />
                    <input
                      placeholder="Ej. des, ad, o, s"
                      value={guessMorphemesText}
                      onChange={(event) => setGuessMorphemesText(event.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel label="Tipos de morfema" />
                    <MultiToggleList
                      options={MORFO_MORPHEME_TYPES}
                      selected={guessMorphemeTypes}
                      onToggle={(value) =>
                        setGuessMorphemeTypes((current) =>
                          current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
                        )
                      }
                    />
                  </div>
                </div>

                <button className="primary-btn" type="button" onClick={handleCheck}>
                  Comprobar respuesta
                </button>

                {evaluation ? (
                  <>
                    <div className="result-panel">
                      <p>
                        Tipo de palabra:{" "}
                        <strong className={evaluation.wordTypeOk ? "result-ok" : "result-bad"}>
                          {evaluation.wordTypeOk ? "correcto" : `incorrecto (correcto: ${currentItem.wordType})`}
                        </strong>
                      </p>
                      <p>
                        Lexema:{" "}
                        <strong className={evaluation.lexemeOk ? "result-ok" : "result-bad"}>
                          {evaluation.lexemeOk ? "correcto" : `incorrecto (aceptados: ${currentItem.acceptedLexemes.join(", ")})`}
                        </strong>
                      </p>
                      <p>
                        Morfemas:{" "}
                        <strong className={evaluation.morphemesOk ? "result-ok" : "result-bad"}>
                          {evaluation.morphemesOk ? "correctos" : `incorrectos (correctos: ${currentItem.morphemes.join(", ")})`}
                        </strong>
                      </p>
                      <p>
                        Tipos de morfema:{" "}
                        <strong className={evaluation.morphemeTypesOk ? "result-ok" : "result-bad"}>
                          {evaluation.morphemeTypesOk
                            ? "correctos"
                            : `incorrectos (correctos: ${currentItem.morphemeTypes.join(", ")})`}
                        </strong>
                      </p>
                      <p>
                        Estado global:{" "}
                        <strong className={evaluation.overallOk ? "result-ok" : "result-bad"}>
                          {evaluation.overallOk ? "acierto" : "revisar"}
                        </strong>
                      </p>
                    </div>

                    <div className="info-block">
                      <p className="panel-kicker">Explicacion</p>
                      <p>{currentItem.analysisType}</p>
                      <p className="muted-line">{currentItem.explanation}</p>
                    </div>

                    <details className="details-panel">
                      <summary>Respuesta del modelo (inicial)</summary>
                      <div className="details-content">
                        <p>Tipo de palabra propuesto: {currentItem.wordType}</p>
                        <p>Lexema propuesto: {currentItem.lexeme}</p>
                        <p>Morfemas propuestos: {currentItem.morphemes.join(", ")}</p>
                        <p>Tipos de morfema propuestos: {currentItem.morphemeTypes.join(", ")}</p>
                        <button className="ghost-btn" disabled={isRechecking} type="button" onClick={handleRecheck}>
                          {isRechecking ? "Revisando..." : "Recheck"}
                        </button>

                        {recheck ? (
                          <div className="info-block">
                            {recheck.success ? (
                              <>
                                <p className={recheck.isCorrect ? "result-ok" : "result-bad"}>
                                  {recheck.isCorrect
                                    ? `Confirmado por ${recheck.model}: la respuesta inicial era correcta.`
                                    : `Recheck con ${recheck.model}: se detectaron discrepancias.`}
                                </p>
                                {!recheck.isCorrect ? (
                                  <p className="muted-line">
                                    Correccion sugerida: tipo={recheck.correctedWordType} | lexema={recheck.correctedLexeme}
                                  </p>
                                ) : null}
                                {recheck.correctedMorphemes && recheck.correctedMorphemes.length > 0 ? (
                                  <p className="muted-line">Morfemas sugeridos: {recheck.correctedMorphemes.join(", ")}</p>
                                ) : null}
                                {recheck.correctedMorphemeTypes && recheck.correctedMorphemeTypes.length > 0 ? (
                                  <p className="muted-line">Tipos sugeridos: {recheck.correctedMorphemeTypes.join(", ")}</p>
                                ) : null}
                                {recheck.issues && recheck.issues.length > 0 ? (
                                  <ul>
                                    {recheck.issues.map((issue) => (
                                      <li key={issue}>{issue}</li>
                                    ))}
                                  </ul>
                                ) : null}
                                {recheck.correctionNote ? <p className="muted-line">{recheck.correctionNote}</p> : null}
                              </>
                            ) : (
                              <p className="result-bad">{recheck.error}</p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </details>

                    <div className="question-box">
                      <FieldLabel label="Pregunta sobre esta palabra" hint="Opcional, con respuesta breve del modelo." />
                      <textarea
                        placeholder="Ej. Por que aqui hay sufijo derivativo y no interfijo?"
                        value={questionInput}
                        onChange={(event) => setQuestionInput(event.target.value)}
                      />
                      <button className="ghost-btn" disabled={isAsking || !questionInput.trim()} type="button" onClick={handleAsk}>
                        {isAsking ? "Consultando..." : "Preguntar"}
                      </button>
                      {answer ? (
                        <div className="info-block">
                          {answer.success ? <p>{answer.answer}</p> : <p className="result-bad">{answer.error}</p>}
                          {answer.success && answer.model ? <p className="muted-line">Modelo: {answer.model}</p> : null}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {page === "history" ? (
        <div className="page-grid single-column">
          <div className="panel">
            <div className="row-between">
              <div>
                <p className="panel-kicker">Historial</p>
                <h3>Aprendizaje local por perfil</h3>
              </div>
              <label className="checkbox-line">
                <input
                  checked={settings.hideHistory}
                  onChange={(event) => onSettingsChange({ ...settings, hideHistory: event.target.checked })}
                  type="checkbox"
                />
                <span>Ocultar historial</span>
              </label>
            </div>

            {settings.hideHistory ? (
              <p className="muted-line">Historial oculto para esta seccion.</p>
            ) : (
              <>
                <div className="row-between">
                  <p className="muted-line">Intentos totales: {profile.totalAttempts}</p>
                  <label className="checkbox-line">
                    <input checked={historyOnlyErrors} onChange={(event) => setHistoryOnlyErrors(event.target.checked)} type="checkbox" />
                    <span>Mostrar solo fallos</span>
                  </label>
                </div>

                <div className="stats-grid">
                  <div className="info-block">
                    <p className="panel-kicker">Mas dificiles (tipo)</p>
                    <SummaryList rows={profile.weakWordTypes} />
                  </div>
                  <div className="info-block">
                    <p className="panel-kicker">Mas dificiles (morfema)</p>
                    <SummaryList rows={profile.weakMorphemeTypes} />
                  </div>
                  <div className="info-block">
                    <p className="panel-kicker">Mejores (tipo)</p>
                    <SummaryList rows={profile.strongWordTypes} />
                  </div>
                  <div className="info-block">
                    <p className="panel-kicker">Mejores (morfema)</p>
                    <SummaryList rows={profile.strongMorphemeTypes} />
                  </div>
                </div>

                <div className="stack-lg">
                  <div>
                    <p className="panel-kicker">Rendimiento exacto por tipo y morfema</p>
                    <DataTable
                      headers={["Eje", "Item", "OK", "Fallos", "Intentos", "Tasa fallo"]}
                      rows={[
                        ...profile.wordTypeOverview.map((row) => ["tipo", row.label, row.ok, row.fail, row.attempts, `${(row.failRate * 100).toFixed(1)}%`]),
                        ...profile.morphemeTypeOverview.map((row) => [
                          "morfema",
                          row.label,
                          row.ok,
                          row.fail,
                          row.attempts,
                          `${(row.failRate * 100).toFixed(1)}%`,
                        ]),
                      ]}
                    />
                  </div>

                  <div>
                    <p className="panel-kicker">Combinaciones donde mas fallas</p>
                    <DataTable
                      headers={["Par", "OK", "Fallos", "Intentos", "Tasa fallo"]}
                      rows={profile.weakPairs.map((row) => [row.pair, row.ok, row.fail, row.attempts, `${(row.failRate * 100).toFixed(1)}%`])}
                    />
                  </div>

                  <div>
                    <p className="panel-kicker">Intentos guardados</p>
                    <DataTable
                      headers={["Fecha", "Palabra", "Esperado", "Tu respuesta", "Estado", "Modo"]}
                      rows={visibleAttempts.map((attempt) => [
                        new Date(attempt.createdAt).toLocaleString(),
                        attempt.word,
                        `${attempt.expectedWordType} / ${attempt.expectedLexeme}`,
                        `${attempt.guessWordType} / ${attempt.guessLexeme}`,
                        attempt.overallOk ? "OK" : "Fallo",
                        attempt.mode,
                      ])}
                    />
                  </div>
                </div>

                <div className="danger-zone">
                  <label className="checkbox-line">
                    <input checked={resetConfirmed} onChange={(event) => setResetConfirmed(event.target.checked)} type="checkbox" />
                    <span>Confirmo que quiero borrar todo el historial de este perfil</span>
                  </label>
                  <button
                    className="danger-btn"
                    disabled={!resetConfirmed}
                    type="button"
                    onClick={() => {
                      onAttemptsChange(resetMorfoAttempts(attempts, settings.profileId));
                      setResetConfirmed(false);
                    }}
                  >
                    Resetear historial
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {page === "settings" ? (
        <div className="page-grid single-column">
          <div className="panel">
            <p className="panel-kicker">Ajustes</p>
            <h3>Perfil y modelo</h3>

            <div className="field-grid">
              <div>
                <FieldLabel label="Perfil" hint="Afecta el historial local y el refuerzo personalizado." />
                <input value={profileDraft} onChange={(event) => setProfileDraft(event.target.value)} />
              </div>
              <div>
                <FieldLabel label="Modelo Gemini" hint="Si no hay clave valida, se usara el banco local." />
                <select value={selectedModelDraft} onChange={(event) => setSelectedModelDraft(event.target.value)}>
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value="custom">Personalizado (manual)</option>
                </select>
              </div>
            </div>

            <div>
              <FieldLabel label="Modelo personalizado" hint="Solo se usa si eliges la opcion manual." />
              <input
                disabled={selectedModelDraft !== "custom"}
                placeholder="ej. gemini-2.5-flash-lite"
                value={customModelDraft}
                onChange={(event) => setCustomModelDraft(event.target.value)}
              />
            </div>

            <button className="primary-btn" type="button" onClick={saveSettingsDraft}>
              Guardar ajustes
            </button>

            <GeminiKeyPanel apiKey={apiKey} onApiKeyChange={onApiKeyChange} />

            <div className="info-block">
              <p className="panel-kicker">Estado</p>
              <p className="muted-line">
                La app intentara usar primero la clave local que pegues aqui. Si no existe, usara la configuracion del sitio en
                Netlify. Si ambas faltan o fallan, practica con el banco local.
              </p>
              {settings.modelName.toLowerCase().startsWith("gemma") ? (
                <p className="muted-line">Compatibilidad Gemma activa: el servidor enviara prompt inline cuando corresponda.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
