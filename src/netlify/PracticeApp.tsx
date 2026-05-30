import { useEffect, useMemo, useState } from "react";

import {
  MODEL_OPTIONS,
  MORFO_MORPHEME_TYPES,
  MORFO_WORD_TYPES,
  PERIPHRASIS_STRUCTURES,
  PERIPHRASIS_TYPES,
  SE_FUNCTIONS,
  SE_PERIPHRASIS_TYPES,
  SE_VALUES,
  SE_VERBAL_STRUCTURES,
} from "./data";
import {
  acceptedLexemesForItem,
  chooseMorfoTarget,
  choosePeriphrasisTarget,
  chooseSeTarget,
  coercePracticeBatchSize,
  createId,
  evaluateMorfoGuess,
  evaluatePeriphrasisGuess,
  evaluateSeGuess,
  fallbackMorfoBatch,
  fallbackPeriphrasisBatch,
  fallbackSeBatch,
  fetchRecentMorfoLabels,
  fetchRecentMorfoWords,
  fetchRecentPeriphrasisLabels,
  fetchRecentPeriphrasisSentences,
  fetchRecentSeLabels,
  fetchRecentSeSentences,
  loadStorageState,
  makeMorfoAttempt,
  makePeriphrasisAttempt,
  makeSeAttempt,
  manualMorfoBatch,
  manualPeriphrasisBatch,
  manualSeBatch,
  MAX_PRACTICE_BATCH_SIZE,
  MIN_PRACTICE_BATCH_SIZE,
  morfoLearningProfile,
  normalizeTextToken,
  periphrasisAccuracy,
  periphrasisLearningProfile,
  popMixTargeted,
  resetMorfoAttempts,
  resetPeriphrasisAttempts,
  resetSeAttempts,
  saveStorageState,
  seAccuracy,
  seLearningProfile,
} from "./logic";
import {
  requestMorfoGeneration,
  requestMorfoQuestion,
  requestMorfoRecheck,
  requestPeriphrasisGeneration,
  sanitizeUploadedMorfoItem,
  sanitizeUploadedPeriphrasisItem,
  sanitizeUploadedSeItem,
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
  ItemSource,
  PeriphrasisAttempt,
  PeriphrasisEvaluation,
  PeriphrasisItem,
  PeriphrasisSettings,
  PeriphrasisStrategy,
  QuestionResult,
  RecheckResultMorfo,
  RecheckResultSe,
  SeAttempt,
  SeEvaluation,
  SeItem,
  SeSettings,
  SeStrategy,
  StorageState,
  StoredMorfoItem,
  StoredPeriphrasisItem,
  StoredSeItem,
  SummaryRow,
} from "./types";

type SectionName = "se" | "perifrasis" | "morfologia";
type PageName = "practice" | "history" | "settings" | "storage";

interface SectionMeta {
  navLabel: string;
  title: string;
  theme?: "light" | "dark";
}

interface PageMeta {
  label: string;
}

const SECTION_ORDER: SectionName[] = ["se", "perifrasis", "morfologia"];

const PAGE_META: Record<PageName, PageMeta> = {
  practice: {
    label: "Practicar",
  },
  history: {
    label: "Historial",
  },
  settings: {
    label: "Ajustes",
  },
  storage: {
    label: "Bancos",
  },
};

const SECTION_META: Record<SectionName, SectionMeta> = {
  se: {
    navLabel: "Valores del se",
    title: "Valores del se",
  },
  perifrasis: {
    navLabel: "Perifrasis",
    title: "Perifrasis",
  },
  morfologia: {
    navLabel: "Morfologia",
    title: "Morfologia",
    theme: "dark",
  },
};

const SE_IMPORT_PLACEHOLDER = `{"items":[{"sentence":"Se venden pisos en este barrio.","difficulty":2,"se_value":"Pasiva refleja","se_function":"Marca de pasiva","accepted_functions":["Marca de pasiva","Sin funcion sintactica propia"],"verbal_structure":"Verbo simple","periphrasis_type":"No aplica","phrase_type":"Oracion simple pasiva refleja","explanation":"El verbo concuerda con el sujeto paciente 'pisos'."}]}`;
const PERIPHRASIS_IMPORT_PLACEHOLDER = `{"items":[{"sentence":"Debes entregar el informe antes del viernes.","difficulty":2,"verbal_structure":"Perifrasis verbal","periphrasis_type":"Modal obligativa","phrase_type":"Oracion simple predicativa","explanation":"'Deber + infinitivo' expresa obligacion."}]}`;
const MORFO_IMPORT_PLACEHOLDER = `{"items":[{"word":"desordenados","difficulty":2,"word_type":"Adjetivo","lexeme":"orden","accepted_lexemes":["orden"],"morphemes":["des","ad","o","s"],"morpheme_types":["Prefijo derivativo","Sufijo derivativo","Morfema flexivo nominal (genero)","Morfema flexivo nominal (numero)"],"analysis_type":"Adjetivo con derivacion y flexion","explanation":"Prefijo des- + lexema orden + sufijo -ad- + flexivos -o y -s."}]}`;

function cx(...tokens: Array<string | false | null | undefined>): string {
  return tokens.filter(Boolean).join(" ");
}

function ratioLabel(targetWeight: number, normalWeight: number): string {
  const safeTarget = Math.max(0, targetWeight);
  const safeNormal = Math.max(0, normalWeight);
  const total = safeTarget + safeNormal || 100;
  return `${((safeTarget / total) * 100).toFixed(1)}% debilidades / ${((safeNormal / total) * 100).toFixed(1)}% normal`;
}

function FieldLabel({ label, hint: _hint }: { label: string; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
    </label>
  );
}

function BatchSizeControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const safeValue = coercePracticeBatchSize(value);
  const handleChange = (nextValue: string) => {
    onChange(coercePracticeBatchSize(nextValue));
  };

  return (
    <div className="field-block batch-size-control">
      <div className="batch-size-header">
        <FieldLabel label="Cantidad del lote" />
        <span className="batch-size-count">{safeValue}</span>
      </div>
      <div className="batch-size-row">
        <input
          aria-label="Cantidad del lote"
          max={MAX_PRACTICE_BATCH_SIZE}
          min={MIN_PRACTICE_BATCH_SIZE}
          step={1}
          type="range"
          value={safeValue}
          onChange={(event) => handleChange(event.target.value)}
        />
        <input
          aria-label="Cantidad exacta del lote"
          className="batch-size-number"
          max={MAX_PRACTICE_BATCH_SIZE}
          min={MIN_PRACTICE_BATCH_SIZE}
          step={1}
          type="number"
          value={safeValue}
          onChange={(event) => handleChange(event.target.value)}
        />
      </div>
      <div className="range-meta">
        <span>{MIN_PRACTICE_BATCH_SIZE}</span>
        <span>Max. {MAX_PRACTICE_BATCH_SIZE}</span>
      </div>
    </div>
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
    <button aria-pressed={active} className={cx("choice-pill", active && "active")} type="button" onClick={onClick}>
      {label}
    </button>
  );
}

function PageAction({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cx("page-action", active && "page-action--active")}
      type="button"
      onClick={onClick}
    >
      <span>{label}</span>
    </button>
  );
}

function SummaryList({ rows }: { rows: SummaryRow[] }) {
  if (rows.length === 0) {
    return <p>-</p>;
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
    return <p>Sin datos todavia.</p>;
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

function uniqueLabels(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  items.forEach((item) => {
    const cleaned = item.trim();
    const key = normalizeTextToken(cleaned);
    if (!cleaned || !key || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(cleaned);
  });
  return result;
}

function mergeLabelGroups(...groups: ReadonlyArray<readonly string[]>): string[] {
  return uniqueLabels(groups.flatMap((group) => [...group]));
}

function hasLabel(items: readonly string[], value: string): boolean {
  const key = normalizeTextToken(value);
  return items.some((item) => normalizeTextToken(item) === key);
}

function withoutLabel(items: readonly string[], value: string): string[] {
  const key = normalizeTextToken(value);
  return items.filter((item) => normalizeTextToken(item) !== key);
}

function toggleLabel(items: readonly string[], value: string): string[] {
  return hasLabel(items, value)
    ? withoutLabel(items, value)
    : [...items, value];
}

function parseCustomList(rawText: string): string[] {
  return uniqueLabels(rawText.split(",").map((entry) => entry.trim()).filter(Boolean));
}

function stripBaseLabels(customLabels: readonly string[], baseLabels: readonly string[]): string[] {
  return customLabels.filter((label) => !hasLabel(baseLabels, label));
}

interface ImportResult {
  saved: number;
  rejected: number;
  total: number;
}

function parseQuestionBankRecords(rawText: string): Array<Record<string, unknown>> {
  const parsed = JSON.parse(rawText) as unknown;
  const candidates =
    Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : parsed && typeof parsed === "object"
          ? [parsed]
          : [];

  return candidates.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

function mergeQuestionBank<T>(existing: readonly T[], incoming: readonly T[], keyForItem: (item: T) => string): T[] {
  const byKey = new Map<string, T>();
  existing.forEach((item) => {
    const key = keyForItem(item);
    if (key) {
      byKey.set(key, item);
    }
  });
  incoming.forEach((item) => {
    const key = keyForItem(item);
    if (key) {
      byKey.set(key, item);
    }
  });
  return [...byKey.values()];
}

function SourceToggle({
  source,
  manualCount,
  onChange,
}: {
  source: ItemSource;
  manualCount: number;
  onChange: (source: ItemSource) => void;
}) {
  return (
    <div className="field-block">
      <FieldLabel label="Fuente" />
      <div className="chip-cloud">
        <ChoicePill active={source === "ai"} label="Gemini/local" onClick={() => onChange("ai")} />
        <ChoicePill active={source === "manual"} label={`Manual (${manualCount})`} onClick={() => onChange("manual")} />
      </div>
    </div>
  );
}

function ManualBankPanel({
  count,
  defaultOpen = false,
  onClear,
  onImportText,
  placeholder,
  title,
}: {
  count: number;
  defaultOpen?: boolean;
  onClear: () => void;
  onImportText: (rawText: string) => ImportResult;
  placeholder: string;
  title: string;
}) {
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "warn">("info");

  const importText = (rawText: string) => {
    try {
      const result = onImportText(rawText);
      setMessage(`Guardados ${result.saved} validos. Ignorados ${result.rejected} de ${result.total}.`);
      setTone(result.saved > 0 ? "info" : "warn");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "JSON no valido.");
      setTone("warn");
    }
  };

  return (
    <details className="details-panel manual-bank-panel" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <span>{count} guardados</span>
      </summary>
      <div className="details-content">
        <div className="field-block">
          <FieldLabel label="Importar JSON" />
          <textarea
            className="mono-input"
            placeholder={placeholder}
            spellCheck={false}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <div className="button-row">
          <button className="ghost-btn" disabled={!draft.trim()} type="button" onClick={() => importText(draft)}>
            Importar pegado
          </button>
          <label className="ghost-btn file-upload-btn">
            Subir JSON
            <input
              accept="application/json,.json"
              type="file"
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) {
                  return;
                }
                const text = await file.text();
                setDraft(text);
                importText(text);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <button
            className="danger-btn"
            disabled={count === 0}
            type="button"
            onClick={() => {
              onClear();
              setMessage("Banco vaciado.");
              setTone("info");
            }}
          >
            Vaciar banco
          </button>
        </div>
        {message ? <div className={cx("inline-banner", tone === "warn" && "warn")}>{message}</div> : null}
      </div>
    </details>
  );
}

function QuestionBankStoragePage({
  seSettings,
  periphrasisSettings,
  morfoSettings,
  seQuestionBank,
  periphrasisQuestionBank,
  morfoQuestionBank,
  onSeQuestionBankChange,
  onPeriphrasisQuestionBankChange,
  onMorfoQuestionBankChange,
}: {
  seSettings: SeSettings;
  periphrasisSettings: PeriphrasisSettings;
  morfoSettings: MorfoSettings;
  seQuestionBank: StoredSeItem[];
  periphrasisQuestionBank: StoredPeriphrasisItem[];
  morfoQuestionBank: StoredMorfoItem[];
  onSeQuestionBankChange: (items: StoredSeItem[]) => void;
  onPeriphrasisQuestionBankChange: (items: StoredPeriphrasisItem[]) => void;
  onMorfoQuestionBankChange: (items: StoredMorfoItem[]) => void;
}) {
  const availableSeValues = useMemo(() => mergeLabelGroups(SE_VALUES, seSettings.customValues), [seSettings.customValues]);
  const availablePeriphrasisTypes = useMemo(
    () => mergeLabelGroups(PERIPHRASIS_TYPES, periphrasisSettings.customPeriphrasisTypes),
    [periphrasisSettings.customPeriphrasisTypes],
  );

  const importSeQuestionBank = (rawText: string): ImportResult => {
    const records = parseQuestionBankRecords(rawText);
    const validItems = records
      .map((record) =>
        sanitizeUploadedSeItem(record, seSettings.difficulty, {
          allowedValues: availableSeValues,
          allowedFunctions: [...SE_FUNCTIONS],
          allowedVerbalStructures: [...SE_VERBAL_STRUCTURES],
          allowedPeriphrasisTypes: [...SE_PERIPHRASIS_TYPES],
        }),
      )
      .filter((item): item is StoredSeItem => item !== null);
    const nextBank = mergeQuestionBank(seQuestionBank, validItems, (item) => normalizeTextToken(item.sentence));
    onSeQuestionBankChange(nextBank);
    return {
      saved: validItems.length,
      rejected: records.length - validItems.length,
      total: records.length,
    };
  };

  const importPeriphrasisQuestionBank = (rawText: string): ImportResult => {
    const records = parseQuestionBankRecords(rawText);
    const validItems = records
      .map((record) =>
        sanitizeUploadedPeriphrasisItem(record, periphrasisSettings.difficulty, {
          allowedStructures: [...PERIPHRASIS_STRUCTURES],
          allowedPeriphrasisTypes: availablePeriphrasisTypes,
        }),
      )
      .filter((item): item is StoredPeriphrasisItem => item !== null);
    const nextBank = mergeQuestionBank(periphrasisQuestionBank, validItems, (item) => normalizeTextToken(item.sentence));
    onPeriphrasisQuestionBankChange(nextBank);
    return {
      saved: validItems.length,
      rejected: records.length - validItems.length,
      total: records.length,
    };
  };

  const importMorfoQuestionBank = (rawText: string): ImportResult => {
    const records = parseQuestionBankRecords(rawText);
    const validItems = records
      .map((record) => sanitizeUploadedMorfoItem(record, morfoSettings.difficulty))
      .filter((item): item is StoredMorfoItem => item !== null);
    const nextBank = mergeQuestionBank(morfoQuestionBank, validItems, (item) => normalizeTextToken(item.word));
    onMorfoQuestionBankChange(nextBank);
    return {
      saved: validItems.length,
      rejected: records.length - validItems.length,
      total: records.length,
    };
  };

  return (
    <section className="workspace bank-storage-page">
      <div className="bank-grid">
        <ManualBankPanel
          count={seQuestionBank.length}
          defaultOpen
          placeholder={SE_IMPORT_PLACEHOLDER}
          title="Valores del se"
          onClear={() => onSeQuestionBankChange([])}
          onImportText={importSeQuestionBank}
        />
        <ManualBankPanel
          count={periphrasisQuestionBank.length}
          defaultOpen
          placeholder={PERIPHRASIS_IMPORT_PLACEHOLDER}
          title="Perifrasis"
          onClear={() => onPeriphrasisQuestionBankChange([])}
          onImportText={importPeriphrasisQuestionBank}
        />
        <ManualBankPanel
          count={morfoQuestionBank.length}
          defaultOpen
          placeholder={MORFO_IMPORT_PLACEHOLDER}
          title="Morfologia"
          onClear={() => onMorfoQuestionBankChange([])}
          onImportText={importMorfoQuestionBank}
        />
      </div>
    </section>
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
      <div className="field-block">
        <FieldLabel label="Clave local del navegador" />
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

function orderSeCoverageValues(
  values: readonly string[],
  recentLabels: Array<{ value: string }>,
): string[] {
  const recentPositions = new Map<string, number>();
  recentLabels.forEach((entry, index) => {
    const key = normalizeTextToken(entry.value);
    if (!key || recentPositions.has(key)) {
      return;
    }
    recentPositions.set(key, index);
  });

  return uniqueLabels(values).sort((left, right) => {
    const leftPosition = recentPositions.get(normalizeTextToken(left)) ?? Number.MAX_SAFE_INTEGER;
    const rightPosition = recentPositions.get(normalizeTextToken(right)) ?? Number.MAX_SAFE_INTEGER;
    if (leftPosition !== rightPosition) {
      return rightPosition - leftPosition;
    }
    return left.localeCompare(right, "es", { sensitivity: "base" });
  });
}

function buildRequiredSeStrategy(value: string, mode: SeStrategy["mode"], ratioHint: string): SeStrategy {
  return {
    mode,
    targeted: true,
    focusValues: [value],
    requiredValue: value,
    targetValue: value,
    targetFunction: "",
    ratioHint,
  };
}

function seStrategyValues(strategy: SeStrategy): string[] {
  return uniqueLabels([
    strategy.requiredValue,
    strategy.targetValue,
    ...strategy.focusValues,
  ]);
}

export function NetlifyPracticeApp() {
  const [storageState, setStorageState] = useState<StorageState>(() => loadStorageState());
  const [activeSection, setActiveSection] = useState<SectionName>("se");
  const [sePage, setSePage] = useState<PageName>("practice");
  const [periphrasisPage, setPeriphrasisPage] = useState<PageName>("practice");
  const [morfoPage, setMorfoPage] = useState<PageName>("practice");

  useEffect(() => {
    saveStorageState(storageState);
  }, [storageState]);

  const updateSeSettings = (next: SeSettings) => {
    setStorageState((current) => ({ ...current, seSettings: next }));
  };

  const updateMorfoSettings = (next: MorfoSettings) => {
    setStorageState((current) => ({ ...current, morfoSettings: next }));
  };

  const updatePeriphrasisSettings = (next: PeriphrasisSettings) => {
    setStorageState((current) => ({ ...current, periphrasisSettings: next }));
  };

  const updateSeAttempts = (next: SeAttempt[]) => {
    setStorageState((current) => ({ ...current, seAttempts: next }));
  };

  const updateMorfoAttempts = (next: MorfoAttempt[]) => {
    setStorageState((current) => ({ ...current, morfoAttempts: next }));
  };

  const updatePeriphrasisAttempts = (next: PeriphrasisAttempt[]) => {
    setStorageState((current) => ({ ...current, periphrasisAttempts: next }));
  };

  const updateSeQuestionBank = (next: StoredSeItem[]) => {
    setStorageState((current) => ({ ...current, seQuestionBank: next }));
  };

  const updatePeriphrasisQuestionBank = (next: StoredPeriphrasisItem[]) => {
    setStorageState((current) => ({ ...current, periphrasisQuestionBank: next }));
  };

  const updateMorfoQuestionBank = (next: StoredMorfoItem[]) => {
    setStorageState((current) => ({ ...current, morfoQuestionBank: next }));
  };

  const updateGeminiApiKey = (next: string) => {
    setStorageState((current) => ({ ...current, geminiApiKey: next }));
  };

  const currentPage =
    activeSection === "se" ? sePage : activeSection === "perifrasis" ? periphrasisPage : morfoPage;
  const activeSectionMeta = SECTION_META[activeSection];
  const pageTitle = currentPage === "storage" ? "Bancos" : activeSectionMeta.title;

  const setPageForSection = (section: SectionName, page: PageName) => {
    if (section === "se") {
      setSePage(page);
      return;
    }
    if (section === "perifrasis") {
      setPeriphrasisPage(page);
      return;
    }
    setMorfoPage(page);
  };

  return (
    <div className="app-shell">
      <header className="globalnav">
        <div className="globalnav__inner">
          <button
            className="globalnav__brand"
            type="button"
            onClick={() => {
              setActiveSection("se");
              setSePage("practice");
            }}
          >
            <span className="globalnav__glyph">S</span>
            <span>Sintaxis WebApp</span>
          </button>

          <nav className="globalnav__menu" aria-label="Secciones">
            {SECTION_ORDER.map((section) => (
              <button
                key={section}
                aria-pressed={activeSection === section}
                className={cx("globalnav__link", activeSection === section && "globalnav__link--current")}
                type="button"
                onClick={() => setActiveSection(section)}
              >
                {SECTION_META[section].navLabel}
              </button>
            ))}
          </nav>

        </div>
      </header>

      <div className="app-frame">
        <section className="workspace-shell">
          <section className={cx("hero-banner", currentPage !== "storage" && activeSectionMeta.theme === "dark" && "hero-banner--dark")}>
            <div className="hero-banner__copy">
              <h1>{pageTitle}</h1>
              <div className="cta-links">
                {(Object.entries(PAGE_META) as Array<[PageName, PageMeta]>).map(([pageKey, pageMeta]) => (
                  <PageAction
                    key={pageKey}
                    active={currentPage === pageKey}
                    label={pageMeta.label}
                    onClick={() => setPageForSection(activeSection, pageKey)}
                  />
                ))}
              </div>
            </div>
          </section>

          <main className="main-stage">
            {currentPage === "storage" ? (
              <QuestionBankStoragePage
                morfoQuestionBank={storageState.morfoQuestionBank}
                morfoSettings={storageState.morfoSettings}
                periphrasisQuestionBank={storageState.periphrasisQuestionBank}
                periphrasisSettings={storageState.periphrasisSettings}
                seQuestionBank={storageState.seQuestionBank}
                seSettings={storageState.seSettings}
                onMorfoQuestionBankChange={updateMorfoQuestionBank}
                onPeriphrasisQuestionBankChange={updatePeriphrasisQuestionBank}
                onSeQuestionBankChange={updateSeQuestionBank}
              />
            ) : (
              <>
                <SeWorkspace
                  active={activeSection === "se"}
                  page={sePage}
                  settings={storageState.seSettings}
                  attempts={storageState.seAttempts}
                  questionBank={storageState.seQuestionBank}
                  apiKey={storageState.geminiApiKey}
                  onApiKeyChange={updateGeminiApiKey}
                  onSettingsChange={updateSeSettings}
                  onAttemptsChange={updateSeAttempts}
                />
                <PeriphrasisWorkspace
                  active={activeSection === "perifrasis"}
                  page={periphrasisPage}
                  settings={storageState.periphrasisSettings}
                  attempts={storageState.periphrasisAttempts}
                  questionBank={storageState.periphrasisQuestionBank}
                  apiKey={storageState.geminiApiKey}
                  onApiKeyChange={updateGeminiApiKey}
                  onSettingsChange={updatePeriphrasisSettings}
                  onAttemptsChange={updatePeriphrasisAttempts}
                />
                <MorfoWorkspace
                  active={activeSection === "morfologia"}
                  page={morfoPage}
                  settings={storageState.morfoSettings}
                  attempts={storageState.morfoAttempts}
                  questionBank={storageState.morfoQuestionBank}
                  apiKey={storageState.geminiApiKey}
                  onApiKeyChange={updateGeminiApiKey}
                  onSettingsChange={updateMorfoSettings}
                  onAttemptsChange={updateMorfoAttempts}
                />
              </>
            )}
          </main>
        </section>
      </div>
    </div>
  );
}

function SeWorkspace({
  active,
  page,
  settings,
  attempts,
  questionBank,
  apiKey,
  onApiKeyChange,
  onSettingsChange,
  onAttemptsChange,
}: {
  active: boolean;
  page: PageName;
  settings: SeSettings;
  attempts: SeAttempt[];
  questionBank: StoredSeItem[];
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
  const availableSeValues = useMemo(() => mergeLabelGroups(SE_VALUES, settings.customValues), [settings.customValues]);
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
  const [statusNote, setStatusNote] = useState("");
  const [statusTone, setStatusTone] = useState<"info" | "warn">("info");
  const [profileDraft, setProfileDraft] = useState(settings.profileId);
  const [selectedModelDraft, setSelectedModelDraft] = useState(
    MODEL_OPTIONS.some((option) => option.value === settings.modelName) ? settings.modelName : "custom",
  );
  const [customModelDraft, setCustomModelDraft] = useState(
    MODEL_OPTIONS.some((option) => option.value === settings.modelName) ? "" : settings.modelName,
  );
  const [customValueInput, setCustomValueInput] = useState("");

  const mixText = ratioLabel(settings.targetWeight, settings.normalWeight);
  const weakValueLabels = profile.weakValues.map((row) => row.label);
  const weakFunctionLabels = profile.weakFunctions.map((row) => row.label);
  const visibleAttempts = historyOnlyErrors ? profileAttempts.filter((attempt) => !attempt.overallOk) : profileAttempts;

  useEffect(() => {
    setGuessValue(availableSeValues[0] ?? SE_VALUES[0]);
    setGuessFunction(SE_FUNCTIONS[0]);
    setQuestionInput("");
  }, [availableSeValues, currentItem?.id]);

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
    const nextFocusValues = toggleLabel(settings.focusValues, value);
    setQueue([]);
    onSettingsChange({ ...settings, focusValues: nextFocusValues });
  };

  const addCustomValue = () => {
    const cleaned = customValueInput.trim();
    if (!cleaned || hasLabel(availableSeValues, cleaned)) {
      return;
    }
    onSettingsChange({
      ...settings,
      customValues: uniqueLabels([...settings.customValues, cleaned]),
      focusValues: uniqueLabels([...settings.focusValues, cleaned]),
    });
    setCustomValueInput("");
    setQueue([]);
  };

  const removeCustomValue = (value: string) => {
    const nextCustomValues = withoutLabel(settings.customValues, value);
    onSettingsChange({
      ...settings,
      customValues: nextCustomValues,
      focusValues: withoutLabel(settings.focusValues, value),
    });
    setQueue([]);
  };

  const updateItemSource = (itemSource: ItemSource) => {
    onSettingsChange({ ...settings, itemSource });
    setQueue([]);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let nextQueue = [...queue];
      if (nextQueue.length === 0) {
        const recentSentences = fetchRecentSeSentences(attempts, settings.profileId, 14);
        const recentLabels = fetchRecentSeLabels(attempts, settings.profileId, 10);
        const coverageValues = settings.focusValues.length > 0
          ? orderSeCoverageValues(settings.focusValues, recentLabels)
          : settings.personalized
            ? []
            : orderSeCoverageValues(availableSeValues, recentLabels);
        const batchSize = coercePracticeBatchSize(settings.batchSize);
        let workingBucket = [...mixBucket];
        const strategies: SeStrategy[] = [];

        for (let index = 0; index < batchSize; index += 1) {
          if (settings.focusValues.length > 0) {
            const requiredValue = coverageValues[index % coverageValues.length] ?? coverageValues[0];
            if (requiredValue) {
              strategies.push(buildRequiredSeStrategy(requiredValue, "foco_usuario", "100% foco"));
              continue;
            }
          }

          if (!settings.personalized) {
            const requiredValue = coverageValues[index];
            if (requiredValue) {
              strategies.push(buildRequiredSeStrategy(requiredValue, "normal", "Cobertura equilibrada del lote"));
              continue;
            }
          }

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

        const customValuePlanned = strategies.some((strategy) =>
          seStrategyValues(strategy).some((value) => value && !hasLabel(SE_VALUES, value)),
        );
        const fallbackItems = fallbackSeBatch(settings.difficulty, strategies, recentSentences);
        const prepared: Array<SeItem | null> = Array.from({ length: batchSize }, () => null);
        const seen = new Set<string>();
        const assignCandidate = (slotIndex: number, candidate: Omit<SeItem, "id"> | SeItem | null) => {
          if (!candidate || prepared[slotIndex]) {
            return;
          }
          const key = candidate.sentence.trim().toLowerCase();
          if (!key || seen.has(key)) {
            return;
          }
          seen.add(key);
          prepared[slotIndex] = "id" in candidate ? candidate : { ...candidate, id: createId("se") };
        };

        if (settings.itemSource === "manual") {
          const manualItems = manualSeBatch(settings.difficulty, strategies, recentSentences, questionBank);
          manualItems.forEach((item, index) => assignCandidate(index, item));
          const manualValidCount = manualItems.filter((item) => item !== null).length;
          setStatusNote(manualValidCount > 0 ? "" : "Banco manual sin items validos para esta seccion.");
          setStatusTone(manualValidCount > 0 ? "info" : "warn");
        } else {
          try {
            const remoteItems = await requestSeGeneration({
              apiKey,
              modelName: settings.modelName,
              difficulty: settings.difficulty,
              strategies,
              profile,
              recentSentences,
              recentLabels,
              allowedValues: availableSeValues,
              allowedFunctions: [...SE_FUNCTIONS],
              allowedVerbalStructures: [...SE_VERBAL_STRUCTURES],
              allowedPeriphrasisTypes: [...SE_PERIPHRASIS_TYPES],
            });
            strategies.forEach((_, index) => {
              assignCandidate(index, remoteItems[index] ?? null);
              assignCandidate(index, fallbackItems[index] ?? null);
            });
            const remoteValidCount = remoteItems.filter((item) => item !== null).length;
            setStatusNote(remoteValidCount > 0 ? "" : "Gemini no devolvio valores validos.");
            setStatusTone(remoteValidCount > 0 ? "info" : "warn");
          } catch (error) {
            fallbackItems.forEach((item, index) => assignCandidate(index, item));
            setStatusNote(
              customValuePlanned
                ? "Los valores personalizados necesitan Gemini."
                : error instanceof Error
                  ? `${error.message} Banco local.`
                  : "Banco local.",
            );
            setStatusTone("warn");
          }

          while (prepared.some((item) => item === null)) {
            const extraFallback = fallbackSeBatch(settings.difficulty, strategies, recentSentences);
            const beforeMissing = prepared.filter((item) => item === null).length;
            extraFallback.forEach((item, index) => assignCandidate(index, item));
            const afterMissing = prepared.filter((item) => item === null).length;
            if (afterMissing === beforeMissing) {
              break;
            }
          }
        }

        const finalized = prepared.filter((item): item is SeItem => item !== null);
        if (finalized.length < batchSize) {
          setStatusNote(customValuePlanned ? "Los valores personalizados necesitan Gemini." : "Lote incompleto.");
          setStatusTone("warn");
        }

        nextQueue = settings.personalized ? finalized : shuffleList(finalized);
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
    const evaluation = evaluateSeGuess(currentItem, guessValue, guessFunction, currentItem.verbalStructure, currentItem.periphrasisType);
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
        verbalStructure: currentItem.verbalStructure,
        periphrasisType: currentItem.periphrasisType,
        phraseType: currentItem.phraseType,
        explanation: currentItem.explanation,
        allowedValues: availableSeValues,
        allowedFunctions: [...SE_FUNCTIONS],
        allowedVerbalStructures: [...SE_VERBAL_STRUCTURES],
        allowedPeriphrasisTypes: [...SE_PERIPHRASIS_TYPES],
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
          correctedVerbalStructure: currentItem.verbalStructure,
          correctedPeriphrasisType: currentItem.periphrasisType,
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
          verbalStructure: currentItem.verbalStructure,
          periphrasisType: currentItem.periphrasisType,
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
      {page === "practice" ? (
        <div className="page-grid">
          <div className="panel control-panel">
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

            <BatchSizeControl
              value={settings.batchSize}
              onChange={(batchSize) => onSettingsChange({ ...settings, batchSize })}
            />

            <SourceToggle source={settings.itemSource} manualCount={questionBank.length} onChange={updateItemSource} />

            <div className="field-block">
              <FieldLabel label="Valores" />
              <MultiToggleList options={availableSeValues} selected={settings.focusValues} onToggle={toggleFocusValue} />

              <div className="custom-value-editor">
                <div className="custom-value-form">
                  <input
                    aria-label="Valor personalizado"
                    placeholder="Nuevo valor"
                    value={customValueInput}
                    onChange={(event) => setCustomValueInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomValue();
                      }
                    }}
                  />
                  <button className="ghost-btn" disabled={!customValueInput.trim()} type="button" onClick={addCustomValue}>
                    Anadir
                  </button>
                </div>
                {settings.customValues.length > 0 ? (
                  <div className="custom-value-list">
                    {settings.customValues.map((value) => (
                      <span className="custom-value-chip" key={value}>
                        {value}
                        <button aria-label={`Quitar ${value}`} type="button" onClick={() => removeCustomValue(value)}>
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
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

            {statusNote ? <div className={cx("inline-banner", statusTone === "warn" && "warn")}>{statusNote}</div> : null}

            <button className="primary-btn" disabled={isGenerating} type="button" onClick={handleGenerate}>
              {isGenerating ? "Preparando lote..." : queue.length > 0 ? "Siguiente frase" : "Generar lote"}
            </button>
          </div>

          <div className="panel practice-panel">
            {!currentItem ? (
              <div className="empty-state">
                <h3>Genera una frase para empezar.</h3>
              </div>
            ) : (
              <>
                <h3 className="prompt-text">{currentItem.sentence}</h3>
                <div className="field-grid">
                  <div>
                    <FieldLabel label="Valor de se" />
                    <select value={guessValue} onChange={(event) => setGuessValue(event.target.value)}>
                      {availableSeValues.map((value) => (
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
                      <p>{currentItem.phraseType}</p>
                      <p>{currentItem.explanation}</p>
                    </div>

                    <div className="button-row">
                      <button className="ghost-btn" disabled={isRechecking} type="button" onClick={handleRecheck}>
                        {isRechecking ? "Revisando..." : "Revisar"}
                      </button>
                    </div>

                    {recheck ? (
                      <div className="info-block">
                        {recheck.success ? (
                          <>
                            <p className={recheck.isCorrect ? "result-ok" : "result-bad"}>
                              {recheck.isCorrect ? `OK (${recheck.model})` : `Revisar (${recheck.model})`}
                            </p>
                            {!recheck.isCorrect ? (
                              <p>
                                {recheck.correctedValue} | {recheck.correctedFunction}
                              </p>
                            ) : null}
                            {recheck.issues && recheck.issues.length > 0 ? (
                              <ul>
                                {recheck.issues.map((issue) => (
                                  <li key={issue}>{issue}</li>
                                ))}
                              </ul>
                            ) : null}
                            {recheck.correctionNote ? <p>{recheck.correctionNote}</p> : null}
                          </>
                        ) : (
                          <p className="result-bad">{recheck.error}</p>
                        )}
                      </div>
                    ) : null}

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
              <p>Historial oculto para esta seccion.</p>
            ) : (
              <>
                <div className="row-between">
                  <p>
                    Intentos totales: {profile.totalAttempts} | Acierto completo: {seAccuracy(profileAttempts).toFixed(1)}%
                  </p>
                  <label className="checkbox-line">
                    <input checked={historyOnlyErrors} onChange={(event) => setHistoryOnlyErrors(event.target.checked)} type="checkbox" />
                    <span>Mostrar solo fallos</span>
                  </label>
                </div>

                <div className="stats-grid">
                  <div className="info-block">
                    <h4 className="section-heading">Mas dificiles (valor)</h4>
                    <SummaryList rows={profile.weakValues} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">Mas dificiles (funcion)</h4>
                    <SummaryList rows={profile.weakFunctions} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">Mejores (valor)</h4>
                    <SummaryList rows={profile.strongValues} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">Mejores (funcion)</h4>
                    <SummaryList rows={profile.strongFunctions} />
                  </div>
                </div>

                <div className="stack-lg">
                  <div>
                    <h4 className="section-heading">Rendimiento exacto por valor y funcion</h4>
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
                    <h4 className="section-heading">Combinaciones donde mas fallas</h4>
                    <DataTable
                      headers={["Par", "OK", "Fallos", "Intentos", "Tasa fallo"]}
                      rows={profile.weakPairs.map((row) => [row.pair, row.ok, row.fail, row.attempts, `${(row.failRate * 100).toFixed(1)}%`])}
                    />
                  </div>

                  <div>
                    <h4 className="section-heading">Intentos guardados</h4>
                    <DataTable
                      headers={["Fecha", "Frase", "Esperado", "Tu respuesta", "Estado", "Modo"]}
                      rows={visibleAttempts.map((attempt) => [
                        new Date(attempt.createdAt).toLocaleString(),
                        attempt.sentence,
                        `${attempt.expectedValue} / ${attempt.expectedFunction}`,
                        `${attempt.guessValue} / ${attempt.guessFunction}`,
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

            {settings.modelName.toLowerCase().startsWith("gemma") ? (
              <div className="info-block">
                <p>Gemma activa.</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PeriphrasisWorkspace({
  active,
  page,
  settings,
  attempts,
  questionBank,
  apiKey,
  onApiKeyChange,
  onSettingsChange,
  onAttemptsChange,
}: {
  active: boolean;
  page: PageName;
  settings: PeriphrasisSettings;
  attempts: PeriphrasisAttempt[];
  questionBank: StoredPeriphrasisItem[];
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  onSettingsChange: (settings: PeriphrasisSettings) => void;
  onAttemptsChange: (attempts: PeriphrasisAttempt[]) => void;
}) {
  const profile = useMemo(() => periphrasisLearningProfile(attempts, settings.profileId), [attempts, settings.profileId]);
  const profileAttempts = useMemo(
    () => attempts.filter((attempt) => attempt.profileId === settings.profileId),
    [attempts, settings.profileId],
  );
  const availablePeriphrasisTypes = useMemo(
    () => mergeLabelGroups(PERIPHRASIS_TYPES, settings.customPeriphrasisTypes),
    [settings.customPeriphrasisTypes],
  );
  const noAplicaPeriphrasisType = useMemo(
    () => availablePeriphrasisTypes.find((value) => normalizeTextToken(value) === normalizeTextToken("No aplica")) ?? "No aplica",
    [availablePeriphrasisTypes],
  );

  const [currentItem, setCurrentItem] = useState<PeriphrasisItem | null>(null);
  const [queue, setQueue] = useState<PeriphrasisItem[]>([]);
  const [checkedItemId, setCheckedItemId] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, PeriphrasisEvaluation>>({});
  const [guessStructure, setGuessStructure] = useState<string>(PERIPHRASIS_STRUCTURES[0]);
  const [guessPeriphrasisType, setGuessPeriphrasisType] = useState<string>(PERIPHRASIS_TYPES[0]);
  const [mixBucket, setMixBucket] = useState<boolean[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [historyOnlyErrors, setHistoryOnlyErrors] = useState(true);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [profileDraft, setProfileDraft] = useState(settings.profileId);
  const [selectedModelDraft, setSelectedModelDraft] = useState(
    MODEL_OPTIONS.some((option) => option.value === settings.modelName) ? settings.modelName : "custom",
  );
  const [customModelDraft, setCustomModelDraft] = useState(
    MODEL_OPTIONS.some((option) => option.value === settings.modelName) ? "" : settings.modelName,
  );
  const [customTypesDraft, setCustomTypesDraft] = useState(settings.customPeriphrasisTypes.join(", "));
  const [customTypeInput, setCustomTypeInput] = useState("");

  const mixText = ratioLabel(settings.targetWeight, settings.normalWeight);
  const weakStructureLabels = profile.weakStructures.map((row) => row.label);
  const weakPeriphrasisTypeLabels = profile.weakPeriphrasisTypes.map((row) => row.label);
  const visibleAttempts = historyOnlyErrors ? profileAttempts.filter((attempt) => !attempt.overallOk) : profileAttempts;

  useEffect(() => {
    setGuessStructure(PERIPHRASIS_STRUCTURES[0]);
    setGuessPeriphrasisType(noAplicaPeriphrasisType);
  }, [currentItem?.id, noAplicaPeriphrasisType]);

  useEffect(() => {
    setProfileDraft(settings.profileId);
    if (MODEL_OPTIONS.some((option) => option.value === settings.modelName)) {
      setSelectedModelDraft(settings.modelName);
      setCustomModelDraft("");
    } else {
      setSelectedModelDraft("custom");
      setCustomModelDraft(settings.modelName);
    }
    setCustomTypesDraft(settings.customPeriphrasisTypes.join(", "));
  }, [settings.customPeriphrasisTypes, settings.modelName, settings.profileId]);

  useEffect(() => {
    setMixBucket([]);
  }, [settings.targetWeight, settings.normalWeight]);

  const toggleFocusStructure = (value: string) => {
    onSettingsChange({
      ...settings,
      focusStructures: toggleLabel(settings.focusStructures, value),
    });
  };

  const addCustomPeriphrasisType = () => {
    const cleaned = customTypeInput.trim();
    if (!cleaned || hasLabel(availablePeriphrasisTypes, cleaned)) {
      return;
    }
    onSettingsChange({
      ...settings,
      customPeriphrasisTypes: [...settings.customPeriphrasisTypes, cleaned],
    });
    setCustomTypeInput("");
  };

  const updateItemSource = (itemSource: ItemSource) => {
    onSettingsChange({ ...settings, itemSource });
    setQueue([]);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let nextQueue = [...queue];
      if (nextQueue.length === 0) {
        const batchSize = coercePracticeBatchSize(settings.batchSize);
        let workingBucket = [...mixBucket];
        const strategies: PeriphrasisStrategy[] = [];

        for (let index = 0; index < batchSize; index += 1) {
          let forceTargeted: boolean | undefined;
          if (
            settings.personalized &&
            settings.focusStructures.length === 0 &&
            (weakStructureLabels.length > 0 || weakPeriphrasisTypeLabels.length > 0)
          ) {
            const [targeted, nextBucket] = popMixTargeted(workingBucket, settings.targetWeight, settings.normalWeight);
            forceTargeted = targeted;
            workingBucket = nextBucket;
          }

          strategies.push(
            choosePeriphrasisTarget(profile, settings.focusStructures, settings.personalized, forceTargeted, mixText),
          );
        }

        setMixBucket(workingBucket);
        const recentSentences = fetchRecentPeriphrasisSentences(attempts, settings.profileId, 14);
        const recentLabels = fetchRecentPeriphrasisLabels(attempts, settings.profileId, 10);
        const fallbackItems = fallbackPeriphrasisBatch(settings.difficulty, strategies, recentSentences);
        const prepared: Array<PeriphrasisItem | null> = Array.from({ length: batchSize }, () => null);
        const seen = new Set<string>();
        const assignCandidate = (slotIndex: number, candidate: Omit<PeriphrasisItem, "id"> | PeriphrasisItem | null) => {
          if (!candidate || prepared[slotIndex]) {
            return;
          }
          const key = candidate.sentence.trim().toLowerCase();
          if (!key || seen.has(key)) {
            return;
          }
          seen.add(key);
          prepared[slotIndex] = "id" in candidate ? candidate : { ...candidate, id: createId("perifrasis") };
        };

        if (settings.itemSource === "manual") {
          const manualItems = manualPeriphrasisBatch(settings.difficulty, strategies, recentSentences, questionBank);
          manualItems.forEach((item, index) => assignCandidate(index, item));
          const manualValidCount = manualItems.filter((item) => item !== null).length;
          setStatusNote(manualValidCount > 0 ? "" : "Banco manual sin items validos para esta seccion.");
        } else {
          try {
            const remoteItems = await requestPeriphrasisGeneration({
              apiKey,
              modelName: settings.modelName,
              difficulty: settings.difficulty,
              strategies,
              profile,
              recentSentences,
              recentLabels,
              allowedStructures: [...PERIPHRASIS_STRUCTURES],
              allowedPeriphrasisTypes: availablePeriphrasisTypes,
            });
            strategies.forEach((_, index) => {
              assignCandidate(index, remoteItems[index] ?? null);
              assignCandidate(index, fallbackItems[index] ?? null);
            });
            const remoteValidCount = remoteItems.filter((item) => item !== null).length;
            setStatusNote(remoteValidCount > 0 ? "" : "Gemini no devolvio items validos.");
          } catch (error) {
            fallbackItems.forEach((item, index) => assignCandidate(index, item));
            setStatusNote(error instanceof Error ? `${error.message} Banco local.` : "Banco local.");
          }

          while (prepared.some((item) => item === null)) {
            const extraRecentSentences = [
              ...recentSentences,
              ...prepared.filter((item): item is PeriphrasisItem => item !== null).map((item) => item.sentence),
            ];
            const extraFallback = fallbackPeriphrasisBatch(settings.difficulty, strategies, extraRecentSentences);
            const beforeMissing = prepared.filter((item) => item === null).length;
            extraFallback.forEach((item, index) => assignCandidate(index, item));
            const afterMissing = prepared.filter((item) => item === null).length;
            if (afterMissing === beforeMissing) {
              break;
            }
          }
        }

        const finalized = prepared.filter((item): item is PeriphrasisItem => item !== null);
        if (finalized.length < batchSize) {
          setStatusNote("Lote incompleto.");
        }
        nextQueue = settings.personalized ? finalized : shuffleList(finalized);
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
    const evaluation = evaluatePeriphrasisGuess(currentItem, guessStructure, guessPeriphrasisType);
    setEvaluations((current) => ({ ...current, [currentItem.id]: evaluation }));

    if (checkedItemId !== currentItem.id) {
      onAttemptsChange([...attempts, makePeriphrasisAttempt(currentItem, settings, evaluation)]);
      setCheckedItemId(currentItem.id);
    }
  };

  const saveSettingsDraft = () => {
    const nextCustomTypes = stripBaseLabels(parseCustomList(customTypesDraft), PERIPHRASIS_TYPES);
    const resolvedModel = selectedModelDraft === "custom" ? customModelDraft.trim() || MODEL_OPTIONS[0].value : selectedModelDraft;
    onSettingsChange({
      ...settings,
      profileId: profileDraft.trim() || "alumno",
      modelName: resolvedModel,
      customPeriphrasisTypes: nextCustomTypes,
    });
  };

  const evaluation = currentItem ? evaluations[currentItem.id] : null;

  return (
    <section className={cx("workspace", !active && "hidden-workspace")}>
      {page === "practice" ? (
        <div className="page-grid">
          <div className="panel control-panel">
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

            <BatchSizeControl
              value={settings.batchSize}
              onChange={(batchSize) => onSettingsChange({ ...settings, batchSize })}
            />

            <SourceToggle source={settings.itemSource} manualCount={questionBank.length} onChange={updateItemSource} />

            <div className="field-block">
              <FieldLabel label="Estructuras" />
              <MultiToggleList options={PERIPHRASIS_STRUCTURES} selected={settings.focusStructures} onToggle={toggleFocusStructure} />
            </div>

            <div className="field-block">
              <FieldLabel label="Anadir tipo personalizado" hint="Ej. Obligacion atenuada. Se guarda en esta seccion." />
              <div className="field-grid compact-grid">
                <input
                  placeholder="Ej. Obligacion atenuada"
                  value={customTypeInput}
                  onChange={(event) => setCustomTypeInput(event.target.value)}
                />
                <button className="ghost-btn" type="button" onClick={addCustomPeriphrasisType}>
                  Anadir tipo
                </button>
              </div>
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

            {statusNote ? <div className="inline-banner">{statusNote}</div> : null}

            <button className="primary-btn" disabled={isGenerating} type="button" onClick={handleGenerate}>
              {isGenerating ? "Preparando lote..." : queue.length > 0 ? "Siguiente frase" : "Generar lote"}
            </button>

            {settings.personalized && (weakStructureLabels.length > 0 || weakPeriphrasisTypeLabels.length > 0) ? (
              <div className="info-block">
                <p>
                  Construcciones: {weakStructureLabels.join(", ") || "-"}
                  <br />
                  Tipos de perifrasis: {weakPeriphrasisTypeLabels.join(", ") || "-"}
                </p>
              </div>
            ) : null}
          </div>

          <div className="panel practice-panel">
            {!currentItem ? (
              <div className="empty-state">
                <h3>Genera una frase para empezar.</h3>
              </div>
            ) : (
              <>
                <h3 className="prompt-text">{currentItem.sentence}</h3>
                <div className="field-grid">
                  <div>
                    <FieldLabel label="Construccion verbal" />
                    <select
                      value={guessStructure}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setGuessStructure(nextValue);
                        if (nextValue !== "Perifrasis verbal") {
                          setGuessPeriphrasisType(noAplicaPeriphrasisType);
                        }
                      }}
                    >
                      {PERIPHRASIS_STRUCTURES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel label="Tipo de perifrasis" hint="Si no hay perifrasis, usa 'No aplica'." />
                    <select
                      disabled={guessStructure !== "Perifrasis verbal"}
                      value={guessPeriphrasisType}
                      onChange={(event) => setGuessPeriphrasisType(event.target.value)}
                    >
                      {availablePeriphrasisTypes.map((value) => (
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
                        Construccion verbal:{" "}
                        <strong className={evaluation.structureOk ? "result-ok" : "result-bad"}>
                          {evaluation.structureOk ? "correcta" : `incorrecta (correcta: ${currentItem.verbalStructure})`}
                        </strong>
                      </p>
                      <p>
                        Tipo de perifrasis:{" "}
                        <strong className={evaluation.periphrasisTypeOk ? "result-ok" : "result-bad"}>
                          {evaluation.periphrasisTypeOk ? "correcto" : `incorrecto (correcto: ${currentItem.periphrasisType})`}
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
                      <p>{currentItem.phraseType}</p>
                      <p>{currentItem.explanation}</p>
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
              <p>Historial oculto para esta seccion.</p>
            ) : (
              <>
                <div className="row-between">
                  <p>
                    Intentos totales: {profile.totalAttempts} | Acierto completo: {periphrasisAccuracy(profileAttempts).toFixed(1)}%
                  </p>
                  <label className="checkbox-line">
                    <input checked={historyOnlyErrors} onChange={(event) => setHistoryOnlyErrors(event.target.checked)} type="checkbox" />
                    <span>Mostrar solo fallos</span>
                  </label>
                </div>

                <div className="stats-grid">
                  <div className="info-block">
                    <h4 className="section-heading">Mas dificiles (estructura)</h4>
                    <SummaryList rows={profile.weakStructures} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">Mas dificiles (tipo)</h4>
                    <SummaryList rows={profile.weakPeriphrasisTypes} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">Mejores (estructura)</h4>
                    <SummaryList rows={profile.strongStructures} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">Mejores (tipo)</h4>
                    <SummaryList rows={profile.strongPeriphrasisTypes} />
                  </div>
                </div>

                <div className="stack-lg">
                  <div>
                    <h4 className="section-heading">Rendimiento exacto por eje</h4>
                    <DataTable
                      headers={["Eje", "Item", "OK", "Fallos", "Intentos", "Tasa fallo"]}
                      rows={[
                        ...profile.structureOverview.map((row) => [
                          "estructura",
                          row.label,
                          row.ok,
                          row.fail,
                          row.attempts,
                          `${(row.failRate * 100).toFixed(1)}%`,
                        ]),
                        ...profile.periphrasisTypeOverview.map((row) => [
                          "tipo",
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
                    <h4 className="section-heading">Combinaciones donde mas fallas</h4>
                    <DataTable
                      headers={["Par", "OK", "Fallos", "Intentos", "Tasa fallo"]}
                      rows={profile.weakPairs.map((row) => [row.pair, row.ok, row.fail, row.attempts, `${(row.failRate * 100).toFixed(1)}%`])}
                    />
                  </div>

                  <div>
                    <h4 className="section-heading">Intentos guardados</h4>
                    <DataTable
                      headers={["Fecha", "Frase", "Esperado", "Tu respuesta", "Estado", "Modo"]}
                      rows={visibleAttempts.map((attempt) => [
                        new Date(attempt.createdAt).toLocaleString(),
                        attempt.sentence,
                        `${attempt.expectedStructure} / ${attempt.expectedPeriphrasisType}`,
                        `${attempt.guessStructure} / ${attempt.guessPeriphrasisType}`,
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
                      onAttemptsChange(resetPeriphrasisAttempts(attempts, settings.profileId));
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

            <div>
              <FieldLabel
                label="Tipos de perifrasis personalizados"
                hint="Separados por comas. Se suman a la lista base y tambien aparecen en Practicar."
              />
              <input
                placeholder="Ej. Obligacion atenuada, enfatica"
                value={customTypesDraft}
                onChange={(event) => setCustomTypesDraft(event.target.value)}
              />
            </div>

            <button className="primary-btn" type="button" onClick={saveSettingsDraft}>
              Guardar ajustes
            </button>

            <GeminiKeyPanel apiKey={apiKey} onApiKeyChange={onApiKeyChange} />

            {settings.modelName.toLowerCase().startsWith("gemma") ? (
              <div className="info-block">
                <p>Gemma activa.</p>
              </div>
            ) : null}
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
  questionBank,
  apiKey,
  onApiKeyChange,
  onSettingsChange,
  onAttemptsChange,
}: {
  active: boolean;
  page: PageName;
  settings: MorfoSettings;
  attempts: MorfoAttempt[];
  questionBank: StoredMorfoItem[];
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
  const [statusNote, setStatusNote] = useState("");
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

  const updateItemSource = (itemSource: ItemSource) => {
    onSettingsChange({ ...settings, itemSource });
    setQueue([]);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      let nextQueue = [...queue];
      if (nextQueue.length === 0) {
        const batchSize = coercePracticeBatchSize(settings.batchSize);
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

        if (settings.itemSource === "manual") {
          const manualItems = manualMorfoBatch(settings.difficulty, strategies, recentWords, questionBank);
          manualItems.forEach((item) => {
            if (item) {
              pushCandidate(item);
            }
          });
          const manualValidCount = manualItems.filter((item) => item !== null).length;
          setStatusNote(manualValidCount > 0 ? "" : "Banco manual sin items validos para esta seccion.");
          setStatusTone(manualValidCount > 0 ? "info" : "warn");
        } else {
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
            setStatusNote(remoteItems.length > 0 ? "" : "Gemini no devolvio items validos.");
            setStatusTone(remoteItems.length > 0 ? "info" : "warn");
          } catch (error) {
            fallbackItems.forEach(pushCandidate);
            setStatusNote(error instanceof Error ? `${error.message} Banco local.` : "Banco local.");
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
  const acceptedLexemeLabels = currentItem ? acceptedLexemesForItem(currentItem) : [];

  return (
    <section className={cx("workspace", !active && "hidden-workspace")}>
      {page === "practice" ? (
        <div className="page-grid">
          <div className="panel control-panel">
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

            <BatchSizeControl
              value={settings.batchSize}
              onChange={(batchSize) => onSettingsChange({ ...settings, batchSize })}
            />

            <SourceToggle source={settings.itemSource} manualCount={questionBank.length} onChange={updateItemSource} />

            <div className="field-block">
              <FieldLabel label="Tipos" />
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

            {statusNote ? <div className={cx("inline-banner", statusTone === "warn" && "warn")}>{statusNote}</div> : null}

            <button className="primary-btn" disabled={isGenerating} type="button" onClick={handleGenerate}>
              {isGenerating ? "Preparando lote..." : queue.length > 0 ? "Siguiente palabra" : "Generar lote"}
            </button>

            {settings.personalized && (weakWordTypeLabels.length > 0 || weakMorphemeTypeLabels.length > 0) ? (
              <div className="info-block">
                <p>
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
              </div>
            ) : (
              <>
                <h3 className="prompt-text">{currentItem.word}</h3>
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
                    <FieldLabel label="Morfemas" hint="Sin contar el lexema; separados por coma." />
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
                          {evaluation.lexemeOk ? "correcto" : `incorrecto (aceptados: ${acceptedLexemeLabels.join(", ")})`}
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
                      <p>{currentItem.analysisType}</p>
                      <p>{currentItem.explanation}</p>
                    </div>

                    <div className="button-row">
                      <button className="ghost-btn" disabled={isRechecking} type="button" onClick={handleRecheck}>
                        {isRechecking ? "Revisando..." : "Revisar"}
                      </button>
                    </div>

                    {recheck ? (
                      <div className="info-block">
                        {recheck.success ? (
                          <>
                            <p className={recheck.isCorrect ? "result-ok" : "result-bad"}>
                              {recheck.isCorrect ? `OK (${recheck.model})` : `Revisar (${recheck.model})`}
                            </p>
                            {!recheck.isCorrect ? (
                              <p>
                                {recheck.correctedWordType} | {recheck.correctedLexeme}
                              </p>
                            ) : null}
                            {recheck.correctedMorphemes && recheck.correctedMorphemes.length > 0 ? (
                              <p>{recheck.correctedMorphemes.join(", ")}</p>
                            ) : null}
                            {recheck.correctedMorphemeTypes && recheck.correctedMorphemeTypes.length > 0 ? (
                              <p>{recheck.correctedMorphemeTypes.join(", ")}</p>
                            ) : null}
                            {recheck.issues && recheck.issues.length > 0 ? (
                              <ul>
                                {recheck.issues.map((issue) => (
                                  <li key={issue}>{issue}</li>
                                ))}
                              </ul>
                            ) : null}
                            {recheck.correctionNote ? <p>{recheck.correctionNote}</p> : null}
                          </>
                        ) : (
                          <p className="result-bad">{recheck.error}</p>
                        )}
                      </div>
                    ) : null}

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
              <p>Historial oculto para esta seccion.</p>
            ) : (
              <>
                <div className="row-between">
                  <p>Intentos totales: {profile.totalAttempts}</p>
                  <label className="checkbox-line">
                    <input checked={historyOnlyErrors} onChange={(event) => setHistoryOnlyErrors(event.target.checked)} type="checkbox" />
                    <span>Mostrar solo fallos</span>
                  </label>
                </div>

                <div className="stats-grid">
                  <div className="info-block">
                    <h4 className="section-heading">Mas dificiles (tipo)</h4>
                    <SummaryList rows={profile.weakWordTypes} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">Mas dificiles (morfema)</h4>
                    <SummaryList rows={profile.weakMorphemeTypes} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">Mejores (tipo)</h4>
                    <SummaryList rows={profile.strongWordTypes} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">Mejores (morfema)</h4>
                    <SummaryList rows={profile.strongMorphemeTypes} />
                  </div>
                </div>

                <div className="stack-lg">
                  <div>
                    <h4 className="section-heading">Rendimiento exacto por tipo y morfema</h4>
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
                    <h4 className="section-heading">Combinaciones donde mas fallas</h4>
                    <DataTable
                      headers={["Par", "OK", "Fallos", "Intentos", "Tasa fallo"]}
                      rows={profile.weakPairs.map((row) => [row.pair, row.ok, row.fail, row.attempts, `${(row.failRate * 100).toFixed(1)}%`])}
                    />
                  </div>

                  <div>
                    <h4 className="section-heading">Intentos guardados</h4>
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

            {settings.modelName.toLowerCase().startsWith("gemma") ? (
              <div className="info-block">
                <p>Gemma activa.</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
