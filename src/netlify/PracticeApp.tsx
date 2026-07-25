import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";

import {
  CATALAN_DECKS_UPDATED_EVENT,
  CatalanPracticeApp,
  catalanAccentBaseWord,
  displayCatalanPrompt,
  expectedCatalanAccentIndices,
  expectedCatalanAccentInput,
  isCatalanAccentCard,
  loadBuiltInCatalanDecks,
  loadImportedCatalanDecks,
  loadStoredCatalanProgress,
  normalizeCatalanAnswer,
  previewCatalanMaskedWord,
  saveStoredCatalanProgress,
  updateCatalanProgressWithAttempt,
} from "./CatalanPracticeApp";
import type { CatalanCard, CatalanDeck } from "./CatalanPracticeApp";
import { PhilosophyPracticeApp } from "./PhilosophyPracticeApp";
import { PHILOSOPHY_CARDS, type PhilosophyCard } from "./philosophyData";
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
  DAILY_CHALLENGE_SECTIONS,
  acceptedLexemesForItem,
  chooseMorfoTarget,
  choosePeriphrasisTarget,
  chooseSeTarget,
  coercePracticeBatchSize,
  createId,
  evaluateMorfoGuess,
  evaluatePeriphrasisGuess,
  evaluateSeGuess,
  fetchRecentDerivativeFunctions,
  fetchRecentMorfoWords,
  fetchRecentPeriphrasisSentences,
  fetchRecentSeLabels,
  fetchRecentSeSentences,
  fetchRecentSintaxisPhrases,
  loadStorageState,
  makeDerivativeAttempt,
  makeMorfoAttempt,
  makePeriphrasisAttempt,
  makeSeAttempt,
  makeSintaxisAttempt,
  manualMorfoBatch,
  manualDerivativeBatch,
  manualPeriphrasisBatch,
  manualSeBatch,
  manualSintaxisBatch,
  MAX_PRACTICE_BATCH_SIZE,
  MIN_PRACTICE_BATCH_SIZE,
  morfoLearningProfile,
  normalizeTextToken,
  periphrasisAccuracy,
  periphrasisLearningProfile,
  popMixTargeted,
  resetDerivativeAttempts,
  resetMorfoAttempts,
  resetPeriphrasisAttempts,
  resetSeAttempts,
  resetSintaxisAttempts,
  saveStorageState,
  seAccuracy,
  seLearningProfile,
} from "./logic";
import {
  sanitizeUploadedDerivativeItem,
  requestMorfoQuestion,
  requestMorfoRecheck,
  sanitizeUploadedMorfoItem,
  sanitizeUploadedPeriphrasisItem,
  sanitizeUploadedSeItem,
  sanitizeUploadedSintaxisItem,
  requestSeQuestion,
  requestSeRecheck,
} from "./api";
import {
  getUiText,
  UI_LANGUAGE_OPTIONS,
  UiTextProvider,
  useUiText,
  type UiLanguage,
  type UiText,
} from "./uiLanguage";
import type {
  DailyChallengeRecord,
  DailyChallengeSection,
  DailyChallengeSettings,
  DerivativeAttempt,
  DerivativeItem,
  DerivativeSettings,
  MorfoAttempt,
  MorfoEvaluation,
  MorfoItem,
  MorfoSettings,
  MorfoStrategy,
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
  SintaxisAttempt,
  SintaxisItem,
  SintaxisSettings,
  StorageState,
  StoredDerivativeItem,
  StoredMorfoItem,
  StoredPeriphrasisItem,
  StoredSeItem,
  StoredSintaxisItem,
  SummaryRow,
} from "./types";

type SectionName = "se" | "perifrasis" | "morfologia" | "sintaxis" | "derivative" | "catalan" | "philosophy";
type PageName = "practice" | "history" | "settings" | "storage";
type SectionPageName = Exclude<PageName, "settings" | "storage">;

interface SectionMeta {
  theme?: "light" | "dark";
}

const SECTION_ORDER: SectionName[] = ["se", "perifrasis", "morfologia", "sintaxis", "derivative", "catalan", "philosophy"];

const SECTION_PAGE_ORDER: SectionPageName[] = ["practice", "history"];

const SECTION_META: Record<SectionName, SectionMeta> = {
  se: {},
  perifrasis: {},
  morfologia: {
    theme: "dark",
  },
  sintaxis: {},
  derivative: {},
  catalan: {},
  philosophy: {},
};

const SE_IMPORT_PLACEHOLDER = `{"items":[{"sentence":"Se venden pisos en este barrio.","difficulty":2,"se_value":"Pasiva refleja","se_function":"Marca de pasiva","accepted_functions":["Marca de pasiva","Sin funcion sintactica propia"],"verbal_structure":"Verbo simple","periphrasis_type":"No aplica","phrase_type":"Oracion simple pasiva refleja","explanation":"El verbo concuerda con el sujeto paciente 'pisos'."}]}`;
const PERIPHRASIS_IMPORT_PLACEHOLDER = `{"items":[{"sentence":"Debes entregar el informe antes del viernes.","difficulty":2,"verbal_structure":"Perifrasis verbal","periphrasis_type":"Modal obligativa","phrase_type":"Oracion simple predicativa","explanation":"'Deber + infinitivo' expresa obligacion."}]}`;
const MORFO_IMPORT_PLACEHOLDER = `{"items":[{"word":"desordenados","difficulty":2,"word_type":"Adjetivo","lexeme":"orden","accepted_lexemes":["orden"],"morphemes":["des","ad","o","s"],"morpheme_types":["Prefijo derivativo","Sufijo derivativo","Morfema flexivo nominal (genero)","Morfema flexivo nominal (numero)"],"analysis_type":"Adjetivo con derivacion y flexion","explanation":"Prefijo des- + lexema orden + sufijo -ad- + flexivos -o y -s."}]}`;
const SINTAXIS_IMPORT_PLACEHOLDER = `{"items":[{"phrase":"Aunque llovia, salimos temprano.","difficulty":2,"correction":"**Analisis:** oracion compuesta por subordinacion adverbial concesiva.\\n\\n- **Subordinada:** \\"Aunque llovia\\"\\n- **Principal:** \\"salimos temprano\\"\\n- **CC de tiempo:** \\"temprano\\""}]}`;
const DERIVATIVE_IMPORT_PLACEHOLDER = `{"items":[{"function":"f(x)=x^3-5x^2+2x","derivative":"f'(x)=3x^2-10x+2"}]}`;

function cx(...tokens: Array<string | false | null | undefined>): string {
  return tokens.filter(Boolean).join(" ");
}

function normalizeLatexInput(value: string): string {
  const cleaned = value.trim();
  if (cleaned.startsWith("$$") && cleaned.endsWith("$$")) {
    return cleaned.slice(2, -2).trim();
  }
  if (cleaned.startsWith("\\[") && cleaned.endsWith("\\]")) {
    return cleaned.slice(2, -2).trim();
  }
  if (cleaned.startsWith("\\(") && cleaned.endsWith("\\)")) {
    return cleaned.slice(2, -2).trim();
  }
  if (cleaned.startsWith("$") && cleaned.endsWith("$")) {
    return cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

function MathDisplay({ value, className }: { value: string; className?: string }) {
  const rendered = useMemo(() => {
    try {
      return {
        html: katex.renderToString(normalizeLatexInput(value), {
          displayMode: true,
          throwOnError: false,
          strict: false,
        }),
        fallback: "",
      };
    } catch {
      return {
        html: "",
        fallback: value,
      };
    }
  }, [value]);

  if (rendered.fallback) {
    return <pre className={cx("math-display math-display--fallback", className)}>{rendered.fallback}</pre>;
  }

  return <div className={cx("math-display", className)} dangerouslySetInnerHTML={{ __html: rendered.html }} />;
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
  const uiText = useUiText();
  const safeValue = coercePracticeBatchSize(value);
  const handleChange = (nextValue: string) => {
    onChange(coercePracticeBatchSize(nextValue));
  };

  return (
    <div className="field-block batch-size-control">
      <div className="batch-size-header">
        <FieldLabel label={uiText.batchSize} />
        <span className="batch-size-count">{safeValue}</span>
      </div>
      <div className="batch-size-row">
        <input
          aria-label={uiText.batchSize}
          max={MAX_PRACTICE_BATCH_SIZE}
          min={MIN_PRACTICE_BATCH_SIZE}
          step={1}
          type="range"
          value={safeValue}
          onChange={(event) => handleChange(event.target.value)}
        />
        <input
          aria-label={uiText.exactBatchSize}
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
        <span>{uiText.max} {MAX_PRACTICE_BATCH_SIZE}</span>
      </div>
    </div>
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
  const uiText = useUiText();
  if (rows.length === 0) {
    return <p>{uiText.noDataYet}</p>;
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
  const uiText = useUiText();
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "warn">("info");

  const importText = (rawText: string) => {
    try {
      const result = onImportText(rawText);
      setMessage(uiText.importResult(result.saved, result.rejected, result.total));
      setTone(result.saved > 0 ? "info" : "warn");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : uiText.invalidJson);
      setTone("warn");
    }
  };

  return (
    <details className="details-panel manual-bank-panel" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <span>{uiText.savedCount(count)}</span>
      </summary>
      <div className="details-content">
        <div className="field-block">
          <FieldLabel label={uiText.importJson} />
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
            {uiText.importPasted}
          </button>
          <label className="ghost-btn file-upload-btn">
            {uiText.uploadJson}
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
              setMessage(uiText.bankCleared);
              setTone("info");
            }}
          >
            {uiText.clearBank}
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
  sintaxisSettings,
  seQuestionBank,
  periphrasisQuestionBank,
  morfoQuestionBank,
  sintaxisQuestionBank,
  derivativeQuestionBank,
  onSeQuestionBankChange,
  onPeriphrasisQuestionBankChange,
  onMorfoQuestionBankChange,
  onSintaxisQuestionBankChange,
  onDerivativeQuestionBankChange,
}: {
  seSettings: SeSettings;
  periphrasisSettings: PeriphrasisSettings;
  morfoSettings: MorfoSettings;
  sintaxisSettings: SintaxisSettings;
  seQuestionBank: StoredSeItem[];
  periphrasisQuestionBank: StoredPeriphrasisItem[];
  morfoQuestionBank: StoredMorfoItem[];
  sintaxisQuestionBank: StoredSintaxisItem[];
  derivativeQuestionBank: StoredDerivativeItem[];
  onSeQuestionBankChange: (items: StoredSeItem[]) => void;
  onPeriphrasisQuestionBankChange: (items: StoredPeriphrasisItem[]) => void;
  onMorfoQuestionBankChange: (items: StoredMorfoItem[]) => void;
  onSintaxisQuestionBankChange: (items: StoredSintaxisItem[]) => void;
  onDerivativeQuestionBankChange: (items: StoredDerivativeItem[]) => void;
}) {
  const uiText = useUiText();
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

  const importSintaxisQuestionBank = (rawText: string): ImportResult => {
    const records = parseQuestionBankRecords(rawText);
    const validItems = records
      .map((record) => sanitizeUploadedSintaxisItem(record, sintaxisSettings.difficulty))
      .filter((item): item is StoredSintaxisItem => item !== null);
    const nextBank = mergeQuestionBank(sintaxisQuestionBank, validItems, (item) => normalizeTextToken(item.phrase));
    onSintaxisQuestionBankChange(nextBank);
    return {
      saved: validItems.length,
      rejected: records.length - validItems.length,
      total: records.length,
    };
  };

  const importDerivativeQuestionBank = (rawText: string): ImportResult => {
    const records = parseQuestionBankRecords(rawText);
    const validItems = records
      .map((record) => sanitizeUploadedDerivativeItem(record))
      .filter((item): item is StoredDerivativeItem => item !== null);
    const nextBank = mergeQuestionBank(derivativeQuestionBank, validItems, (item) => normalizeTextToken(item.functionText));
    onDerivativeQuestionBankChange(nextBank);
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
          title={sectionLabel("se", uiText)}
          onClear={() => onSeQuestionBankChange([])}
          onImportText={importSeQuestionBank}
        />
        <ManualBankPanel
          count={periphrasisQuestionBank.length}
          defaultOpen
          placeholder={PERIPHRASIS_IMPORT_PLACEHOLDER}
          title={sectionLabel("perifrasis", uiText)}
          onClear={() => onPeriphrasisQuestionBankChange([])}
          onImportText={importPeriphrasisQuestionBank}
        />
        <ManualBankPanel
          count={morfoQuestionBank.length}
          defaultOpen
          placeholder={MORFO_IMPORT_PLACEHOLDER}
          title={sectionLabel("morfologia", uiText)}
          onClear={() => onMorfoQuestionBankChange([])}
          onImportText={importMorfoQuestionBank}
        />
        <ManualBankPanel
          count={sintaxisQuestionBank.length}
          defaultOpen
          placeholder={SINTAXIS_IMPORT_PLACEHOLDER}
          title={sectionLabel("sintaxis", uiText)}
          onClear={() => onSintaxisQuestionBankChange([])}
          onImportText={importSintaxisQuestionBank}
        />
        <ManualBankPanel
          count={derivativeQuestionBank.length}
          defaultOpen
          placeholder={DERIVATIVE_IMPORT_PLACEHOLDER}
          title={sectionLabel("derivative", uiText)}
          onClear={() => onDerivativeQuestionBankChange([])}
          onImportText={importDerivativeQuestionBank}
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
  const uiText = useUiText();
  const [showKey, setShowKey] = useState(false);
  const hasSavedKey = apiKey.trim().length > 0;

  return (
    <div className="info-block">
      <div className="field-block">
        <FieldLabel label={uiText.browserKey} />
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
          {showKey ? uiText.hideKey : uiText.showKey}
        </button>
        <button className="ghost-btn" disabled={!hasSavedKey} type="button" onClick={() => onApiKeyChange("")}>
          {uiText.clearKey}
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

type GlobalPageName = "daily" | "records" | "storage" | "settings";

const GLOBAL_PAGE_ORDER: GlobalPageName[] = ["daily", "records", "storage", "settings"];

function pageLabel(page: PageName, uiText: UiText): string {
  if (page === "practice") {
    return uiText.practice;
  }
  if (page === "history") {
    return uiText.history;
  }
  if (page === "settings") {
    return uiText.settings;
  }
  return uiText.banks;
}

function globalPageLabel(page: GlobalPageName, uiText: UiText): string {
  if (page === "daily") {
    return uiText.dailyChallenge;
  }
  if (page === "records") {
    return uiText.personalTimes;
  }
  if (page === "settings") {
    return uiText.settings;
  }
  return uiText.banks;
}

function sectionLabel(section: SectionName | DailyChallengeSection, uiText: UiText): string {
  if (section === "se") {
    return uiText.sectionSe;
  }
  if (section === "perifrasis") {
    return uiText.sectionPeriphrasis;
  }
  if (section === "morfologia") {
    return uiText.sectionMorfo;
  }
  if (section === "sintaxis") {
    return uiText.sectionSintaxis;
  }
  if (section === "derivative") {
    return uiText.sectionDerivative;
  }
  if (section === "philosophy") {
    return uiText.sectionPhilosophy;
  }
  return uiText.sectionCatalan;
}

type DailyChallengePlan = {
  se: SeItem[];
  perifrasis: PeriphrasisItem[];
  morfologia: MorfoItem[];
  catalan: CatalanCard[];
  sintaxis: SintaxisItem[];
  philosophy: PhilosophyCard[];
  derivative: DerivativeItem[];
};

interface DailyChallengeSession {
  id: string;
  dateKey: string;
  startedAt: number;
  sectionStartedAt: number;
  currentSectionIndex: number;
  currentItemIndex: number;
  checked: boolean;
  plan: DailyChallengePlan;
  sectionTimes: Record<DailyChallengeSection, number>;
  warning: string;
}

function emptyDailySectionMap<T>(value: T): Record<DailyChallengeSection, T> {
  return DAILY_CHALLENGE_SECTIONS.reduce((result, section) => {
    result[section] = value;
    return result;
  }, {} as Record<DailyChallengeSection, T>);
}

function emptyDailyPlan(): DailyChallengePlan {
  return {
    se: [],
    perifrasis: [],
    morfologia: [],
    catalan: [],
    sintaxis: [],
    philosophy: [],
    derivative: [],
  };
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDateLabel(dateKey: string, locale = "es-ES"): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return dateKey;
  }
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
  });
}

function modelSelectValue(modelName: string): string {
  return MODEL_OPTIONS.some((option) => option.value === modelName) ? modelName : "custom";
}

function customModelValue(modelName: string): string {
  return modelSelectValue(modelName) === "custom" ? modelName : "";
}

function resolveModelDraft(selectedModel: string, customModel: string): string {
  return selectedModel === "custom" ? customModel.trim() || MODEL_OPTIONS[0].value : selectedModel;
}

function dailyKeyForSe(item: Pick<SeItem, "sentence"> | StoredSeItem): string {
  return normalizeTextToken(item.sentence);
}

function dailyKeyForPeriphrasis(item: Pick<PeriphrasisItem, "sentence"> | StoredPeriphrasisItem): string {
  return normalizeTextToken(item.sentence);
}

function dailyKeyForMorfo(item: Pick<MorfoItem, "word"> | StoredMorfoItem): string {
  return normalizeTextToken(item.word);
}

function dailyKeyForCatalan(item: CatalanCard): string {
  return normalizeTextToken(`${item.deckName}::${item.termId}`);
}

function dailyKeyForSintaxis(item: Pick<SintaxisItem, "phrase"> | StoredSintaxisItem): string {
  return normalizeTextToken(item.phrase);
}

function dailyKeyForPhilosophy(item: PhilosophyCard): string {
  return normalizeTextToken(item.id);
}

function dailyKeyForDerivative(item: Pick<DerivativeItem, "functionText"> | StoredDerivativeItem): string {
  return normalizeTextToken(item.functionText);
}

function usedDailyKeys(records: DailyChallengeRecord[], section: DailyChallengeSection): Set<string> {
  return new Set(records.flatMap((record) => record.itemKeys[section] ?? []).map(normalizeTextToken).filter(Boolean));
}

function selectDailyItems<T>(
  bank: readonly T[],
  count: number,
  usedKeys: Set<string>,
  keyForItem: (item: T) => string,
): T[] {
  const targetCount = coercePracticeBatchSize(count);
  const selected: T[] = [];
  const selectedKeys = new Set<string>();
  const unused = shuffleList([...bank].filter((item) => !usedKeys.has(keyForItem(item))));
  const fallback = shuffleList([...bank]);

  [...unused, ...fallback].forEach((item) => {
    const key = keyForItem(item);
    if (!key || selectedKeys.has(key) || selected.length >= targetCount) {
      return;
    }
    selectedKeys.add(key);
    selected.push(item);
  });

  return selected;
}

function selectedDailyCatalanCards(decks: CatalanDeck[], settings: DailyChallengeSettings): CatalanCard[] {
  const selectedDecks = new Set(settings.catalanDeckNames);
  const selectedSections = new Set(settings.catalanSectionNames);

  return decks
    .filter((deck) => selectedDecks.size === 0 || selectedDecks.has(deck.name))
    .flatMap((deck) => deck.cards)
    .filter((card) => selectedSections.size === 0 || selectedSections.has(card.section));
}

function buildDailyChallengePlan(
  storageState: StorageState,
  catalanDecks: CatalanDeck[],
  uiText: UiText,
): { plan: DailyChallengePlan; warning: string } {
  const counts = storageState.dailyChallengeSettings.counts;
  const records = storageState.dailyChallengeRecords;
  const plan = emptyDailyPlan();
  const catalanCards = selectedDailyCatalanCards(catalanDecks, storageState.dailyChallengeSettings);
  const includedSections = new Set(storageState.dailyChallengeSettings.includedSections);

  if (includedSections.has("se")) {
    plan.se = selectDailyItems(storageState.seQuestionBank, counts.se, usedDailyKeys(records, "se"), dailyKeyForSe)
      .map((item) => ({ ...item, id: createId("daily_se"), mode: "normal" as const }));
  }
  if (includedSections.has("perifrasis")) {
    plan.perifrasis = selectDailyItems(
      storageState.periphrasisQuestionBank,
      counts.perifrasis,
      usedDailyKeys(records, "perifrasis"),
      dailyKeyForPeriphrasis,
    ).map((item) => ({ ...item, id: createId("daily_perifrasis"), mode: "normal" as const }));
  }
  if (includedSections.has("morfologia")) {
    plan.morfologia = selectDailyItems(
      storageState.morfoQuestionBank,
      counts.morfologia,
      usedDailyKeys(records, "morfologia"),
      dailyKeyForMorfo,
    ).map((item) => ({ ...item, id: createId("daily_morfo"), mode: "normal" as const }));
  }
  if (includedSections.has("catalan")) {
    plan.catalan = selectDailyItems(
      catalanCards,
      counts.catalan,
      usedDailyKeys(records, "catalan"),
      dailyKeyForCatalan,
    );
  }
  if (includedSections.has("sintaxis")) {
    plan.sintaxis = selectDailyItems(
      storageState.sintaxisQuestionBank,
      counts.sintaxis,
      usedDailyKeys(records, "sintaxis"),
      dailyKeyForSintaxis,
    ).map((item) => ({ ...item, id: createId("daily_sintaxis"), mode: "normal" as const }));
  }
  if (includedSections.has("philosophy")) {
    plan.philosophy = selectDailyItems(
      PHILOSOPHY_CARDS,
      counts.philosophy,
      usedDailyKeys(records, "philosophy"),
      dailyKeyForPhilosophy,
    );
  }
  if (includedSections.has("derivative")) {
    plan.derivative = selectDailyItems(
      storageState.derivativeQuestionBank,
      counts.derivative,
      usedDailyKeys(records, "derivative"),
      dailyKeyForDerivative,
    ).map((item) => ({ ...item, id: createId("daily_derivative"), mode: "normal" as const }));
  }

  const incompleteSections = storageState.dailyChallengeSettings.includedSections
    .filter((section) => plan[section].length < counts[section]);
  const incompleteSectionLabels = incompleteSections.map((section) => sectionLabel(section, uiText)).join(", ");
  const warning = incompleteSections.length > 0
    ? uiText.notEnoughDailyQuestions(incompleteSectionLabels)
    : "";

  return { plan, warning };
}

function dailyPlanItemKeys(plan: DailyChallengePlan): Record<DailyChallengeSection, string[]> {
  return {
    se: plan.se.map(dailyKeyForSe),
    perifrasis: plan.perifrasis.map(dailyKeyForPeriphrasis),
    morfologia: plan.morfologia.map(dailyKeyForMorfo),
    catalan: plan.catalan.map(dailyKeyForCatalan),
    sintaxis: plan.sintaxis.map(dailyKeyForSintaxis),
    philosophy: plan.philosophy.map(dailyKeyForPhilosophy),
    derivative: plan.derivative.map(dailyKeyForDerivative),
  };
}

function dailyPlanSectionCounts(plan: DailyChallengePlan): Record<DailyChallengeSection, number> {
  return DAILY_CHALLENGE_SECTIONS.reduce((counts, section) => {
    counts[section] = plan[section].length;
    return counts;
  }, {} as Record<DailyChallengeSection, number>);
}

function dailyPlanTotal(plan: DailyChallengePlan): number {
  return DAILY_CHALLENGE_SECTIONS.reduce((total, section) => total + plan[section].length, 0);
}

function firstDailySectionIndex(plan: DailyChallengePlan): number {
  return Math.max(0, DAILY_CHALLENGE_SECTIONS.findIndex((section) => plan[section].length > 0));
}

function DailyTimerOverlay({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timerId);
  }, []);

  return <div className="daily-timer-overlay">{formatDuration(now - startedAt)}</div>;
}

function SettingsChecklistDropdown({
  emptyText,
  label,
  options,
  selectedValues,
  onToggle,
}: {
  emptyText: string;
  label: string;
  options: Array<{ label: string; value: string }>;
  selectedValues: Set<string>;
  onToggle: (value: string) => void;
}) {
  const uiText = useUiText();

  return (
    <details className="settings-checklist">
      <summary>
        <span>{label}</span>
        <small>{uiText.selectedCount(selectedValues.size)}</small>
      </summary>
      <div className="settings-checklist__menu" aria-label={label} role="group">
        {options.length ? (
          options.map((option) => (
            <label className="settings-checklist__option" key={option.value}>
              <input
                checked={selectedValues.has(option.value)}
                type="checkbox"
                onChange={() => onToggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))
        ) : (
          <p className="muted-line">{emptyText}</p>
        )}
      </div>
    </details>
  );
}

function DailyChallengeSettingsPanel({
  catalanDecks,
  settings,
  onSettingsChange,
}: {
  catalanDecks: CatalanDeck[];
  settings: DailyChallengeSettings;
  onSettingsChange: (settings: DailyChallengeSettings) => void;
}) {
  const uiText = useUiText();
  const updateCount = (section: DailyChallengeSection, value: string) => {
    onSettingsChange({
      ...settings,
      counts: {
        ...settings.counts,
        [section]: coercePracticeBatchSize(value),
      },
    });
  };
  const toggleDailySection = (section: DailyChallengeSection) => {
    const next = new Set(settings.includedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    onSettingsChange({
      ...settings,
      includedSections: DAILY_CHALLENGE_SECTIONS.filter((candidate) => next.has(candidate)),
    });
  };
  const catalanDeckNames = catalanDecks.map((deck) => deck.name);
  const selectedCatalanDeckNames = settings.catalanDeckNames.filter((name) => catalanDeckNames.includes(name));
  const effectiveCatalanDeckNames = selectedCatalanDeckNames.length ? selectedCatalanDeckNames : catalanDeckNames;
  const catalanSectionNames = [
    ...new Set(
      catalanDecks
        .filter((deck) => effectiveCatalanDeckNames.includes(deck.name))
        .flatMap((deck) => deck.cards.map((card) => card.section)),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const selectedCatalanSectionNames = settings.catalanSectionNames.filter((name) => catalanSectionNames.includes(name));
  const effectiveCatalanSectionNames = selectedCatalanSectionNames.length ? selectedCatalanSectionNames : catalanSectionNames;

  const updateCatalanDecks = (deckName: string) => {
    const currentSelection = selectedCatalanDeckNames.length ? selectedCatalanDeckNames : catalanDeckNames;
    const nextSelection = currentSelection.includes(deckName)
      ? currentSelection.filter((name) => name !== deckName)
      : [...currentSelection, deckName];
    const normalizedSelection = nextSelection.length === catalanDeckNames.length ? [] : nextSelection;
    onSettingsChange({
      ...settings,
      catalanDeckNames: normalizedSelection,
      catalanSectionNames: [],
    });
  };

  const updateCatalanSections = (sectionName: string) => {
    const currentSelection = selectedCatalanSectionNames.length ? selectedCatalanSectionNames : catalanSectionNames;
    const nextSelection = currentSelection.includes(sectionName)
      ? currentSelection.filter((name) => name !== sectionName)
      : [...currentSelection, sectionName];
    const normalizedSelection = nextSelection.length === catalanSectionNames.length ? [] : nextSelection;
    onSettingsChange({
      ...settings,
      catalanSectionNames: normalizedSelection,
    });
  };

  return (
    <div className="panel daily-settings-panel">
      <h3>{uiText.dailyChallenge}</h3>

      <SettingsChecklistDropdown
        emptyText={uiText.noDailySections}
        label={uiText.includedSections}
        options={DAILY_CHALLENGE_SECTIONS.map((section) => ({
          label: sectionLabel(section, uiText),
          value: section,
        }))}
        selectedValues={new Set(settings.includedSections)}
        onToggle={(section) => toggleDailySection(section as DailyChallengeSection)}
      />

      {settings.includedSections.length ? (
        <>
          <h4 className="section-heading daily-count-heading">{uiText.questionsPerSection}</h4>
          <div className="daily-settings-grid">
            {settings.includedSections.map((section) => (
              <label className="daily-count-control" key={section}>
                <span>{sectionLabel(section, uiText)}</span>
                <select
                  aria-label={`${uiText.questionsPerSection}: ${sectionLabel(section, uiText)}`}
                  value={settings.counts[section]}
                  onChange={(event) => updateCount(section, event.target.value)}
                >
                  {Array.from({ length: MAX_PRACTICE_BATCH_SIZE }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </>
      ) : (
        <div className="inline-banner warn">{uiText.chooseDailySection}</div>
      )}

      <details className="daily-catalan-settings">
        <summary>
          <span>{uiText.catalanDailyTitle}</span>
          <small>{uiText.optionalFilters}</small>
        </summary>
        <div className="daily-catalan-settings__content">
          <p className="muted-line">{uiText.catalanDailyHelp}</p>
          <SettingsChecklistDropdown
            emptyText={uiText.noCatalanDecks}
            label={uiText.decks}
            options={catalanDeckNames.map((deckName) => ({ label: deckName, value: deckName }))}
            selectedValues={new Set(effectiveCatalanDeckNames)}
            onToggle={updateCatalanDecks}
          />
          <SettingsChecklistDropdown
            emptyText={uiText.noCatalanSections}
            label={uiText.sections}
            options={catalanSectionNames.map((sectionName) => ({ label: sectionName, value: sectionName }))}
            selectedValues={new Set(effectiveCatalanSectionNames)}
            onToggle={updateCatalanSections}
          />
        </div>
      </details>
    </div>
  );
}

function DailySeQuestion({
  item,
  settings,
  availableSeValues,
  onAttempt,
  onChecked,
}: {
  item: SeItem;
  settings: SeSettings;
  availableSeValues: string[];
  onAttempt: (attempt: SeAttempt) => void;
  onChecked: () => void;
}) {
  const uiText = useUiText();
  const [guessValue, setGuessValue] = useState(availableSeValues[0] ?? SE_VALUES[0]);
  const [guessFunction, setGuessFunction] = useState<string>(SE_FUNCTIONS[0]);
  const [evaluation, setEvaluation] = useState<SeEvaluation | null>(null);
  const [attemptSaved, setAttemptSaved] = useState(false);

  useEffect(() => {
    setGuessValue(availableSeValues[0] ?? SE_VALUES[0]);
    setGuessFunction(SE_FUNCTIONS[0]);
    setEvaluation(null);
    setAttemptSaved(false);
  }, [availableSeValues, item.id]);

  const handleCheck = () => {
    const nextEvaluation = evaluateSeGuess(item, guessValue, guessFunction, item.verbalStructure, item.periphrasisType);
    setEvaluation(nextEvaluation);
    if (!attemptSaved) {
      onAttempt(makeSeAttempt(item, settings, nextEvaluation));
      setAttemptSaved(true);
    }
    onChecked();
  };

  return (
    <>
      <h3 className="prompt-text">{item.sentence}</h3>
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
        {uiText.checkResponse}
      </button>
      {evaluation ? (
        <>
          <div className="result-panel">
            <p>
              Valor:{" "}
              <strong className={evaluation.valueOk ? "result-ok" : "result-bad"}>
                {evaluation.valueOk ? "correcto" : `incorrecto (correcto: ${item.seValue})`}
              </strong>
            </p>
            <p>
              Funcion:{" "}
              <strong className={evaluation.functionOk ? "result-ok" : "result-bad"}>
                {evaluation.functionOk ? "correcta" : `incorrecta (correcta: ${item.seFunction})`}
              </strong>
            </p>
            <p>{item.explanation}</p>
          </div>
        </>
      ) : null}
    </>
  );
}

function DailyPeriphrasisQuestion({
  item,
  settings,
  availablePeriphrasisTypes,
  onAttempt,
  onChecked,
}: {
  item: PeriphrasisItem;
  settings: PeriphrasisSettings;
  availablePeriphrasisTypes: string[];
  onAttempt: (attempt: PeriphrasisAttempt) => void;
  onChecked: () => void;
}) {
  const uiText = useUiText();
  const noAplica = availablePeriphrasisTypes.find((value) => normalizeTextToken(value) === normalizeTextToken("No aplica")) ?? "No aplica";
  const [guessStructure, setGuessStructure] = useState<string>(PERIPHRASIS_STRUCTURES[0]);
  const [guessPeriphrasisType, setGuessPeriphrasisType] = useState(noAplica);
  const [evaluation, setEvaluation] = useState<PeriphrasisEvaluation | null>(null);
  const [attemptSaved, setAttemptSaved] = useState(false);

  useEffect(() => {
    setGuessStructure(PERIPHRASIS_STRUCTURES[0]);
    setGuessPeriphrasisType(noAplica);
    setEvaluation(null);
    setAttemptSaved(false);
  }, [item.id, noAplica]);

  const handleCheck = () => {
    const nextEvaluation = evaluatePeriphrasisGuess(item, guessStructure, guessPeriphrasisType);
    setEvaluation(nextEvaluation);
    if (!attemptSaved) {
      onAttempt(makePeriphrasisAttempt(item, settings, nextEvaluation));
      setAttemptSaved(true);
    }
    onChecked();
  };

  return (
    <>
      <h3 className="prompt-text">{item.sentence}</h3>
      <div className="field-grid">
        <div>
          <FieldLabel label="Construccion verbal" />
          <select
            value={guessStructure}
            onChange={(event) => {
              const nextValue = event.target.value;
              setGuessStructure(nextValue);
              if (nextValue !== "Perifrasis verbal") {
                setGuessPeriphrasisType(noAplica);
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
          <FieldLabel label="Tipo de perifrasis" />
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
        {uiText.checkResponse}
      </button>
      {evaluation ? (
        <div className="result-panel">
          <p>
            Construccion verbal:{" "}
            <strong className={evaluation.structureOk ? "result-ok" : "result-bad"}>
              {evaluation.structureOk ? "correcta" : `incorrecta (correcta: ${item.verbalStructure})`}
            </strong>
          </p>
          <p>
            Tipo de perifrasis:{" "}
            <strong className={evaluation.periphrasisTypeOk ? "result-ok" : "result-bad"}>
              {evaluation.periphrasisTypeOk ? "correcto" : `incorrecto (correcto: ${item.periphrasisType})`}
            </strong>
          </p>
          <p>{item.explanation}</p>
        </div>
      ) : null}
    </>
  );
}

function DailyMorfoQuestion({
  item,
  settings,
  onAttempt,
  onChecked,
}: {
  item: MorfoItem;
  settings: MorfoSettings;
  onAttempt: (attempt: MorfoAttempt) => void;
  onChecked: () => void;
}) {
  const uiText = useUiText();
  const [guessWordType, setGuessWordType] = useState<string>(MORFO_WORD_TYPES[0]);
  const [guessLexeme, setGuessLexeme] = useState("");
  const [guessMorphemesText, setGuessMorphemesText] = useState("");
  const [guessMorphemeTypes, setGuessMorphemeTypes] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState<MorfoEvaluation | null>(null);
  const [attemptSaved, setAttemptSaved] = useState(false);
  const acceptedLexemeLabels = acceptedLexemesForItem(item);

  useEffect(() => {
    setGuessWordType(MORFO_WORD_TYPES[0]);
    setGuessLexeme("");
    setGuessMorphemesText("");
    setGuessMorphemeTypes([]);
    setEvaluation(null);
    setAttemptSaved(false);
  }, [item.id]);

  const handleCheck = () => {
    const nextEvaluation = evaluateMorfoGuess(item, guessWordType, guessLexeme, guessMorphemesText, guessMorphemeTypes);
    setEvaluation(nextEvaluation);
    if (!attemptSaved) {
      onAttempt(makeMorfoAttempt(item, settings, nextEvaluation));
      setAttemptSaved(true);
    }
    onChecked();
  };

  return (
    <>
      <h3 className="prompt-text">{item.word}</h3>
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
          <input value={guessLexeme} onChange={(event) => setGuessLexeme(event.target.value)} />
        </div>
      </div>
      <div className="field-grid">
        <div>
          <FieldLabel label="Morfemas" />
          <input value={guessMorphemesText} onChange={(event) => setGuessMorphemesText(event.target.value)} />
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
        {uiText.checkResponse}
      </button>
      {evaluation ? (
        <div className="result-panel">
          <p>
            Tipo de palabra:{" "}
            <strong className={evaluation.wordTypeOk ? "result-ok" : "result-bad"}>
              {evaluation.wordTypeOk ? "correcto" : `incorrecto (correcto: ${item.wordType})`}
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
              {evaluation.morphemesOk ? "correctos" : `incorrectos (correctos: ${item.morphemes.join(", ")})`}
            </strong>
          </p>
          <p>
            Tipos de morfema:{" "}
            <strong className={evaluation.morphemeTypesOk ? "result-ok" : "result-bad"}>
              {evaluation.morphemeTypesOk ? "correctos" : `incorrectos (correctos: ${item.morphemeTypes.join(", ")})`}
            </strong>
          </p>
          <p>{item.explanation}</p>
        </div>
      ) : null}
    </>
  );
}

function DailyCatalanQuestion({
  item,
  onChecked,
}: {
  item: CatalanCard;
  onChecked: () => void;
}) {
  const uiText = useUiText();
  const [answerDraft, setAnswerDraft] = useState("");
  const [accentSelection, setAccentSelection] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    userText: string;
    selectedIndices: number[];
  } | null>(null);
  const [attemptSaved, setAttemptSaved] = useState(false);

  useEffect(() => {
    setAnswerDraft("");
    setAccentSelection([]);
    setFeedback(null);
    setAttemptSaved(false);
  }, [item.termId]);

  const checkAnswer = () => {
    const selectedIndices = [...accentSelection].sort((left, right) => left - right);
    const expected = item.missing || item.answer;
    const correct = isCatalanAccentCard(item)
      ? expectedCatalanAccentIndices(item).length === selectedIndices.length &&
        expectedCatalanAccentIndices(item).every((index, itemIndex) => index === selectedIndices[itemIndex]) &&
        normalizeCatalanAnswer(answerDraft) === normalizeCatalanAnswer(expectedCatalanAccentInput(item))
      : normalizeCatalanAnswer(answerDraft) === normalizeCatalanAnswer(expected);

    setFeedback({ correct, userText: answerDraft, selectedIndices });
    if (!attemptSaved) {
      const nextProgress = updateCatalanProgressWithAttempt(loadStoredCatalanProgress(), item, correct);
      saveStoredCatalanProgress(nextProgress);
      setAttemptSaved(true);
    }
    onChecked();
  };

  const previewWord = previewCatalanMaskedWord(item.masked, answerDraft);

  return (
    <div className="daily-catalan-column">
      <section className="catalan-question-card">
        <div className="question-section">{item.section}</div>
        <div className="question-prompt">{displayCatalanPrompt(item)}</div>
        {isCatalanAccentCard(item) ? (
          <div className="catalan-accent-word">
            {Array.from(catalanAccentBaseWord(item)).map((letter, index) => {
              const selected = accentSelection.includes(index);
              return (
                <button
                  key={`${letter}-${index}`}
                  aria-pressed={selected}
                  className={cx("catalan-accent-letter", selected && "selected")}
                  disabled={Boolean(feedback)}
                  type="button"
                  onClick={() => {
                    setAccentSelection((current) =>
                      current.includes(index)
                        ? current.filter((itemIndex) => itemIndex !== index)
                        : [...current, index].sort((left, right) => left - right),
                    );
                  }}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="question-word">{previewWord}</div>
        )}
      </section>

      <form
        className="catalan-answer-row"
        onSubmit={(event) => {
          event.preventDefault();
          checkAnswer();
        }}
      >
        <input
          aria-label={uiText.yourAnswer}
          autoComplete="off"
          disabled={Boolean(feedback)}
          spellCheck={false}
          value={answerDraft}
          onChange={(event) => setAnswerDraft(event.target.value)}
        />
        <button className="primary-btn catalan-check-btn" disabled={Boolean(feedback)} type="submit">
          {uiText.checkResponse}
        </button>
      </form>

      {feedback ? (
        <section className={cx("catalan-feedback", feedback.correct ? "success" : "danger")}>
          <strong>{feedback.correct ? uiText.correct : uiText.incorrect}</strong>
          <div>{item.answer}</div>
          {isCatalanAccentCard(item) ? null : <div>{uiText.gap}: {item.missing || "-"}</div>}
          <div>
            {uiText.expectedLabel}:{" "}
            {isCatalanAccentCard(item)
              ? expectedCatalanAccentInput(item) || uiText.noAccent
              : item.missing || item.answer}
          </div>
          {isCatalanAccentCard(item) ? (
            <div>
              {uiText.clicked}:{" "}
              {feedback.selectedIndices.length
                ? feedback.selectedIndices.map((index) => Array.from(catalanAccentBaseWord(item))[index]).join(", ")
                : uiText.none}
            </div>
          ) : null}
          <div>{uiText.youTyped}: {feedback.userText || "-"}</div>
        </section>
      ) : null}
    </div>
  );
}

function DailySintaxisQuestion({
  item,
  settings,
  onAttempt,
  onChecked,
}: {
  item: SintaxisItem;
  settings: SintaxisSettings;
  onAttempt: (attempt: SintaxisAttempt) => void;
  onChecked: () => void;
}) {
  const uiText = useUiText();
  const [visible, setVisible] = useState(false);
  const [attemptSaved, setAttemptSaved] = useState(false);

  useEffect(() => {
    setVisible(false);
    setAttemptSaved(false);
  }, [item.id]);

  const handleReveal = () => {
    setVisible(true);
    if (!attemptSaved) {
      onAttempt(makeSintaxisAttempt(item, settings, ""));
      setAttemptSaved(true);
    }
    onChecked();
  };

  return (
    <div className="sintaxis-practice-column daily-sintaxis-column">
      <h3 className="prompt-text sintaxis-prompt-text">{item.phrase}</h3>
      <button className="primary-btn sintaxis-correction-btn" type="button" onClick={handleReveal}>
        {uiText.showCorrection}
      </button>
      {visible ? (
        <div className="info-block markdown-correction sintaxis-correction-box">
          <ReactMarkdown>{item.correction}</ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
}

function DailyDerivativeQuestion({
  item,
  settings,
  onAttempt,
  onChecked,
}: {
  item: DerivativeItem;
  settings: DerivativeSettings;
  onAttempt: (attempt: DerivativeAttempt) => void;
  onChecked: () => void;
}) {
  const uiText = useUiText();
  const [visible, setVisible] = useState(false);
  const [attemptSaved, setAttemptSaved] = useState(false);

  useEffect(() => {
    setVisible(false);
    setAttemptSaved(false);
  }, [item.id]);

  const handleReveal = () => {
    setVisible(true);
    if (!attemptSaved) {
      onAttempt(makeDerivativeAttempt(item, settings));
      setAttemptSaved(true);
    }
    onChecked();
  };

  return (
    <div className="derivative-practice-column">
      <MathDisplay value={item.functionText} className="derivative-function-display" />
      <button className="primary-btn derivative-answer-btn" type="button" onClick={handleReveal}>
        {uiText.showAnswer}
      </button>
      {visible ? (
        <div className="info-block derivative-answer-box">
          <MathDisplay value={item.derivative} className="derivative-answer-display" />
        </div>
      ) : null}
    </div>
  );
}

function DailyPhilosophyQuestion({
  item,
  onChecked,
}: {
  item: PhilosophyCard;
  onChecked: () => void;
}) {
  const uiText = useUiText();
  const [visible, setVisible] = useState(false);

  return (
    <div className="daily-philosophy-question">
      <div className="philosophy-card-meta">
        <span className="philosophy-topic-badge">{item.chapterTitle}</span>
        <span className={`philosophy-source-badge philosophy-source-badge--${item.source}`}>
          {item.source === "anki" ? "Anki" : uiText.book}
        </span>
      </div>
      <p className="philosophy-section-label">{item.section}</p>
      <h2 className="daily-philosophy-question__prompt">{item.question}</h2>
      {!visible ? (
        <button
          className="primary-btn"
          type="button"
          onClick={() => {
            setVisible(true);
            onChecked();
          }}
        >
          {uiText.showAnswer}
        </button>
      ) : (
        <div className="philosophy-answer-shell">
          <div className="philosophy-answer-label">{uiText.answer}</div>
          <div className="philosophy-answer">
            <ReactMarkdown>{item.answer}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function DailyChallengeQuestion({
  section,
  item,
  storageState,
  onChecked,
  onAppendSeAttempt,
  onAppendPeriphrasisAttempt,
  onAppendMorfoAttempt,
  onAppendSintaxisAttempt,
  onAppendDerivativeAttempt,
}: {
  section: DailyChallengeSection;
  item: SeItem | PeriphrasisItem | MorfoItem | CatalanCard | SintaxisItem | PhilosophyCard | DerivativeItem;
  storageState: StorageState;
  onChecked: () => void;
  onAppendSeAttempt: (attempt: SeAttempt) => void;
  onAppendPeriphrasisAttempt: (attempt: PeriphrasisAttempt) => void;
  onAppendMorfoAttempt: (attempt: MorfoAttempt) => void;
  onAppendSintaxisAttempt: (attempt: SintaxisAttempt) => void;
  onAppendDerivativeAttempt: (attempt: DerivativeAttempt) => void;
}) {
  const availableSeValues = useMemo(
    () => mergeLabelGroups(SE_VALUES, storageState.seSettings.customValues),
    [storageState.seSettings.customValues],
  );
  const availablePeriphrasisTypes = useMemo(
    () => mergeLabelGroups(PERIPHRASIS_TYPES, storageState.periphrasisSettings.customPeriphrasisTypes),
    [storageState.periphrasisSettings.customPeriphrasisTypes],
  );

  if (section === "se") {
    return (
      <DailySeQuestion
        item={item as SeItem}
        settings={storageState.seSettings}
        availableSeValues={availableSeValues}
        onAttempt={onAppendSeAttempt}
        onChecked={onChecked}
      />
    );
  }
  if (section === "perifrasis") {
    return (
      <DailyPeriphrasisQuestion
        item={item as PeriphrasisItem}
        settings={storageState.periphrasisSettings}
        availablePeriphrasisTypes={availablePeriphrasisTypes}
        onAttempt={onAppendPeriphrasisAttempt}
        onChecked={onChecked}
      />
    );
  }
  if (section === "morfologia") {
    return (
      <DailyMorfoQuestion
        item={item as MorfoItem}
        settings={storageState.morfoSettings}
        onAttempt={onAppendMorfoAttempt}
        onChecked={onChecked}
      />
    );
  }
  if (section === "catalan") {
    return <DailyCatalanQuestion item={item as CatalanCard} onChecked={onChecked} />;
  }
  if (section === "sintaxis") {
    return (
      <DailySintaxisQuestion
        item={item as SintaxisItem}
        settings={storageState.sintaxisSettings}
        onAttempt={onAppendSintaxisAttempt}
        onChecked={onChecked}
      />
    );
  }
  if (section === "philosophy") {
    return <DailyPhilosophyQuestion item={item as PhilosophyCard} onChecked={onChecked} />;
  }
  return (
    <DailyDerivativeQuestion
      item={item as DerivativeItem}
      settings={storageState.derivativeSettings}
      onAttempt={onAppendDerivativeAttempt}
      onChecked={onChecked}
    />
  );
}

function DailyChallengePage({
  catalanDecks,
  storageState,
  onActiveSectionChange,
  onAppendSeAttempt,
  onAppendPeriphrasisAttempt,
  onAppendMorfoAttempt,
  onAppendSintaxisAttempt,
  onAppendDerivativeAttempt,
  onCompleteRecord,
}: {
  catalanDecks: CatalanDeck[];
  storageState: StorageState;
  onActiveSectionChange: (section: DailyChallengeSection) => void;
  onAppendSeAttempt: (attempt: SeAttempt) => void;
  onAppendPeriphrasisAttempt: (attempt: PeriphrasisAttempt) => void;
  onAppendMorfoAttempt: (attempt: MorfoAttempt) => void;
  onAppendSintaxisAttempt: (attempt: SintaxisAttempt) => void;
  onAppendDerivativeAttempt: (attempt: DerivativeAttempt) => void;
  onCompleteRecord: (record: DailyChallengeRecord) => void;
}) {
  const uiText = useUiText();
  const [session, setSession] = useState<DailyChallengeSession | null>(null);
  const [completedRecord, setCompletedRecord] = useState<DailyChallengeRecord | null>(null);
  const todayKey = localDateKey();
  const todaysRecord = storageState.dailyChallengeRecords
    .filter((record) => record.dateKey === todayKey)
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];

  const startChallenge = () => {
    const { plan, warning } = buildDailyChallengePlan(storageState, catalanDecks, uiText);
    if (dailyPlanTotal(plan) === 0) {
      setCompletedRecord(null);
      return;
    }

    const startedAt = Date.now();
    const firstIndex = firstDailySectionIndex(plan);
    setCompletedRecord(null);
    setSession({
      id: createId("daily_session"),
      dateKey: todayKey,
      startedAt,
      sectionStartedAt: startedAt,
      currentSectionIndex: firstIndex,
      currentItemIndex: 0,
      checked: false,
      plan,
      sectionTimes: emptyDailySectionMap(0),
      warning,
    });
    onActiveSectionChange(DAILY_CHALLENGE_SECTIONS[firstIndex]);
  };

  const currentSection = session ? DAILY_CHALLENGE_SECTIONS[session.currentSectionIndex] : null;
  const currentItems = session && currentSection ? session.plan[currentSection] : [];
  const currentItem = currentItems[session?.currentItemIndex ?? 0] ?? null;

  useEffect(() => {
    if (currentSection) {
      onActiveSectionChange(currentSection);
    }
  }, [currentSection]);

  const markChecked = () => {
    setSession((current) => current ? { ...current, checked: true } : current);
  };

  const advanceChallenge = () => {
    if (!session || !currentSection) {
      return;
    }

    const now = Date.now();
    const currentSectionItems = session.plan[currentSection];
    if (session.currentItemIndex + 1 < currentSectionItems.length) {
      setSession({
        ...session,
        currentItemIndex: session.currentItemIndex + 1,
        checked: false,
      });
      return;
    }

    const sectionTimes = {
      ...session.sectionTimes,
      [currentSection]: now - session.sectionStartedAt,
    };
    const nextSectionIndex = DAILY_CHALLENGE_SECTIONS.findIndex(
      (section, index) => index > session.currentSectionIndex && session.plan[section].length > 0,
    );

    if (nextSectionIndex >= 0) {
      setSession({
        ...session,
        sectionTimes,
        currentSectionIndex: nextSectionIndex,
        currentItemIndex: 0,
        sectionStartedAt: now,
        checked: false,
      });
      onActiveSectionChange(DAILY_CHALLENGE_SECTIONS[nextSectionIndex]);
      return;
    }

    const completedAt = new Date();
    const record: DailyChallengeRecord = {
      id: createId("daily_record"),
      profileId: storageState.seSettings.profileId.trim() || "alumno",
      dateKey: session.dateKey,
      createdAt: new Date(session.startedAt).toISOString(),
      completedAt: completedAt.toISOString(),
      totalMs: now - session.startedAt,
      sectionTimes,
      sectionCounts: dailyPlanSectionCounts(session.plan),
      itemKeys: dailyPlanItemKeys(session.plan),
    };
    onCompleteRecord(record);
    setCompletedRecord(record);
    setSession(null);
  };

  if (!session) {
    const includedSections = storageState.dailyChallengeSettings.includedSections;
    const plannedTotal = includedSections.reduce(
      (total, section) => total + storageState.dailyChallengeSettings.counts[section],
      0,
    );
    const bankCounts = {
      se: storageState.seQuestionBank.length,
      perifrasis: storageState.periphrasisQuestionBank.length,
      morfologia: storageState.morfoQuestionBank.length,
      catalan: selectedDailyCatalanCards(catalanDecks, storageState.dailyChallengeSettings).length,
      sintaxis: storageState.sintaxisQuestionBank.length,
      philosophy: PHILOSOPHY_CARDS.length,
      derivative: storageState.derivativeQuestionBank.length,
    };
    const hasAnyBankItems = includedSections.some((section) => bankCounts[section] > 0);

    return (
      <section className="workspace daily-challenge-page">
        <div className="panel daily-start-panel">
          <p className="muted-line">
            {uiText.dailyStartHelp}
          </p>
          <div className="daily-target-grid">
            {includedSections.map((section) => (
              <article className="daily-target-card" key={section}>
                <span>{sectionLabel(section, uiText)}</span>
                <strong>{storageState.dailyChallengeSettings.counts[section]}</strong>
                <small>{uiText.inBank(bankCounts[section])}</small>
              </article>
            ))}
          </div>
          {!includedSections.length ? (
            <div className="inline-banner warn">{uiText.chooseDailySection}</div>
          ) : null}
          {todaysRecord ? (
            <div className="inline-banner">
              {uiText.todaySavedTime(formatDuration(todaysRecord.totalMs))}
            </div>
          ) : null}
          {completedRecord ? (
            <div className="inline-banner">
              {uiText.lastChallengeFinished(formatDuration(completedRecord.totalMs))}
            </div>
          ) : null}
          {!hasAnyBankItems ? (
            <div className="inline-banner warn">{uiText.noQuestionsInBanks}</div>
          ) : null}
          <button className="primary-btn daily-start-btn" disabled={!hasAnyBankItems || plannedTotal === 0} type="button" onClick={startChallenge}>
            {uiText.start}
          </button>
        </div>
      </section>
    );
  }

  const itemNumber = session.currentItemIndex + 1;
  const sectionTotal = currentItems.length;
  const isLastSection = !DAILY_CHALLENGE_SECTIONS.some(
    (section, index) => index > session.currentSectionIndex && session.plan[section].length > 0,
  );
  const isLastItemInSection = session.currentItemIndex + 1 >= sectionTotal;
  const nextLabel = isLastSection && isLastItemInSection ? uiText.finish : uiText.next;

  return (
    <section className="workspace daily-challenge-page">
      <DailyTimerOverlay startedAt={session.startedAt} />
      <div className="daily-session-header">
        <div>
          <p className="section-heading">{uiText.dailyChallenge}</p>
          <h3>{currentSection ? sectionLabel(currentSection, uiText) : ""}</h3>
        </div>
        <div className="daily-session-meta">
          {itemNumber}/{sectionTotal}
        </div>
      </div>
      {session.warning ? <div className="inline-banner warn">{session.warning}</div> : null}
      <div className="page-grid single-column">
        <div className="panel practice-panel daily-practice-panel">
          {currentSection && currentItem ? (
            <DailyChallengeQuestion
              key={`${currentSection}-${currentSection === "catalan" ? (currentItem as CatalanCard).termId : (currentItem as { id: string }).id}`}
              section={currentSection}
              item={currentItem}
              storageState={storageState}
              onChecked={markChecked}
              onAppendSeAttempt={onAppendSeAttempt}
              onAppendPeriphrasisAttempt={onAppendPeriphrasisAttempt}
              onAppendMorfoAttempt={onAppendMorfoAttempt}
              onAppendSintaxisAttempt={onAppendSintaxisAttempt}
              onAppendDerivativeAttempt={onAppendDerivativeAttempt}
            />
          ) : (
            <div className="empty-state">
              <h3>{uiText.noQuestionAvailable}</h3>
            </div>
          )}
          {session.checked ? (
            <button className="primary-btn daily-next-btn" type="button" onClick={advanceChallenge}>
              {nextLabel}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PersonalTimesPage({ records }: { records: DailyChallengeRecord[] }) {
  const uiText = useUiText();
  const sortedRecords = [...records].sort((left, right) => left.dateKey.localeCompare(right.dateKey));
  const recentRecords = sortedRecords.slice(-14);
  const maxTime = Math.max(1, ...recentRecords.map((record) => record.totalMs));
  const chartWidth = 720;
  const chartHeight = 260;
  const chartPadding = { top: 20, right: 28, bottom: 46, left: 58 };
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const chartPoints = recentRecords.map((record, index) => {
    const x = chartPadding.left + (recentRecords.length === 1 ? plotWidth / 2 : (plotWidth * index) / (recentRecords.length - 1));
    const y = chartPadding.top + plotHeight - (record.totalMs / maxTime) * plotHeight;
    return {
      id: record.id,
      date: formatDateLabel(record.dateKey, uiText.locale),
      duration: formatDuration(record.totalMs),
      title: `${record.dateKey}: ${formatDuration(record.totalMs)}`,
      x,
      y,
    };
  });
  const linePath = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath =
    chartPoints.length > 1
      ? `${linePath} L ${chartPoints[chartPoints.length - 1].x} ${chartPadding.top + plotHeight} L ${chartPoints[0].x} ${chartPadding.top + plotHeight} Z`
      : "";
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = maxTime * (1 - ratio);
    return {
      label: formatDuration(value),
      y: chartPadding.top + plotHeight * ratio,
    };
  });
  const bestRecord = records.length > 0
    ? records.reduce((best, record) => record.totalMs < best.totalMs ? record : best, records[0])
    : null;
  const latestRecord = [...records].sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0] ?? null;
  const tableSections = DAILY_CHALLENGE_SECTIONS.filter((section) =>
    records.some((record) => record.sectionCounts[section] > 0 || record.sectionTimes[section] > 0));

  return (
    <section className="workspace personal-times-page">
      {records.length === 0 ? (
        <div className="empty-state">
          <h3>Aun no hay tiempos guardados.</h3>
        </div>
      ) : (
        <>
          <div className="library-overview daily-record-overview">
            <article className="library-stat">
              <span>Retos completados</span>
              <strong>{records.length}</strong>
            </article>
            <article className="library-stat">
              <span>Mejor total</span>
              <strong>{bestRecord ? formatDuration(bestRecord.totalMs) : "-"}</strong>
              <small>{bestRecord ? bestRecord.dateKey : "sin datos"}</small>
            </article>
            <article className="library-stat">
              <span>Ultimo total</span>
              <strong>{latestRecord ? formatDuration(latestRecord.totalMs) : "-"}</strong>
              <small>{latestRecord ? latestRecord.dateKey : "sin datos"}</small>
            </article>
            <article className="library-stat">
              <span>Promedio</span>
              <strong>{formatDuration(records.reduce((total, record) => total + record.totalMs, 0) / records.length)}</strong>
              <small>total por reto</small>
            </article>
          </div>

          <div className="daily-times-chart">
            <div className="chart-header">
              <h2>Tiempos por dia</h2>
              <span>ultimos {recentRecords.length}</span>
            </div>
            <div className="daily-line-chart" aria-label={uiText.timeChartAria} role="img">
              <svg className="daily-line-chart__svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                <defs>
                  <linearGradient id="daily-time-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {yTicks.map((tick) => (
                  <g key={tick.y}>
                    <line
                      className="daily-line-chart__grid"
                      x1={chartPadding.left}
                      x2={chartWidth - chartPadding.right}
                      y1={tick.y}
                      y2={tick.y}
                    />
                    <text className="daily-line-chart__axis" x={chartPadding.left - 10} y={tick.y + 4} textAnchor="end">
                      {tick.label}
                    </text>
                  </g>
                ))}
                <line
                  className="daily-line-chart__axis-line"
                  x1={chartPadding.left}
                  x2={chartWidth - chartPadding.right}
                  y1={chartPadding.top + plotHeight}
                  y2={chartPadding.top + plotHeight}
                />
                {areaPath ? <path className="daily-line-chart__area" d={areaPath} /> : null}
                {linePath ? <path className="daily-line-chart__line" d={linePath} /> : null}
                {chartPoints.map((point) => (
                  <g key={point.id}>
                    <title>{point.title}</title>
                    <circle className="daily-line-chart__dot" cx={point.x} cy={point.y} r="5" />
                    <text className="daily-line-chart__value" x={point.x} y={point.y - 12} textAnchor="middle">
                      {point.duration}
                    </text>
                    <text className="daily-line-chart__date" x={point.x} y={chartHeight - 16} textAnchor="middle">
                      {point.date}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <DataTable
            headers={[
              uiText.date,
              uiText.total,
              ...tableSections.map((section) => sectionLabel(section, uiText)),
            ]}
            rows={[...records]
              .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
              .map((record) => [
                record.dateKey,
                formatDuration(record.totalMs),
                ...tableSections.map((section) => formatDuration(record.sectionTimes[section])),
              ])}
          />
        </>
      )}
    </section>
  );
}

interface CompactSettingsProps {
  storageState: StorageState;
  onSeSettingsChange: (settings: SeSettings) => void;
  onPeriphrasisSettingsChange: (settings: PeriphrasisSettings) => void;
  onMorfoSettingsChange: (settings: MorfoSettings) => void;
  onSintaxisSettingsChange: (settings: SintaxisSettings) => void;
  onDerivativeSettingsChange: (settings: DerivativeSettings) => void;
}

type AiSettingsKey = "se" | "perifrasis" | "morfologia";

interface AiModelDraft {
  selectedModel: string;
  customModel: string;
}

function modelDraftFor(modelName: string): AiModelDraft {
  return {
    selectedModel: modelSelectValue(modelName),
    customModel: customModelValue(modelName),
  };
}

function CompactProfileSettingsPanel({
  storageState,
  onSeSettingsChange,
  onPeriphrasisSettingsChange,
  onMorfoSettingsChange,
  onSintaxisSettingsChange,
  onDerivativeSettingsChange,
}: CompactSettingsProps) {
  const uiText = useUiText();
  const savedProfileId = storageState.seSettings.profileId;
  const [profileId, setProfileId] = useState(savedProfileId);

  useEffect(() => {
    setProfileId(savedProfileId);
  }, [savedProfileId]);

  const saveProfile = () => {
    const normalizedProfileId = profileId.trim() || "alumno";
    onSeSettingsChange({ ...storageState.seSettings, profileId: normalizedProfileId });
    onPeriphrasisSettingsChange({ ...storageState.periphrasisSettings, profileId: normalizedProfileId });
    onMorfoSettingsChange({ ...storageState.morfoSettings, profileId: normalizedProfileId });
    onSintaxisSettingsChange({ ...storageState.sintaxisSettings, profileId: normalizedProfileId });
    onDerivativeSettingsChange({ ...storageState.derivativeSettings, profileId: normalizedProfileId });
  };

  return (
    <section className="panel compact-settings-panel">
      <h3>{uiText.profileForAll}</h3>
      <div className="field-block compact-profile-field">
        <FieldLabel label={uiText.profile} />
        <input value={profileId} onChange={(event) => setProfileId(event.target.value)} />
      </div>
      <button className="primary-btn" type="button" onClick={saveProfile}>
        {uiText.saveProfile}
      </button>
    </section>
  );
}

function CompactAiSettingsPanel({
  storageState,
  onGeminiApiKeyChange,
  onSeSettingsChange,
  onPeriphrasisSettingsChange,
  onMorfoSettingsChange,
}: {
  storageState: StorageState;
  onGeminiApiKeyChange: (value: string) => void;
  onSeSettingsChange: (settings: SeSettings) => void;
  onPeriphrasisSettingsChange: (settings: PeriphrasisSettings) => void;
  onMorfoSettingsChange: (settings: MorfoSettings) => void;
}) {
  const uiText = useUiText();
  const seModelName = storageState.seSettings.modelName;
  const periphrasisModelName = storageState.periphrasisSettings.modelName;
  const morfoModelName = storageState.morfoSettings.modelName;
  const customPeriphrasisTypes = storageState.periphrasisSettings.customPeriphrasisTypes.join(", ");
  const [drafts, setDrafts] = useState<Record<AiSettingsKey, AiModelDraft>>({
    se: modelDraftFor(seModelName),
    perifrasis: modelDraftFor(periphrasisModelName),
    morfologia: modelDraftFor(morfoModelName),
  });
  const [customTypesDraft, setCustomTypesDraft] = useState(customPeriphrasisTypes);

  useEffect(() => {
    setDrafts({
      se: modelDraftFor(seModelName),
      perifrasis: modelDraftFor(periphrasisModelName),
      morfologia: modelDraftFor(morfoModelName),
    });
    setCustomTypesDraft(customPeriphrasisTypes);
  }, [customPeriphrasisTypes, morfoModelName, periphrasisModelName, seModelName]);

  const updateModelDraft = (section: AiSettingsKey, next: Partial<AiModelDraft>) => {
    setDrafts((current) => ({
      ...current,
      [section]: {
        ...current[section],
        ...next,
      },
    }));
  };

  const saveAiSettings = () => {
    onSeSettingsChange({
      ...storageState.seSettings,
      modelName: resolveModelDraft(drafts.se.selectedModel, drafts.se.customModel),
    });
    onPeriphrasisSettingsChange({
      ...storageState.periphrasisSettings,
      modelName: resolveModelDraft(drafts.perifrasis.selectedModel, drafts.perifrasis.customModel),
      customPeriphrasisTypes: stripBaseLabels(parseCustomList(customTypesDraft), PERIPHRASIS_TYPES),
    });
    onMorfoSettingsChange({
      ...storageState.morfoSettings,
      modelName: resolveModelDraft(drafts.morfologia.selectedModel, drafts.morfologia.customModel),
    });
  };

  const renderModelRow = (section: AiSettingsKey, label: string) => (
    <div className="compact-model-row" key={section}>
      <FieldLabel label={label} />
      <div className="compact-model-controls">
        <select
          value={drafts[section].selectedModel}
          onChange={(event) => updateModelDraft(section, { selectedModel: event.target.value })}
        >
          {MODEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value="custom">{uiText.customManual}</option>
        </select>
        <input
          disabled={drafts[section].selectedModel !== "custom"}
          placeholder={uiText.customModel}
          value={drafts[section].customModel}
          onChange={(event) => updateModelDraft(section, { customModel: event.target.value })}
        />
      </div>
    </div>
  );

  return (
    <section className="panel compact-settings-panel">
      <h3>{uiText.aiAndApi}</h3>
      <div className="compact-model-list">
        {renderModelRow("se", sectionLabel("se", uiText))}
        {renderModelRow("perifrasis", sectionLabel("perifrasis", uiText))}
        {renderModelRow("morfologia", sectionLabel("morfologia", uiText))}
      </div>

      <div className="field-block">
        <FieldLabel
          label={uiText.customPeriphrasisTypes}
          hint={uiText.customPeriphrasisHint}
        />
        <input
          placeholder={uiText.customPeriphrasisPlaceholder}
          value={customTypesDraft}
          onChange={(event) => setCustomTypesDraft(event.target.value)}
        />
      </div>

      <button className="primary-btn" type="button" onClick={saveAiSettings}>
        {uiText.saveAi}
      </button>

      <GeminiKeyPanel apiKey={storageState.geminiApiKey} onApiKeyChange={onGeminiApiKeyChange} />
    </section>
  );
}

function PersonalTimesSettingsPanel({
  recordCount,
  onClearRecords,
}: {
  recordCount: number;
  onClearRecords: () => void;
}) {
  const uiText = useUiText();
  const [clearConfirmed, setClearConfirmed] = useState(false);

  useEffect(() => {
    if (recordCount === 0) {
      setClearConfirmed(false);
    }
  }, [recordCount]);

  return (
    <section className="panel compact-settings-panel">
      <h3>{uiText.personalTimes}</h3>
      <p className="muted-line">{uiText.personalTimesHelp}</p>
      <div className="danger-zone">
        <label className="checkbox-line">
          <input
            checked={clearConfirmed}
            disabled={recordCount === 0}
            type="checkbox"
            onChange={(event) => setClearConfirmed(event.target.checked)}
          />
          <span>{uiText.clearTimesConfirm(recordCount)}</span>
        </label>
        <button
          className="danger-btn"
          disabled={!clearConfirmed || recordCount === 0}
          type="button"
          onClick={() => {
            onClearRecords();
            setClearConfirmed(false);
          }}
        >
          {uiText.clearPersonalTimes}
        </button>
      </div>
    </section>
  );
}

function UiLanguageSettingsPanel({
  language,
  onLanguageChange,
}: {
  language: UiLanguage;
  onLanguageChange: (language: UiLanguage) => void;
}) {
  const uiText = useUiText();

  return (
    <section className="panel compact-settings-panel">
      <h3>{uiText.languageSettingsTitle}</h3>
      <div className="field-block">
        <FieldLabel label={uiText.languageFieldLabel} />
        <select value={language} onChange={(event) => onLanguageChange(event.target.value as UiLanguage)}>
          {UI_LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

function GlobalSettingsPage({
  catalanDecks,
  storageState,
  onUiLanguageChange,
  onDailyChallengeSettingsChange,
  onDailyChallengeRecordsClear,
  onGeminiApiKeyChange,
  onSeSettingsChange,
  onPeriphrasisSettingsChange,
  onMorfoSettingsChange,
  onSintaxisSettingsChange,
  onDerivativeSettingsChange,
}: {
  catalanDecks: CatalanDeck[];
  storageState: StorageState;
  onUiLanguageChange: (language: UiLanguage) => void;
  onDailyChallengeSettingsChange: (settings: DailyChallengeSettings) => void;
  onDailyChallengeRecordsClear: () => void;
  onGeminiApiKeyChange: (value: string) => void;
  onSeSettingsChange: (settings: SeSettings) => void;
  onPeriphrasisSettingsChange: (settings: PeriphrasisSettings) => void;
  onMorfoSettingsChange: (settings: MorfoSettings) => void;
  onSintaxisSettingsChange: (settings: SintaxisSettings) => void;
  onDerivativeSettingsChange: (settings: DerivativeSettings) => void;
}) {
  return (
    <section className="workspace global-settings-page">
      <UiLanguageSettingsPanel language={storageState.uiLanguage} onLanguageChange={onUiLanguageChange} />

      <DailyChallengeSettingsPanel
        catalanDecks={catalanDecks}
        settings={storageState.dailyChallengeSettings}
        onSettingsChange={onDailyChallengeSettingsChange}
      />

      <CompactProfileSettingsPanel
        storageState={storageState}
        onDerivativeSettingsChange={onDerivativeSettingsChange}
        onMorfoSettingsChange={onMorfoSettingsChange}
        onPeriphrasisSettingsChange={onPeriphrasisSettingsChange}
        onSeSettingsChange={onSeSettingsChange}
        onSintaxisSettingsChange={onSintaxisSettingsChange}
      />

      <CompactAiSettingsPanel
        storageState={storageState}
        onGeminiApiKeyChange={onGeminiApiKeyChange}
        onMorfoSettingsChange={onMorfoSettingsChange}
        onPeriphrasisSettingsChange={onPeriphrasisSettingsChange}
        onSeSettingsChange={onSeSettingsChange}
      />

      <PersonalTimesSettingsPanel
        recordCount={storageState.dailyChallengeRecords.length}
        onClearRecords={onDailyChallengeRecordsClear}
      />
    </section>
  );
}

export function NetlifyPracticeApp() {
  const [storageState, setStorageState] = useState<StorageState>(() => loadStorageState());
  const [builtInCatalanDecks, setBuiltInCatalanDecks] = useState<CatalanDeck[]>([]);
  const [importedCatalanDecks, setImportedCatalanDecks] = useState<CatalanDeck[]>(() => loadImportedCatalanDecks());
  const [activeSection, setActiveSection] = useState<SectionName>("se");
  const [globalPage, setGlobalPage] = useState<GlobalPageName | null>(null);
  const [exerciseMenuOpen, setExerciseMenuOpen] = useState(false);
  const exerciseMenuRef = useRef<HTMLDivElement | null>(null);
  const [sePage, setSePage] = useState<PageName>("practice");
  const [periphrasisPage, setPeriphrasisPage] = useState<PageName>("practice");
  const [morfoPage, setMorfoPage] = useState<PageName>("practice");
  const [sintaxisPage, setSintaxisPage] = useState<PageName>("practice");
  const [derivativePage, setDerivativePage] = useState<PageName>("practice");
  const uiText = getUiText(storageState.uiLanguage);

  useEffect(() => {
    saveStorageState(storageState);
  }, [storageState]);

  useEffect(() => {
    document.documentElement.lang = storageState.uiLanguage;
  }, [storageState.uiLanguage]);

  useEffect(() => {
    let cancelled = false;
    void loadBuiltInCatalanDecks()
      .then((decks) => {
        if (!cancelled) {
          setBuiltInCatalanDecks(decks);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBuiltInCatalanDecks([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const reloadImportedDecks = () => setImportedCatalanDecks(loadImportedCatalanDecks());
    window.addEventListener(CATALAN_DECKS_UPDATED_EVENT, reloadImportedDecks);
    return () => window.removeEventListener(CATALAN_DECKS_UPDATED_EVENT, reloadImportedDecks);
  }, []);

  useEffect(() => {
    if (!exerciseMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && exerciseMenuRef.current && !exerciseMenuRef.current.contains(target)) {
        setExerciseMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExerciseMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [exerciseMenuOpen]);

  const updateSeSettings = (next: SeSettings) => {
    setStorageState((current) => ({ ...current, seSettings: next }));
  };

  const updateMorfoSettings = (next: MorfoSettings) => {
    setStorageState((current) => ({ ...current, morfoSettings: next }));
  };

  const updatePeriphrasisSettings = (next: PeriphrasisSettings) => {
    setStorageState((current) => ({ ...current, periphrasisSettings: next }));
  };

  const updateSintaxisSettings = (next: SintaxisSettings) => {
    setStorageState((current) => ({ ...current, sintaxisSettings: next }));
  };

  const updateDerivativeSettings = (next: DerivativeSettings) => {
    setStorageState((current) => ({ ...current, derivativeSettings: next }));
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

  const updateSintaxisAttempts = (next: SintaxisAttempt[]) => {
    setStorageState((current) => ({ ...current, sintaxisAttempts: next }));
  };

  const updateDerivativeAttempts = (next: DerivativeAttempt[]) => {
    setStorageState((current) => ({ ...current, derivativeAttempts: next }));
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

  const updateSintaxisQuestionBank = (next: StoredSintaxisItem[]) => {
    setStorageState((current) => ({ ...current, sintaxisQuestionBank: next }));
  };

  const updateDerivativeQuestionBank = (next: StoredDerivativeItem[]) => {
    setStorageState((current) => ({ ...current, derivativeQuestionBank: next }));
  };

  const updateGeminiApiKey = (next: string) => {
    setStorageState((current) => ({ ...current, geminiApiKey: next }));
  };

  const updateUiLanguage = (next: UiLanguage) => {
    setStorageState((current) => ({ ...current, uiLanguage: next }));
  };

  const updateDailyChallengeSettings = (next: DailyChallengeSettings) => {
    setStorageState((current) => ({ ...current, dailyChallengeSettings: next }));
  };

  const appendDailyRecord = (record: DailyChallengeRecord) => {
    setStorageState((current) => ({ ...current, dailyChallengeRecords: [...current.dailyChallengeRecords, record] }));
  };

  const clearDailyRecords = () => {
    setStorageState((current) => ({ ...current, dailyChallengeRecords: [] }));
  };

  const appendDailySeAttempt = (attempt: SeAttempt) => {
    setStorageState((current) => ({ ...current, seAttempts: [...current.seAttempts, attempt] }));
  };

  const appendDailyPeriphrasisAttempt = (attempt: PeriphrasisAttempt) => {
    setStorageState((current) => ({ ...current, periphrasisAttempts: [...current.periphrasisAttempts, attempt] }));
  };

  const appendDailyMorfoAttempt = (attempt: MorfoAttempt) => {
    setStorageState((current) => ({ ...current, morfoAttempts: [...current.morfoAttempts, attempt] }));
  };

  const appendDailySintaxisAttempt = (attempt: SintaxisAttempt) => {
    setStorageState((current) => ({ ...current, sintaxisAttempts: [...current.sintaxisAttempts, attempt] }));
  };

  const appendDailyDerivativeAttempt = (attempt: DerivativeAttempt) => {
    setStorageState((current) => ({ ...current, derivativeAttempts: [...current.derivativeAttempts, attempt] }));
  };

  const currentPage =
    activeSection === "se"
      ? sePage
      : activeSection === "perifrasis"
        ? periphrasisPage
        : activeSection === "morfologia"
          ? morfoPage
          : activeSection === "sintaxis"
            ? sintaxisPage
            : activeSection === "derivative"
              ? derivativePage
              : "practice";
  const activeSectionMeta = SECTION_META[activeSection];
  const catalanDecks = useMemo(() => [...builtInCatalanDecks, ...importedCatalanDecks], [builtInCatalanDecks, importedCatalanDecks]);
  const pageTitle = globalPage
    ? globalPageLabel(globalPage, uiText)
    : sectionLabel(activeSection, uiText);

  const setPageForSection = (section: SectionName, page: PageName) => {
    setGlobalPage(null);
    if (section === "se") {
      setSePage(page);
      return;
    }
    if (section === "perifrasis") {
      setPeriphrasisPage(page);
      return;
    }
    if (section === "morfologia") {
      setMorfoPage(page);
      return;
    }
    if (section === "sintaxis") {
      setSintaxisPage(page);
      return;
    }
    setDerivativePage(page);
  };

  return (
    <UiTextProvider language={storageState.uiLanguage}>
    <div className="app-shell">
      <header className="globalnav">
        <div className="globalnav__inner">
          <button
            className="globalnav__brand"
            type="button"
            onClick={() => {
              setExerciseMenuOpen(false);
              setGlobalPage(null);
              setActiveSection("se");
              setSePage("practice");
            }}
          >
            <span>Habitro</span>
          </button>

          <nav className="globalnav__menu" aria-label={uiText.sectionsAria}>
            <div className="globalnav__group" ref={exerciseMenuRef}>
              <button
                aria-expanded={exerciseMenuOpen}
                aria-haspopup="menu"
                aria-pressed={!globalPage}
                className={cx("globalnav__link", !globalPage && "globalnav__link--current")}
                type="button"
                onClick={() => setExerciseMenuOpen((current) => !current)}
              >
                {uiText.exercises}
              </button>
              {exerciseMenuOpen ? (
                <div className="globalnav__dropdown" role="menu" aria-label={uiText.exercises}>
                  {SECTION_ORDER.map((section) => (
                    <button
                      key={section}
                      className={cx(
                        "globalnav__dropdown-link",
                        !globalPage && activeSection === section && "globalnav__dropdown-link--current",
                      )}
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setExerciseMenuOpen(false);
                        setGlobalPage(null);
                        setActiveSection(section);
                      }}
                    >
                      {sectionLabel(section, uiText)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {GLOBAL_PAGE_ORDER.map((pageKey) => (
              <button
                key={pageKey}
                aria-pressed={globalPage === pageKey}
                className={cx("globalnav__link", globalPage === pageKey && "globalnav__link--current")}
                type="button"
                onClick={() => {
                  setExerciseMenuOpen(false);
                  setGlobalPage(pageKey);
                }}
              >
                {globalPageLabel(pageKey, uiText)}
              </button>
            ))}
          </nav>

        </div>
      </header>

      <div className="app-frame">
        <section className="workspace-shell">
          <section className={cx("hero-banner", !globalPage && activeSectionMeta.theme === "dark" && "hero-banner--dark")}>
            <div className="hero-banner__copy">
              <h1>{pageTitle}</h1>
              {!globalPage && activeSection !== "catalan" && activeSection !== "philosophy" ? (
                <div className="cta-links">
                  {SECTION_PAGE_ORDER.map((pageKey) => (
                    <PageAction
                      key={pageKey}
                      active={currentPage === pageKey}
                      label={pageLabel(pageKey, uiText)}
                      onClick={() => setPageForSection(activeSection, pageKey)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <main className="main-stage">
            {globalPage === "daily" ? (
              <DailyChallengePage
                catalanDecks={catalanDecks}
                storageState={storageState}
                onActiveSectionChange={setActiveSection}
                onAppendDerivativeAttempt={appendDailyDerivativeAttempt}
                onAppendMorfoAttempt={appendDailyMorfoAttempt}
                onAppendPeriphrasisAttempt={appendDailyPeriphrasisAttempt}
                onAppendSeAttempt={appendDailySeAttempt}
                onAppendSintaxisAttempt={appendDailySintaxisAttempt}
                onCompleteRecord={appendDailyRecord}
              />
            ) : globalPage === "records" ? (
              <PersonalTimesPage records={storageState.dailyChallengeRecords} />
            ) : globalPage === "storage" ? (
              <QuestionBankStoragePage
                derivativeQuestionBank={storageState.derivativeQuestionBank}
                morfoQuestionBank={storageState.morfoQuestionBank}
                morfoSettings={storageState.morfoSettings}
                periphrasisQuestionBank={storageState.periphrasisQuestionBank}
                periphrasisSettings={storageState.periphrasisSettings}
                seQuestionBank={storageState.seQuestionBank}
                seSettings={storageState.seSettings}
                sintaxisQuestionBank={storageState.sintaxisQuestionBank}
                sintaxisSettings={storageState.sintaxisSettings}
                onDerivativeQuestionBankChange={updateDerivativeQuestionBank}
                onMorfoQuestionBankChange={updateMorfoQuestionBank}
                onPeriphrasisQuestionBankChange={updatePeriphrasisQuestionBank}
                onSeQuestionBankChange={updateSeQuestionBank}
                onSintaxisQuestionBankChange={updateSintaxisQuestionBank}
              />
            ) : globalPage === "settings" ? (
              <GlobalSettingsPage
                catalanDecks={catalanDecks}
                storageState={storageState}
                onDailyChallengeRecordsClear={clearDailyRecords}
                onDailyChallengeSettingsChange={updateDailyChallengeSettings}
                onDerivativeSettingsChange={updateDerivativeSettings}
                onGeminiApiKeyChange={updateGeminiApiKey}
                onMorfoSettingsChange={updateMorfoSettings}
                onPeriphrasisSettingsChange={updatePeriphrasisSettings}
                onSeSettingsChange={updateSeSettings}
                onSintaxisSettingsChange={updateSintaxisSettings}
                onUiLanguageChange={updateUiLanguage}
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
                <SintaxisWorkspace
                  active={activeSection === "sintaxis"}
                  page={sintaxisPage}
                  settings={storageState.sintaxisSettings}
                  attempts={storageState.sintaxisAttempts}
                  questionBank={storageState.sintaxisQuestionBank}
                  onSettingsChange={updateSintaxisSettings}
                  onAttemptsChange={updateSintaxisAttempts}
                />
                <DerivativeWorkspace
                  active={activeSection === "derivative"}
                  page={derivativePage}
                  settings={storageState.derivativeSettings}
                  attempts={storageState.derivativeAttempts}
                  questionBank={storageState.derivativeQuestionBank}
                  onSettingsChange={updateDerivativeSettings}
                  onAttemptsChange={updateDerivativeAttempts}
                />
                <CatalanPracticeApp active={activeSection === "catalan"} />
                <PhilosophyPracticeApp active={activeSection === "philosophy"} />
              </>
            )}
          </main>
        </section>
      </div>
    </div>
    </UiTextProvider>
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
  const uiText = useUiText();
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

        const manualItems = manualSeBatch(strategies, recentSentences, questionBank);
        manualItems.forEach((item, index) => assignCandidate(index, item));

        const finalized = prepared.filter((item): item is SeItem => item !== null);
        if (finalized.length === 0) {
          setStatusNote(uiText.manualBankEmpty);
          setStatusTone("warn");
        } else if (finalized.length < batchSize) {
          setStatusNote(uiText.incompleteBatch);
          setStatusTone("warn");
        } else {
          setStatusNote("");
          setStatusTone("info");
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
            (error instanceof Error ? `${error.message} ${uiText.apiKeyNeeded}` : uiText.apiKeyNeeded),
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
              <FieldLabel label={uiText.mode} hint="Usa refuerzo de debilidades cuando hay historial." />
              <label className="checkbox-line">
                <input
                  checked={settings.personalized}
                  onChange={(event) => onSettingsChange({ ...settings, personalized: event.target.checked })}
                  type="checkbox"
                />
                <span>{uiText.personalized}</span>
              </label>
            </div>

            <BatchSizeControl
              value={settings.batchSize}
              onChange={(batchSize) => onSettingsChange({ ...settings, batchSize })}
            />

            <div className="field-block">
              <FieldLabel label={uiText.values} />
              <MultiToggleList options={availableSeValues} selected={settings.focusValues} onToggle={toggleFocusValue} />

              <div className="custom-value-editor">
                <div className="custom-value-form">
                  <input
                    aria-label={uiText.customValue}
                    placeholder={uiText.newValue}
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
                    {uiText.add}
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
                <FieldLabel label={uiText.weaknessWeight} />
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
                <FieldLabel label={uiText.normalWeight} />
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
              {isGenerating ? uiText.preparingBatch : queue.length > 0 ? uiText.nextPhrase : uiText.generateBatch}
            </button>
          </div>

          <div className="panel practice-panel">
            {!currentItem ? (
              <div className="empty-state">
                <h3>{uiText.generatePhraseStart}</h3>
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
                  {uiText.checkResponse}
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
                        {isRechecking ? uiText.reviewing : uiText.review}
                      </button>
                    </div>

                    {recheck ? (
                      <div className="info-block">
                        {recheck.success ? (
                          <>
                            <p className={recheck.isCorrect ? "result-ok" : "result-bad"}>
                              {recheck.isCorrect ? `OK (${recheck.model})` : `${uiText.review} (${recheck.model})`}
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
                        {isAsking ? uiText.asking : uiText.ask}
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
                <h3>{uiText.localLearningByProfile}</h3>
              </div>
              <label className="checkbox-line">
                <input
                  checked={settings.hideHistory}
                  onChange={(event) => onSettingsChange({ ...settings, hideHistory: event.target.checked })}
                  type="checkbox"
                />
                <span>{uiText.hideHistory}</span>
              </label>
            </div>

            {settings.hideHistory ? (
              <p>{uiText.historyHidden}</p>
            ) : (
              <>
                <div className="row-between">
                  <p>
                    {uiText.totalAttempts}: {profile.totalAttempts} | {uiText.fullAccuracy}: {seAccuracy(profileAttempts).toFixed(1)}%
                  </p>
                  <label className="checkbox-line">
                    <input checked={historyOnlyErrors} onChange={(event) => setHistoryOnlyErrors(event.target.checked)} type="checkbox" />
                    <span>{uiText.showOnlyFailures}</span>
                  </label>
                </div>

                <div className="stats-grid">
                  <div className="info-block">
                    <h4 className="section-heading">{uiText.hardestValue}</h4>
                    <SummaryList rows={profile.weakValues} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">{uiText.hardestFunction}</h4>
                    <SummaryList rows={profile.weakFunctions} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">{uiText.bestValue}</h4>
                    <SummaryList rows={profile.strongValues} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">{uiText.bestFunction}</h4>
                    <SummaryList rows={profile.strongFunctions} />
                  </div>
                </div>

                <div className="stack-lg">
                  <div>
                    <h4 className="section-heading">{uiText.exactPerformanceValueFunction}</h4>
                    <DataTable
                      headers={[uiText.axis, uiText.item, uiText.ok, uiText.failures, uiText.attempts, uiText.failRate]}
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
                    <h4 className="section-heading">{uiText.mostMissedCombinations}</h4>
                    <DataTable
                      headers={[uiText.pair, uiText.ok, uiText.failures, uiText.attempts, uiText.failRate]}
                      rows={profile.weakPairs.map((row) => [row.pair, row.ok, row.fail, row.attempts, `${(row.failRate * 100).toFixed(1)}%`])}
                    />
                  </div>

                  <div>
                    <h4 className="section-heading">{uiText.savedAttempts}</h4>
                    <DataTable
                      headers={[uiText.date, uiText.phrase, uiText.expected, uiText.yourAnswer, uiText.status, uiText.exerciseMode]}
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
                    <span>{uiText.clearProfileHistoryConfirm}</span>
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
                    {uiText.resetHistory}
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
            <h3>{uiText.profileAndModel}</h3>

            <div className="field-grid">
              <div>
                <FieldLabel label={uiText.profile} hint="Afecta el historial local y el refuerzo personalizado." />
                <input value={profileDraft} onChange={(event) => setProfileDraft(event.target.value)} />
              </div>
              <div>
                <FieldLabel label={uiText.geminiModel} hint="Si no hay clave valida, se usara el banco local." />
                <select value={selectedModelDraft} onChange={(event) => setSelectedModelDraft(event.target.value)}>
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value="custom">{uiText.customManual}</option>
                </select>
              </div>
            </div>

            <div>
              <FieldLabel label={uiText.customModel} hint="Solo se usa si eliges la opcion manual." />
              <input
                disabled={selectedModelDraft !== "custom"}
                placeholder="ej. gemini-2.5-flash-lite"
                value={customModelDraft}
                onChange={(event) => setCustomModelDraft(event.target.value)}
              />
            </div>

            <button className="primary-btn" type="button" onClick={saveSettingsDraft}>
              {uiText.saveSettings}
            </button>

            <GeminiKeyPanel apiKey={apiKey} onApiKeyChange={onApiKeyChange} />

            {settings.modelName.toLowerCase().startsWith("gemma") ? (
              <div className="info-block">
                <p>{uiText.gemmaActive}</p>
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
  const uiText = useUiText();
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

        const manualItems = manualPeriphrasisBatch(strategies, recentSentences, questionBank);
        manualItems.forEach((item, index) => assignCandidate(index, item));

        const finalized = prepared.filter((item): item is PeriphrasisItem => item !== null);
        if (finalized.length === 0) {
          setStatusNote(uiText.manualBankEmpty);
        } else if (finalized.length < batchSize) {
          setStatusNote(uiText.incompleteBatch);
        } else {
          setStatusNote("");
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
              <FieldLabel label={uiText.mode} hint="Usa refuerzo de debilidades cuando hay historial." />
              <label className="checkbox-line">
                <input
                  checked={settings.personalized}
                  onChange={(event) => onSettingsChange({ ...settings, personalized: event.target.checked })}
                  type="checkbox"
                />
                <span>{uiText.personalized}</span>
              </label>
            </div>

            <BatchSizeControl
              value={settings.batchSize}
              onChange={(batchSize) => onSettingsChange({ ...settings, batchSize })}
            />

            <div className="field-block">
              <FieldLabel label={uiText.structures} />
              <MultiToggleList options={PERIPHRASIS_STRUCTURES} selected={settings.focusStructures} onToggle={toggleFocusStructure} />
            </div>

            <div className="field-block">
              <FieldLabel label={uiText.addCustomType} hint="Ej. Obligacion atenuada. Se guarda en esta seccion." />
              <div className="field-grid compact-grid">
                <input
                  placeholder="Ej. Obligacion atenuada"
                  value={customTypeInput}
                  onChange={(event) => setCustomTypeInput(event.target.value)}
                />
                <button className="ghost-btn" type="button" onClick={addCustomPeriphrasisType}>
                  {uiText.addType}
                </button>
              </div>
            </div>

            <div className="field-grid compact-grid">
              <div>
                <FieldLabel label={uiText.weaknessWeight} />
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
                <FieldLabel label={uiText.normalWeight} />
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
              {isGenerating ? uiText.preparingBatch : queue.length > 0 ? uiText.nextPhrase : uiText.generateBatch}
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
                <h3>{uiText.generatePhraseStart}</h3>
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
                  {uiText.checkResponse}
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
                <h3>{uiText.localLearningByProfile}</h3>
              </div>
              <label className="checkbox-line">
                <input
                  checked={settings.hideHistory}
                  onChange={(event) => onSettingsChange({ ...settings, hideHistory: event.target.checked })}
                  type="checkbox"
                />
                <span>{uiText.hideHistory}</span>
              </label>
            </div>

            {settings.hideHistory ? (
              <p>{uiText.historyHidden}</p>
            ) : (
              <>
                <div className="row-between">
                  <p>
                    {uiText.totalAttempts}: {profile.totalAttempts} | {uiText.fullAccuracy}: {periphrasisAccuracy(profileAttempts).toFixed(1)}%
                  </p>
                  <label className="checkbox-line">
                    <input checked={historyOnlyErrors} onChange={(event) => setHistoryOnlyErrors(event.target.checked)} type="checkbox" />
                    <span>{uiText.showOnlyFailures}</span>
                  </label>
                </div>

                <div className="stats-grid">
                  <div className="info-block">
                    <h4 className="section-heading">{uiText.hardestStructure}</h4>
                    <SummaryList rows={profile.weakStructures} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">{uiText.hardestType}</h4>
                    <SummaryList rows={profile.weakPeriphrasisTypes} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">{uiText.bestStructure}</h4>
                    <SummaryList rows={profile.strongStructures} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">{uiText.bestType}</h4>
                    <SummaryList rows={profile.strongPeriphrasisTypes} />
                  </div>
                </div>

                <div className="stack-lg">
                  <div>
                    <h4 className="section-heading">{uiText.exactPerformanceAxis}</h4>
                    <DataTable
                      headers={[uiText.axis, uiText.item, uiText.ok, uiText.failures, uiText.attempts, uiText.failRate]}
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
                    <h4 className="section-heading">{uiText.mostMissedCombinations}</h4>
                    <DataTable
                      headers={[uiText.pair, uiText.ok, uiText.failures, uiText.attempts, uiText.failRate]}
                      rows={profile.weakPairs.map((row) => [row.pair, row.ok, row.fail, row.attempts, `${(row.failRate * 100).toFixed(1)}%`])}
                    />
                  </div>

                  <div>
                    <h4 className="section-heading">{uiText.savedAttempts}</h4>
                    <DataTable
                      headers={[uiText.date, uiText.phrase, uiText.expected, uiText.yourAnswer, uiText.status, uiText.exerciseMode]}
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
                    <span>{uiText.clearProfileHistoryConfirm}</span>
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
                    {uiText.resetHistory}
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
            <h3>{uiText.profileAndModel}</h3>

            <div className="field-grid">
              <div>
                <FieldLabel label={uiText.profile} hint="Afecta el historial local y el refuerzo personalizado." />
                <input value={profileDraft} onChange={(event) => setProfileDraft(event.target.value)} />
              </div>
              <div>
                <FieldLabel label={uiText.geminiModel} hint="Si no hay clave valida, se usara el banco local." />
                <select value={selectedModelDraft} onChange={(event) => setSelectedModelDraft(event.target.value)}>
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value="custom">{uiText.customManual}</option>
                </select>
              </div>
            </div>

            <div>
              <FieldLabel label={uiText.customModel} hint="Solo se usa si eliges la opcion manual." />
              <input
                disabled={selectedModelDraft !== "custom"}
                placeholder="ej. gemini-2.5-flash-lite"
                value={customModelDraft}
                onChange={(event) => setCustomModelDraft(event.target.value)}
              />
            </div>

            <div>
              <FieldLabel
                label={uiText.customPeriphrasisTypes}
                hint={uiText.customPeriphrasisHint}
              />
              <input
                placeholder={uiText.customPeriphrasisPlaceholder}
                value={customTypesDraft}
                onChange={(event) => setCustomTypesDraft(event.target.value)}
              />
            </div>

            <button className="primary-btn" type="button" onClick={saveSettingsDraft}>
              {uiText.saveSettings}
            </button>

            <GeminiKeyPanel apiKey={apiKey} onApiKeyChange={onApiKeyChange} />

            {settings.modelName.toLowerCase().startsWith("gemma") ? (
              <div className="info-block">
                <p>{uiText.gemmaActive}</p>
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
  const uiText = useUiText();
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

        const manualItems = manualMorfoBatch(strategies, recentWords, questionBank);
        manualItems.forEach((item) => {
          if (item) {
            pushCandidate(item);
          }
        });
        if (prepared.length === 0) {
          setStatusNote(uiText.manualBankEmpty);
          setStatusTone("warn");
        } else if (prepared.length < batchSize) {
          setStatusNote(uiText.incompleteBatch);
          setStatusTone("warn");
        } else {
          setStatusNote("");
          setStatusTone("info");
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
            (error instanceof Error ? `${error.message} ${uiText.apiKeyNeeded}` : uiText.apiKeyNeeded),
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
              <FieldLabel label={uiText.mode} hint="Usa refuerzo de debilidades cuando hay historial." />
              <label className="checkbox-line">
                <input
                  checked={settings.personalized}
                  onChange={(event) => onSettingsChange({ ...settings, personalized: event.target.checked })}
                  type="checkbox"
                />
                <span>{uiText.personalized}</span>
              </label>
            </div>

            <BatchSizeControl
              value={settings.batchSize}
              onChange={(batchSize) => onSettingsChange({ ...settings, batchSize })}
            />

            <div className="field-block">
              <FieldLabel label={uiText.types} />
              <MultiToggleList options={MORFO_WORD_TYPES} selected={settings.focusWordTypes} onToggle={toggleFocusWordType} />
            </div>

            <div className="field-grid compact-grid">
              <div>
                <FieldLabel label={uiText.weaknessWeight} />
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
                <FieldLabel label={uiText.normalWeight} />
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
              {isGenerating ? uiText.preparingBatch : queue.length > 0 ? uiText.nextWord : uiText.generateBatch}
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
                <h3>{uiText.generateWordStart}</h3>
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
                  {uiText.checkResponse}
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
                        {isRechecking ? uiText.reviewing : uiText.review}
                      </button>
                    </div>

                    {recheck ? (
                      <div className="info-block">
                        {recheck.success ? (
                          <>
                            <p className={recheck.isCorrect ? "result-ok" : "result-bad"}>
                              {recheck.isCorrect ? `OK (${recheck.model})` : `${uiText.review} (${recheck.model})`}
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
                        {isAsking ? uiText.asking : uiText.ask}
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
                <h3>{uiText.localLearningByProfile}</h3>
              </div>
              <label className="checkbox-line">
                <input
                  checked={settings.hideHistory}
                  onChange={(event) => onSettingsChange({ ...settings, hideHistory: event.target.checked })}
                  type="checkbox"
                />
                <span>{uiText.hideHistory}</span>
              </label>
            </div>

            {settings.hideHistory ? (
              <p>{uiText.historyHidden}</p>
            ) : (
              <>
                <div className="row-between">
                  <p>{uiText.totalAttempts}: {profile.totalAttempts}</p>
                  <label className="checkbox-line">
                    <input checked={historyOnlyErrors} onChange={(event) => setHistoryOnlyErrors(event.target.checked)} type="checkbox" />
                    <span>{uiText.showOnlyFailures}</span>
                  </label>
                </div>

                <div className="stats-grid">
                  <div className="info-block">
                    <h4 className="section-heading">{uiText.hardestType}</h4>
                    <SummaryList rows={profile.weakWordTypes} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">{uiText.hardestMorpheme}</h4>
                    <SummaryList rows={profile.weakMorphemeTypes} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">{uiText.bestType}</h4>
                    <SummaryList rows={profile.strongWordTypes} />
                  </div>
                  <div className="info-block">
                    <h4 className="section-heading">{uiText.bestMorpheme}</h4>
                    <SummaryList rows={profile.strongMorphemeTypes} />
                  </div>
                </div>

                <div className="stack-lg">
                  <div>
                    <h4 className="section-heading">{uiText.exactPerformanceTypeMorpheme}</h4>
                    <DataTable
                      headers={[uiText.axis, uiText.item, uiText.ok, uiText.failures, uiText.attempts, uiText.failRate]}
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
                    <h4 className="section-heading">{uiText.mostMissedCombinations}</h4>
                    <DataTable
                      headers={[uiText.pair, uiText.ok, uiText.failures, uiText.attempts, uiText.failRate]}
                      rows={profile.weakPairs.map((row) => [row.pair, row.ok, row.fail, row.attempts, `${(row.failRate * 100).toFixed(1)}%`])}
                    />
                  </div>

                  <div>
                    <h4 className="section-heading">{uiText.savedAttempts}</h4>
                    <DataTable
                      headers={[uiText.date, uiText.word, uiText.expected, uiText.yourAnswer, uiText.status, uiText.exerciseMode]}
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
                    <span>{uiText.clearProfileHistoryConfirm}</span>
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
                    {uiText.resetHistory}
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
            <h3>{uiText.profileAndModel}</h3>

            <div className="field-grid">
              <div>
                <FieldLabel label={uiText.profile} hint="Afecta el historial local y el refuerzo personalizado." />
                <input value={profileDraft} onChange={(event) => setProfileDraft(event.target.value)} />
              </div>
              <div>
                <FieldLabel label={uiText.geminiModel} hint="Si no hay clave valida, se usara el banco local." />
                <select value={selectedModelDraft} onChange={(event) => setSelectedModelDraft(event.target.value)}>
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value="custom">{uiText.customManual}</option>
                </select>
              </div>
            </div>

            <div>
              <FieldLabel label={uiText.customModel} hint="Solo se usa si eliges la opcion manual." />
              <input
                disabled={selectedModelDraft !== "custom"}
                placeholder="ej. gemini-2.5-flash-lite"
                value={customModelDraft}
                onChange={(event) => setCustomModelDraft(event.target.value)}
              />
            </div>

            <button className="primary-btn" type="button" onClick={saveSettingsDraft}>
              {uiText.saveSettings}
            </button>

            <GeminiKeyPanel apiKey={apiKey} onApiKeyChange={onApiKeyChange} />

            {settings.modelName.toLowerCase().startsWith("gemma") ? (
              <div className="info-block">
                <p>{uiText.gemmaActive}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SintaxisWorkspace({
  active,
  page,
  settings,
  attempts,
  questionBank,
  onSettingsChange,
  onAttemptsChange,
}: {
  active: boolean;
  page: PageName;
  settings: SintaxisSettings;
  attempts: SintaxisAttempt[];
  questionBank: StoredSintaxisItem[];
  onSettingsChange: (settings: SintaxisSettings) => void;
  onAttemptsChange: (attempts: SintaxisAttempt[]) => void;
}) {
  const uiText = useUiText();
  const profileAttempts = useMemo(
    () => attempts.filter((attempt) => attempt.profileId === settings.profileId),
    [attempts, settings.profileId],
  );
  const [currentItem, setCurrentItem] = useState<SintaxisItem | null>(null);
  const [queue, setQueue] = useState<SintaxisItem[]>([]);
  const [checkedItemId, setCheckedItemId] = useState<string | null>(null);
  const [correctionVisible, setCorrectionVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [statusTone, setStatusTone] = useState<"info" | "warn">("info");
  const [profileDraft, setProfileDraft] = useState(settings.profileId);

  useEffect(() => {
    setCorrectionVisible(false);
  }, [currentItem?.id]);

  useEffect(() => {
    setProfileDraft(settings.profileId);
  }, [settings.profileId]);

  const handleGenerate = () => {
    setIsGenerating(true);
    try {
      let nextQueue = [...queue];
      if (nextQueue.length === 0) {
        const batchSize = coercePracticeBatchSize(settings.batchSize);
        const recentPhrases = fetchRecentSintaxisPhrases(attempts, settings.profileId, 14);
        const manualItems = manualSintaxisBatch(
          batchSize,
          recentPhrases,
          questionBank,
          settings.randomizeOrder,
        );
        const finalized = manualItems.filter((item): item is SintaxisItem => item !== null);

        if (finalized.length === 0) {
          setStatusNote(uiText.manualBankEmpty);
          setStatusTone("warn");
        } else if (finalized.length < batchSize) {
          setStatusNote(uiText.incompleteBatch);
          setStatusTone("warn");
        } else {
          setStatusNote("");
          setStatusTone("info");
        }

        nextQueue = settings.randomizeOrder ? shuffleList(finalized) : finalized;
      }

      const [nextItem, ...rest] = nextQueue;
      setCurrentItem(nextItem ?? null);
      setQueue(rest);
      setCheckedItemId(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevealCorrection = () => {
    if (!currentItem) {
      return;
    }
    setCorrectionVisible(true);

    if (checkedItemId !== currentItem.id) {
      onAttemptsChange([...attempts, makeSintaxisAttempt(currentItem, settings, "")]);
      setCheckedItemId(currentItem.id);
    }
  };

  const saveSettingsDraft = () => {
    onSettingsChange({
      ...settings,
      profileId: profileDraft.trim() || "alumno",
      itemSource: "manual",
    });
  };

  return (
    <section className={cx("workspace", !active && "hidden-workspace")}>
      {page === "practice" ? (
        <div className="page-grid">
          <div className="panel control-panel">
            <BatchSizeControl
              value={settings.batchSize}
              onChange={(batchSize) => {
                onSettingsChange({ ...settings, batchSize, itemSource: "manual" });
                setQueue([]);
              }}
            />

            <div className="field-block">
              <label className="checkbox-line">
                <input
                  checked={settings.randomizeOrder}
                  onChange={(event) => {
                    onSettingsChange({ ...settings, randomizeOrder: event.target.checked, itemSource: "manual" });
                    setQueue([]);
                  }}
                  type="checkbox"
                />
                <span>{uiText.randomOrder}</span>
              </label>
              <div className="button-row">
                <button
                  className="ghost-btn"
                  disabled={queue.length < 2}
                  type="button"
                  onClick={() => setQueue((current) => shuffleList(current))}
                >
                  {uiText.shufflePending}
                </button>
              </div>
            </div>

            {statusNote ? <div className={cx("inline-banner", statusTone === "warn" && "warn")}>{statusNote}</div> : null}

            <button className="primary-btn" disabled={isGenerating} type="button" onClick={handleGenerate}>
              {isGenerating ? uiText.preparingBatch : queue.length > 0 ? uiText.nextPhrase : uiText.generateBatch}
            </button>
          </div>

          <div className="panel practice-panel">
            {!currentItem ? (
              <div className="empty-state">
                <h3>{uiText.generatePhraseStart}</h3>
              </div>
            ) : (
              <div className="sintaxis-practice-column">
                <h3 className="prompt-text sintaxis-prompt-text">{currentItem.phrase}</h3>

                <button className="primary-btn sintaxis-correction-btn" type="button" onClick={handleRevealCorrection}>
                  {uiText.showCorrection}
                </button>

                {correctionVisible ? (
                  <div className="info-block markdown-correction sintaxis-correction-box">
                    <ReactMarkdown>{currentItem.correction}</ReactMarkdown>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {page === "history" ? (
        <div className="page-grid single-column">
          <div className="panel">
            <div className="row-between">
              <div>
                <h3>{uiText.localHistoryByProfile}</h3>
              </div>
              <label className="checkbox-line">
                <input
                  checked={settings.hideHistory}
                  onChange={(event) => onSettingsChange({ ...settings, hideHistory: event.target.checked, itemSource: "manual" })}
                  type="checkbox"
                />
                <span>{uiText.hideHistory}</span>
              </label>
            </div>

            {settings.hideHistory ? (
              <p>{uiText.historyHidden}</p>
            ) : (
              <>
                <div className="row-between">
                  <p>{uiText.totalAttempts}: {profileAttempts.length}</p>
                </div>

                <div className="stack-lg">
                  <div>
                    <h4 className="section-heading">{uiText.savedAttempts}</h4>
                    <DataTable
                      headers={[uiText.date, uiText.phrase, uiText.exerciseMode]}
                      rows={profileAttempts.map((attempt) => [
                        new Date(attempt.createdAt).toLocaleString(),
                        attempt.phrase,
                        attempt.mode,
                      ])}
                    />
                  </div>
                </div>

                <div className="danger-zone">
                  <label className="checkbox-line">
                    <input checked={resetConfirmed} onChange={(event) => setResetConfirmed(event.target.checked)} type="checkbox" />
                    <span>{uiText.clearProfileHistoryConfirm}</span>
                  </label>
                  <button
                    className="danger-btn"
                    disabled={!resetConfirmed}
                    type="button"
                    onClick={() => {
                      onAttemptsChange(resetSintaxisAttempts(attempts, settings.profileId));
                      setResetConfirmed(false);
                    }}
                  >
                    {uiText.resetHistory}
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
            <h3>{uiText.profile}</h3>

            <div className="field-grid">
              <div>
                <FieldLabel label={uiText.profile} hint="Afecta el historial local." />
                <input value={profileDraft} onChange={(event) => setProfileDraft(event.target.value)} />
              </div>
            </div>

            <button className="primary-btn" type="button" onClick={saveSettingsDraft}>
              {uiText.saveSettings}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DerivativeWorkspace({
  active,
  page,
  settings,
  attempts,
  questionBank,
  onSettingsChange,
  onAttemptsChange,
}: {
  active: boolean;
  page: PageName;
  settings: DerivativeSettings;
  attempts: DerivativeAttempt[];
  questionBank: StoredDerivativeItem[];
  onSettingsChange: (settings: DerivativeSettings) => void;
  onAttemptsChange: (attempts: DerivativeAttempt[]) => void;
}) {
  const uiText = useUiText();
  const profileAttempts = useMemo(
    () => attempts.filter((attempt) => attempt.profileId === settings.profileId),
    [attempts, settings.profileId],
  );
  const [currentItem, setCurrentItem] = useState<DerivativeItem | null>(null);
  const [queue, setQueue] = useState<DerivativeItem[]>([]);
  const [checkedItemId, setCheckedItemId] = useState<string | null>(null);
  const [answerVisible, setAnswerVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [statusTone, setStatusTone] = useState<"info" | "warn">("info");
  const [profileDraft, setProfileDraft] = useState(settings.profileId);

  useEffect(() => {
    setAnswerVisible(false);
  }, [currentItem?.id]);

  useEffect(() => {
    setProfileDraft(settings.profileId);
  }, [settings.profileId]);

  const handleGenerate = () => {
    setIsGenerating(true);
    try {
      let nextQueue = [...queue];
      if (nextQueue.length === 0) {
        const batchSize = coercePracticeBatchSize(settings.batchSize);
        const recentFunctions = fetchRecentDerivativeFunctions(attempts, settings.profileId, 14);
        const manualItems = manualDerivativeBatch(
          batchSize,
          recentFunctions,
          questionBank,
          settings.randomizeOrder,
        );
        const finalized = manualItems.filter((item): item is DerivativeItem => item !== null);

        if (finalized.length === 0) {
          setStatusNote(uiText.manualBankEmpty);
          setStatusTone("warn");
        } else if (finalized.length < batchSize) {
          setStatusNote(uiText.incompleteBatch);
          setStatusTone("warn");
        } else {
          setStatusNote("");
          setStatusTone("info");
        }

        nextQueue = settings.randomizeOrder ? shuffleList(finalized) : finalized;
      }

      const [nextItem, ...rest] = nextQueue;
      setCurrentItem(nextItem ?? null);
      setQueue(rest);
      setCheckedItemId(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevealAnswer = () => {
    if (!currentItem) {
      return;
    }
    setAnswerVisible(true);

    if (checkedItemId !== currentItem.id) {
      onAttemptsChange([...attempts, makeDerivativeAttempt(currentItem, settings)]);
      setCheckedItemId(currentItem.id);
    }
  };

  const saveSettingsDraft = () => {
    onSettingsChange({
      ...settings,
      profileId: profileDraft.trim() || "alumno",
      itemSource: "manual",
    });
  };

  return (
    <section className={cx("workspace", !active && "hidden-workspace")}>
      {page === "practice" ? (
        <div className="page-grid">
          <div className="panel control-panel">
            <BatchSizeControl
              value={settings.batchSize}
              onChange={(batchSize) => {
                onSettingsChange({ ...settings, batchSize, itemSource: "manual" });
                setQueue([]);
              }}
            />

            <div className="field-block">
              <label className="checkbox-line">
                <input
                  checked={settings.randomizeOrder}
                  onChange={(event) => {
                    onSettingsChange({ ...settings, randomizeOrder: event.target.checked, itemSource: "manual" });
                    setQueue([]);
                  }}
                  type="checkbox"
                />
                <span>{uiText.randomOrder}</span>
              </label>
              <div className="button-row">
                <button
                  className="ghost-btn"
                  disabled={queue.length < 2}
                  type="button"
                  onClick={() => setQueue((current) => shuffleList(current))}
                >
                  {uiText.shufflePending}
                </button>
              </div>
            </div>

            {statusNote ? <div className={cx("inline-banner", statusTone === "warn" && "warn")}>{statusNote}</div> : null}

            <button className="primary-btn" disabled={isGenerating} type="button" onClick={handleGenerate}>
              {isGenerating ? uiText.preparingBatch : queue.length > 0 ? uiText.nextFunction : uiText.generateBatch}
            </button>
          </div>

          <div className="panel practice-panel">
            {!currentItem ? (
              <div className="empty-state">
                <h3>{uiText.generateFunctionStart}</h3>
              </div>
            ) : (
              <div className="derivative-practice-column">
                <MathDisplay value={currentItem.functionText} className="derivative-function-display" />

                <button className="primary-btn derivative-answer-btn" type="button" onClick={handleRevealAnswer}>
                  {uiText.showAnswer}
                </button>

                {answerVisible ? (
                  <div className="info-block derivative-answer-box">
                    <MathDisplay value={currentItem.derivative} className="derivative-answer-display" />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {page === "history" ? (
        <div className="page-grid single-column">
          <div className="panel">
            <div className="row-between">
              <div>
                <h3>{uiText.localHistoryByProfile}</h3>
              </div>
              <label className="checkbox-line">
                <input
                  checked={settings.hideHistory}
                  onChange={(event) => onSettingsChange({ ...settings, hideHistory: event.target.checked, itemSource: "manual" })}
                  type="checkbox"
                />
                <span>{uiText.hideHistory}</span>
              </label>
            </div>

            {settings.hideHistory ? (
              <p>{uiText.historyHidden}</p>
            ) : (
              <>
                <div className="row-between">
                  <p>{uiText.totalAttempts}: {profileAttempts.length}</p>
                </div>

                <div className="stack-lg">
                  <div>
                    <h4 className="section-heading">{uiText.savedAttempts}</h4>
                    <DataTable
                      headers={[uiText.date, uiText.function, uiText.derivative, uiText.exerciseMode]}
                      rows={profileAttempts.map((attempt) => [
                        new Date(attempt.createdAt).toLocaleString(),
                        attempt.functionText,
                        attempt.derivative,
                        attempt.mode,
                      ])}
                    />
                  </div>
                </div>

                <div className="danger-zone">
                  <label className="checkbox-line">
                    <input checked={resetConfirmed} onChange={(event) => setResetConfirmed(event.target.checked)} type="checkbox" />
                    <span>{uiText.clearProfileHistoryConfirm}</span>
                  </label>
                  <button
                    className="danger-btn"
                    disabled={!resetConfirmed}
                    type="button"
                    onClick={() => {
                      onAttemptsChange(resetDerivativeAttempts(attempts, settings.profileId));
                      setResetConfirmed(false);
                    }}
                  >
                    {uiText.resetHistory}
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
            <h3>{uiText.profile}</h3>

            <div className="field-grid">
              <div>
                <FieldLabel label={uiText.profile} hint="Afecta el historial local." />
                <input value={profileDraft} onChange={(event) => setProfileDraft(event.target.value)} />
              </div>
            </div>

            <button className="primary-btn" type="button" onClick={saveSettingsDraft}>
              {uiText.saveSettings}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
