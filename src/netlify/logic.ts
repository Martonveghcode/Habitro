import {
  MODEL_OPTIONS,
  MORFO_MORPHEME_TYPES,
  MORFO_SAMPLE_BANK,
  MORFO_WORD_TYPES,
  PERIPHRASIS_SAMPLE_BANK,
  PERIPHRASIS_STRUCTURES,
  PERIPHRASIS_TYPES,
  SE_FUNCTIONS,
  SE_PERIPHRASIS_TYPES,
  SE_SAMPLE_BANK,
  SE_VALUES,
  SE_VERBAL_STRUCTURES,
} from "./data";
import type {
  Difficulty,
  DerivativeAttempt,
  DerivativeItem,
  DerivativeSettings,
  ItemSource,
  MorfoAttempt,
  MorfoEvaluation,
  MorfoItem,
  MorfoProfile,
  MorfoSettings,
  MorfoStrategy,
  PairSummaryRow,
  PeriphrasisAttempt,
  PeriphrasisEvaluation,
  PeriphrasisItem,
  PeriphrasisProfile,
  PeriphrasisSettings,
  PeriphrasisStrategy,
  SeAttempt,
  SeEvaluation,
  SeItem,
  SeProfile,
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

const STORAGE_KEY = "sintaxis-netlify-practice-v1";
const DEFAULT_MODEL = MODEL_OPTIONS[0]?.value ?? "gemini-2.5-flash-lite";
export const MIN_PRACTICE_BATCH_SIZE = 1;
export const DEFAULT_PRACTICE_BATCH_SIZE = 5;
export const MAX_PRACTICE_BATCH_SIZE = 10;

export function coercePracticeBatchSize(value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_PRACTICE_BATCH_SIZE;
  }
  return Math.min(MAX_PRACTICE_BATCH_SIZE, Math.max(MIN_PRACTICE_BATCH_SIZE, Math.round(numericValue)));
}

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

function defaultSeSettings(): SeSettings {
  return {
    profileId: "alumno",
    modelName: DEFAULT_MODEL,
    itemSource: "ai",
    difficulty: 2,
    personalized: true,
    batchSize: DEFAULT_PRACTICE_BATCH_SIZE,
    focusValues: [],
    customValues: [],
    customPeriphrasisTypes: [],
    targetWeight: 40,
    normalWeight: 60,
    hideHistory: false,
  };
}

function defaultMorfoSettings(): MorfoSettings {
  return {
    profileId: "alumno",
    modelName: DEFAULT_MODEL,
    itemSource: "ai",
    difficulty: 2,
    personalized: true,
    batchSize: DEFAULT_PRACTICE_BATCH_SIZE,
    focusWordTypes: [],
    targetWeight: 40,
    normalWeight: 60,
    hideHistory: false,
  };
}

function defaultPeriphrasisSettings(): PeriphrasisSettings {
  return {
    profileId: "alumno",
    modelName: DEFAULT_MODEL,
    itemSource: "ai",
    difficulty: 2,
    personalized: true,
    batchSize: DEFAULT_PRACTICE_BATCH_SIZE,
    focusStructures: [],
    customPeriphrasisTypes: [],
    targetWeight: 40,
    normalWeight: 60,
    hideHistory: false,
  };
}

function defaultSintaxisSettings(): SintaxisSettings {
  return {
    profileId: "alumno",
    itemSource: "manual",
    difficulty: 2,
    batchSize: DEFAULT_PRACTICE_BATCH_SIZE,
    randomizeOrder: true,
    hideHistory: false,
  };
}

function defaultDerivativeSettings(): DerivativeSettings {
  return {
    profileId: "alumno",
    itemSource: "manual",
    batchSize: DEFAULT_PRACTICE_BATCH_SIZE,
    randomizeOrder: true,
    hideHistory: false,
  };
}

function sanitizeItemSource(value: unknown): ItemSource {
  return value === "manual" ? "manual" : "ai";
}

function sanitizeDifficulty(value: unknown, fallback: Difficulty = 2): Difficulty {
  return value === 1 || value === 2 || value === 3 ? value : fallback;
}

function sanitizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean) : [];
}

function sanitizeStoredSeItem(item: unknown): StoredSeItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as Partial<StoredSeItem>;
  const sentence = typeof raw.sentence === "string" ? raw.sentence.trim() : "";
  const seValue = typeof raw.seValue === "string" ? raw.seValue.trim() : "";
  const seFunction = typeof raw.seFunction === "string" ? raw.seFunction.trim() : "";
  const verbalStructure = typeof raw.verbalStructure === "string" ? raw.verbalStructure.trim() : "";
  const periphrasisType = typeof raw.periphrasisType === "string" ? raw.periphrasisType.trim() : "";
  const phraseType = typeof raw.phraseType === "string" ? raw.phraseType.trim() : "";
  const explanation = typeof raw.explanation === "string" ? raw.explanation.trim() : "";

  if (!sentence || !seValue || !seFunction || !verbalStructure || !periphrasisType || !phraseType || !explanation) {
    return null;
  }

  return {
    sentence,
    difficulty: sanitizeDifficulty(raw.difficulty),
    seValue,
    seFunction,
    acceptedFunctions: sanitizeStringList(raw.acceptedFunctions).length > 0
      ? sanitizeStringList(raw.acceptedFunctions)
      : [seFunction],
    verbalStructure,
    periphrasisType,
    phraseType,
    explanation,
  };
}

function sanitizeStoredPeriphrasisItem(item: unknown): StoredPeriphrasisItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as Partial<StoredPeriphrasisItem>;
  const sentence = typeof raw.sentence === "string" ? raw.sentence.trim() : "";
  const verbalStructure = typeof raw.verbalStructure === "string" ? raw.verbalStructure.trim() : "";
  const periphrasisType = typeof raw.periphrasisType === "string" ? raw.periphrasisType.trim() : "";
  const phraseType = typeof raw.phraseType === "string" ? raw.phraseType.trim() : "";
  const explanation = typeof raw.explanation === "string" ? raw.explanation.trim() : "";

  if (!sentence || !verbalStructure || !periphrasisType || !phraseType || !explanation) {
    return null;
  }

  return {
    sentence,
    difficulty: sanitizeDifficulty(raw.difficulty),
    verbalStructure,
    periphrasisType,
    phraseType,
    explanation,
  };
}

function sanitizeStoredMorfoItem(item: unknown): StoredMorfoItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as Partial<StoredMorfoItem>;
  const word = typeof raw.word === "string" ? raw.word.trim() : "";
  const wordType = typeof raw.wordType === "string" ? raw.wordType.trim() : "";
  const lexeme = typeof raw.lexeme === "string" ? raw.lexeme.trim() : "";
  const morphemes = sanitizeStringList(raw.morphemes);
  const morphemeTypes = sanitizeStringList(raw.morphemeTypes);
  const analysisType = typeof raw.analysisType === "string" ? raw.analysisType.trim() : "";
  const explanation = typeof raw.explanation === "string" ? raw.explanation.trim() : "";

  if (!word || !wordType || !lexeme || morphemes.length === 0 || morphemes.length !== morphemeTypes.length || !analysisType || !explanation) {
    return null;
  }

  return {
    word,
    difficulty: sanitizeDifficulty(raw.difficulty),
    wordType,
    lexeme,
    acceptedLexemes: sanitizeStringList(raw.acceptedLexemes).length > 0
      ? sanitizeStringList(raw.acceptedLexemes)
      : [lexeme],
    morphemes,
    morphemeTypes,
    analysisType,
    explanation,
  };
}

function sanitizeStoredSintaxisItem(item: unknown): StoredSintaxisItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const phrase = String(raw.phrase ?? raw.sentence ?? raw.frase ?? "").trim();
  const correction = String(
    raw.correction ?? raw.correctionMarkdown ?? raw.correction_markdown ?? raw.correccion ?? "",
  ).trim();

  if (!phrase || !correction) {
    return null;
  }

  return {
    phrase,
    difficulty: sanitizeDifficulty(raw.difficulty),
    correction,
  };
}

function derivativeFunctionFromRecord(raw: Record<string, unknown>): string {
  return String(
    raw.functionText ??
      raw.function ??
      raw.function_to_deriv ??
      raw.functionToDeriv ??
      raw.funcion ??
      "",
  ).trim();
}

function derivativeAnswerFromRecord(raw: Record<string, unknown>): string {
  return String(raw.derivative ?? raw.answer ?? raw.derivada ?? "").trim();
}

function sanitizeStoredDerivativeItem(item: unknown): StoredDerivativeItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const functionText = derivativeFunctionFromRecord(raw);
  const derivative = derivativeAnswerFromRecord(raw);

  if (!functionText || !derivative) {
    return null;
  }

  return {
    functionText,
    derivative,
  };
}

function sanitizeStoredSeAttempt(attempt: unknown): SeAttempt | null {
  if (!attempt || typeof attempt !== "object") {
    return null;
  }

  const raw = attempt as Partial<SeAttempt>;
  const expectedVerbalStructure = typeof raw.expectedVerbalStructure === "string" && raw.expectedVerbalStructure.trim()
    ? raw.expectedVerbalStructure
    : "Verbo simple";
  const expectedPeriphrasisType = typeof raw.expectedPeriphrasisType === "string" && raw.expectedPeriphrasisType.trim()
    ? raw.expectedPeriphrasisType
    : "No aplica";
  const guessVerbalStructure = typeof raw.guessVerbalStructure === "string" && raw.guessVerbalStructure.trim()
    ? raw.guessVerbalStructure
    : expectedVerbalStructure;
  const guessPeriphrasisType = typeof raw.guessPeriphrasisType === "string" && raw.guessPeriphrasisType.trim()
    ? raw.guessPeriphrasisType
    : expectedPeriphrasisType;
  const verbalStructureOk = typeof raw.verbalStructureOk === "boolean" ? raw.verbalStructureOk : true;
  const periphrasisTypeOk = typeof raw.periphrasisTypeOk === "boolean" ? raw.periphrasisTypeOk : true;
  const valueOk = Boolean(raw.valueOk);
  const functionOk = Boolean(raw.functionOk);

  return {
    ...(raw as SeAttempt),
    expectedVerbalStructure,
    expectedPeriphrasisType,
    guessVerbalStructure,
    guessPeriphrasisType,
    verbalStructureOk,
    periphrasisTypeOk,
    overallOk:
      typeof raw.overallOk === "boolean" ? raw.overallOk : valueOk && functionOk && verbalStructureOk && periphrasisTypeOk,
  };
}

function sanitizeStoredPeriphrasisAttempt(attempt: unknown): PeriphrasisAttempt | null {
  if (!attempt || typeof attempt !== "object") {
    return null;
  }

  const raw = attempt as Partial<PeriphrasisAttempt>;
  const expectedStructure = typeof raw.expectedStructure === "string" && raw.expectedStructure.trim()
    ? raw.expectedStructure
    : "Dos verbos";
  const expectedPeriphrasisType = typeof raw.expectedPeriphrasisType === "string" && raw.expectedPeriphrasisType.trim()
    ? raw.expectedPeriphrasisType
    : "No aplica";
  const guessStructure = typeof raw.guessStructure === "string" && raw.guessStructure.trim()
    ? raw.guessStructure
    : expectedStructure;
  const guessPeriphrasisType = typeof raw.guessPeriphrasisType === "string" && raw.guessPeriphrasisType.trim()
    ? raw.guessPeriphrasisType
    : expectedPeriphrasisType;
  const structureOk = typeof raw.structureOk === "boolean" ? raw.structureOk : true;
  const periphrasisTypeOk = typeof raw.periphrasisTypeOk === "boolean" ? raw.periphrasisTypeOk : true;

  return {
    ...(raw as PeriphrasisAttempt),
    expectedStructure,
    expectedPeriphrasisType,
    guessStructure,
    guessPeriphrasisType,
    structureOk,
    periphrasisTypeOk,
    overallOk:
      typeof raw.overallOk === "boolean" ? raw.overallOk : structureOk && periphrasisTypeOk,
  };
}

function sanitizeStoredSintaxisAttempt(attempt: unknown): SintaxisAttempt | null {
  if (!attempt || typeof attempt !== "object") {
    return null;
  }

  const raw = attempt as Partial<SintaxisAttempt>;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : createId("sintaxis_attempt");
  const profileId = typeof raw.profileId === "string" && raw.profileId.trim() ? raw.profileId : "alumno";
  const createdAt = typeof raw.createdAt === "string" && raw.createdAt.trim() ? raw.createdAt : nowIso();
  const phrase = typeof raw.phrase === "string" ? raw.phrase.trim() : "";
  const userAnswer = typeof raw.userAnswer === "string" ? raw.userAnswer : "";
  const correction = typeof raw.correction === "string" ? raw.correction.trim() : "";

  if (!phrase || !correction) {
    return null;
  }

  return {
    id,
    profileId,
    createdAt,
    difficulty: sanitizeDifficulty(raw.difficulty),
    phrase,
    userAnswer,
    correction,
    mode: raw.mode ?? "normal",
  };
}

function sanitizeStoredDerivativeAttempt(attempt: unknown): DerivativeAttempt | null {
  if (!attempt || typeof attempt !== "object") {
    return null;
  }

  const raw = attempt as Partial<DerivativeAttempt> & Record<string, unknown>;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : createId("derivative_attempt");
  const profileId = typeof raw.profileId === "string" && raw.profileId.trim() ? raw.profileId : "alumno";
  const createdAt = typeof raw.createdAt === "string" && raw.createdAt.trim() ? raw.createdAt : nowIso();
  const functionText = typeof raw.functionText === "string" ? raw.functionText.trim() : derivativeFunctionFromRecord(raw);
  const derivative = typeof raw.derivative === "string" ? raw.derivative.trim() : derivativeAnswerFromRecord(raw);

  if (!functionText || !derivative) {
    return null;
  }

  return {
    id,
    profileId,
    createdAt,
    functionText,
    derivative,
    mode: raw.mode ?? "normal",
  };
}

export function createDefaultStorageState(): StorageState {
  return {
    version: 1,
    geminiApiKey: "",
    seSettings: defaultSeSettings(),
    periphrasisSettings: defaultPeriphrasisSettings(),
    morfoSettings: defaultMorfoSettings(),
    sintaxisSettings: defaultSintaxisSettings(),
    derivativeSettings: defaultDerivativeSettings(),
    seQuestionBank: [],
    periphrasisQuestionBank: [],
    morfoQuestionBank: [],
    sintaxisQuestionBank: [],
    derivativeQuestionBank: [],
    seAttempts: [],
    periphrasisAttempts: [],
    morfoAttempts: [],
    sintaxisAttempts: [],
    derivativeAttempts: [],
  };
}

export function loadStorageState(): StorageState {
  if (typeof window === "undefined") {
    return createDefaultStorageState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultStorageState();
    }

    const parsed = JSON.parse(raw) as Partial<StorageState>;
    const parsedSeSettings = (parsed.seSettings ?? {}) as Partial<SeSettings>;
    const parsedPeriphrasisSettings = (parsed.periphrasisSettings ?? {}) as Partial<PeriphrasisSettings>;
    const parsedMorfoSettings = (parsed.morfoSettings ?? {}) as Partial<MorfoSettings>;
    const parsedSintaxisSettings = (parsed.sintaxisSettings ?? {}) as Partial<SintaxisSettings>;
    const parsedDerivativeSettings = (parsed.derivativeSettings ?? {}) as Partial<DerivativeSettings>;
    return {
      version: 1,
      geminiApiKey: typeof parsed.geminiApiKey === "string" ? parsed.geminiApiKey : "",
      seSettings: {
        ...defaultSeSettings(),
        ...parsedSeSettings,
        itemSource: sanitizeItemSource(parsedSeSettings.itemSource),
        focusValues: Array.isArray(parsedSeSettings.focusValues)
          ? parsedSeSettings.focusValues.filter((entry): entry is string => typeof entry === "string")
          : [],
        customValues: Array.isArray(parsedSeSettings.customValues)
          ? parsedSeSettings.customValues.filter((entry): entry is string => typeof entry === "string")
          : [],
        customPeriphrasisTypes: Array.isArray(parsedSeSettings.customPeriphrasisTypes)
          ? parsedSeSettings.customPeriphrasisTypes.filter((entry): entry is string => typeof entry === "string")
          : [],
        batchSize: coercePracticeBatchSize(parsedSeSettings.batchSize),
      },
      periphrasisSettings: {
        ...defaultPeriphrasisSettings(),
        ...parsedPeriphrasisSettings,
        itemSource: sanitizeItemSource(parsedPeriphrasisSettings.itemSource),
        focusStructures: Array.isArray(parsedPeriphrasisSettings.focusStructures)
          ? parsedPeriphrasisSettings.focusStructures.filter((entry): entry is string => typeof entry === "string")
          : [],
        customPeriphrasisTypes: Array.isArray(parsedPeriphrasisSettings.customPeriphrasisTypes)
          ? parsedPeriphrasisSettings.customPeriphrasisTypes.filter((entry): entry is string => typeof entry === "string")
          : [],
        batchSize: coercePracticeBatchSize(parsedPeriphrasisSettings.batchSize),
      },
      morfoSettings: {
        ...defaultMorfoSettings(),
        ...parsedMorfoSettings,
        itemSource: sanitizeItemSource(parsedMorfoSettings.itemSource),
        focusWordTypes: Array.isArray(parsedMorfoSettings.focusWordTypes)
          ? parsedMorfoSettings.focusWordTypes.filter((entry): entry is string => typeof entry === "string")
          : [],
        batchSize: coercePracticeBatchSize(parsedMorfoSettings.batchSize),
      },
      sintaxisSettings: {
        ...defaultSintaxisSettings(),
        ...parsedSintaxisSettings,
        itemSource: "manual",
        batchSize: coercePracticeBatchSize(parsedSintaxisSettings.batchSize),
        difficulty: sanitizeDifficulty(parsedSintaxisSettings.difficulty),
        randomizeOrder: typeof parsedSintaxisSettings.randomizeOrder === "boolean"
          ? parsedSintaxisSettings.randomizeOrder
          : true,
      },
      derivativeSettings: {
        ...defaultDerivativeSettings(),
        ...parsedDerivativeSettings,
        itemSource: "manual",
        batchSize: coercePracticeBatchSize(parsedDerivativeSettings.batchSize),
        randomizeOrder: typeof parsedDerivativeSettings.randomizeOrder === "boolean"
          ? parsedDerivativeSettings.randomizeOrder
          : true,
      },
      seQuestionBank: Array.isArray(parsed.seQuestionBank)
        ? parsed.seQuestionBank
            .map((item) => sanitizeStoredSeItem(item))
            .filter((item): item is StoredSeItem => item !== null)
        : [],
      periphrasisQuestionBank: Array.isArray(parsed.periphrasisQuestionBank)
        ? parsed.periphrasisQuestionBank
            .map((item) => sanitizeStoredPeriphrasisItem(item))
            .filter((item): item is StoredPeriphrasisItem => item !== null)
        : [],
      morfoQuestionBank: Array.isArray(parsed.morfoQuestionBank)
        ? parsed.morfoQuestionBank
            .map((item) => sanitizeStoredMorfoItem(item))
            .filter((item): item is StoredMorfoItem => item !== null)
        : [],
      sintaxisQuestionBank: Array.isArray(parsed.sintaxisQuestionBank)
        ? parsed.sintaxisQuestionBank
            .map((item) => sanitizeStoredSintaxisItem(item))
            .filter((item): item is StoredSintaxisItem => item !== null)
        : [],
      derivativeQuestionBank: Array.isArray(parsed.derivativeQuestionBank)
        ? parsed.derivativeQuestionBank
            .map((item) => sanitizeStoredDerivativeItem(item))
            .filter((item): item is StoredDerivativeItem => item !== null)
        : [],
      seAttempts: Array.isArray(parsed.seAttempts)
        ? parsed.seAttempts.map((attempt) => sanitizeStoredSeAttempt(attempt)).filter((attempt): attempt is SeAttempt => attempt !== null)
        : [],
      periphrasisAttempts: Array.isArray(parsed.periphrasisAttempts)
        ? parsed.periphrasisAttempts
            .map((attempt) => sanitizeStoredPeriphrasisAttempt(attempt))
            .filter((attempt): attempt is PeriphrasisAttempt => attempt !== null)
        : [],
      morfoAttempts: Array.isArray(parsed.morfoAttempts) ? parsed.morfoAttempts : [],
      sintaxisAttempts: Array.isArray(parsed.sintaxisAttempts)
        ? parsed.sintaxisAttempts
            .map((attempt) => sanitizeStoredSintaxisAttempt(attempt))
            .filter((attempt): attempt is SintaxisAttempt => attempt !== null)
        : [],
      derivativeAttempts: Array.isArray(parsed.derivativeAttempts)
        ? parsed.derivativeAttempts
            .map((attempt) => sanitizeStoredDerivativeAttempt(attempt))
            .filter((attempt): attempt is DerivativeAttempt => attempt !== null)
        : [],
    };
  } catch {
    return createDefaultStorageState();
  }
}

export function saveStorageState(state: StorageState): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uniqueLabels(items: string[]): string[] {
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

function normalizeLabelAgainstOptions(value: string, options: readonly string[]): string {
  const cleaned = value.trim();
  const key = normalizeTextToken(cleaned);
  const match = options.find((option) => normalizeTextToken(option) === key);
  return match ?? cleaned;
}

function emptyAxis(labels: readonly string[]): Record<string, { ok: number; fail: number }> {
  return Object.fromEntries(labels.map((label) => [label, { ok: 0, fail: 0 }]));
}

function axisSummary(
  axis: Record<string, { ok: number; fail: number }>,
  topN = 3,
  minAttempts = 2,
): [SummaryRow[], SummaryRow[]] {
  const rows: SummaryRow[] = Object.entries(axis)
    .map(([label, stats]) => {
      const ok = Number(stats.ok ?? 0);
      const fail = Number(stats.fail ?? 0);
      const attempts = ok + fail;
      if (attempts === 0) {
        return null;
      }
      return {
        label,
        ok,
        fail,
        attempts,
        failRate: fail / attempts,
      };
    })
    .filter((row): row is SummaryRow => row !== null);

  const weak = rows
    .filter((row) => row.attempts >= minAttempts)
    .sort((left, right) => {
      if (right.failRate !== left.failRate) {
        return right.failRate - left.failRate;
      }
      return right.fail - left.fail;
    })
    .slice(0, topN);

  const strong = rows
    .filter((row) => row.attempts >= Math.max(3, minAttempts))
    .sort((left, right) => {
      if (left.failRate !== right.failRate) {
        return left.failRate - right.failRate;
      }
      return right.attempts - left.attempts;
    })
    .slice(0, topN);

  return [weak, strong];
}

function axisOverview(axis: Record<string, { ok: number; fail: number }>): SummaryRow[] {
  return Object.entries(axis)
    .map(([label, stats]) => {
      const ok = Number(stats.ok ?? 0);
      const fail = Number(stats.fail ?? 0);
      const attempts = ok + fail;
      if (attempts === 0) {
        return null;
      }
      return {
        label,
        ok,
        fail,
        attempts,
        failRate: fail / attempts,
      };
    })
    .filter((row): row is SummaryRow => row !== null)
    .sort((left, right) => {
      if (right.failRate !== left.failRate) {
        return right.failRate - left.failRate;
      }
      return right.attempts - left.attempts;
    });
}

function pairSummary(
  pairStats: Record<string, { ok: number; fail: number }>,
  topN = 4,
  minAttempts = 2,
): PairSummaryRow[] {
  return Object.entries(pairStats)
    .map(([pair, stats]) => {
      const ok = Number(stats.ok ?? 0);
      const fail = Number(stats.fail ?? 0);
      const attempts = ok + fail;
      if (attempts < minAttempts) {
        return null;
      }
      return {
        pair,
        ok,
        fail,
        attempts,
        failRate: fail / attempts,
      };
    })
    .filter((row): row is PairSummaryRow => row !== null)
    .sort((left, right) => {
      if (right.failRate !== left.failRate) {
        return right.failRate - left.failRate;
      }
      return right.fail - left.fail;
    })
    .slice(0, topN);
}

export function seLearningProfile(attempts: SeAttempt[], profileId: string): SeProfile {
  const filtered = attempts.filter((attempt) => attempt.profileId === profileId);
  const valueStats = emptyAxis(uniqueLabels([...SE_VALUES, ...filtered.map((attempt) => attempt.expectedValue)]));
  const functionStats = emptyAxis(SE_FUNCTIONS);
  const verbalStructureStats = emptyAxis(
    uniqueLabels([...SE_VERBAL_STRUCTURES, ...filtered.map((attempt) => attempt.expectedVerbalStructure)]),
  );
  const periphrasisTypeStats = emptyAxis(
    uniqueLabels([...SE_PERIPHRASIS_TYPES, ...filtered.map((attempt) => attempt.expectedPeriphrasisType)]),
  );
  const pairStats: Record<string, { ok: number; fail: number }> = {};

  filtered.forEach((attempt) => {
    valueStats[attempt.expectedValue] ??= { ok: 0, fail: 0 };
    functionStats[attempt.expectedFunction] ??= { ok: 0, fail: 0 };
    verbalStructureStats[attempt.expectedVerbalStructure] ??= { ok: 0, fail: 0 };
    periphrasisTypeStats[attempt.expectedPeriphrasisType] ??= { ok: 0, fail: 0 };
    valueStats[attempt.expectedValue][attempt.valueOk ? "ok" : "fail"] += 1;
    functionStats[attempt.expectedFunction][attempt.functionOk ? "ok" : "fail"] += 1;
    verbalStructureStats[attempt.expectedVerbalStructure][attempt.verbalStructureOk ? "ok" : "fail"] += 1;
    periphrasisTypeStats[attempt.expectedPeriphrasisType][attempt.periphrasisTypeOk ? "ok" : "fail"] += 1;
    const pairKey = `${attempt.expectedValue} || ${attempt.expectedFunction}`;
    pairStats[pairKey] ??= { ok: 0, fail: 0 };
    pairStats[pairKey][attempt.overallOk ? "ok" : "fail"] += 1;
  });

  const [weakValues, strongValues] = axisSummary(valueStats);
  const [weakFunctions, strongFunctions] = axisSummary(functionStats);
  const [weakVerbalStructures, strongVerbalStructures] = axisSummary(verbalStructureStats);
  const [weakPeriphrasisTypes, strongPeriphrasisTypes] = axisSummary(periphrasisTypeStats);

  return {
    totalAttempts: filtered.length,
    weakValues,
    strongValues,
    weakFunctions,
    strongFunctions,
    weakVerbalStructures,
    strongVerbalStructures,
    weakPeriphrasisTypes,
    strongPeriphrasisTypes,
    valueOverview: axisOverview(valueStats),
    functionOverview: axisOverview(functionStats),
    verbalStructureOverview: axisOverview(verbalStructureStats),
    periphrasisTypeOverview: axisOverview(periphrasisTypeStats),
    weakPairs: pairSummary(pairStats),
  };
}

export function periphrasisLearningProfile(attempts: PeriphrasisAttempt[], profileId: string): PeriphrasisProfile {
  const filtered = attempts.filter((attempt) => attempt.profileId === profileId);
  const structureStats = emptyAxis(uniqueLabels([...PERIPHRASIS_STRUCTURES, ...filtered.map((attempt) => attempt.expectedStructure)]));
  const periphrasisTypeStats = emptyAxis(
    uniqueLabels([...PERIPHRASIS_TYPES, ...filtered.map((attempt) => attempt.expectedPeriphrasisType)]),
  );
  const pairStats: Record<string, { ok: number; fail: number }> = {};

  filtered.forEach((attempt) => {
    structureStats[attempt.expectedStructure] ??= { ok: 0, fail: 0 };
    periphrasisTypeStats[attempt.expectedPeriphrasisType] ??= { ok: 0, fail: 0 };
    structureStats[attempt.expectedStructure][attempt.structureOk ? "ok" : "fail"] += 1;
    periphrasisTypeStats[attempt.expectedPeriphrasisType][attempt.periphrasisTypeOk ? "ok" : "fail"] += 1;
    const pairKey = `${attempt.expectedStructure} || ${attempt.expectedPeriphrasisType}`;
    pairStats[pairKey] ??= { ok: 0, fail: 0 };
    pairStats[pairKey][attempt.overallOk ? "ok" : "fail"] += 1;
  });

  const [weakStructures, strongStructures] = axisSummary(structureStats);
  const [weakPeriphrasisTypes, strongPeriphrasisTypes] = axisSummary(periphrasisTypeStats);

  return {
    totalAttempts: filtered.length,
    weakStructures,
    strongStructures,
    weakPeriphrasisTypes,
    strongPeriphrasisTypes,
    structureOverview: axisOverview(structureStats),
    periphrasisTypeOverview: axisOverview(periphrasisTypeStats),
    weakPairs: pairSummary(pairStats),
  };
}

export function morfoLearningProfile(attempts: MorfoAttempt[], profileId: string): MorfoProfile {
  const filtered = attempts.filter((attempt) => attempt.profileId === profileId);
  const wordTypeStats = emptyAxis(MORFO_WORD_TYPES);
  const morphemeTypeStats = emptyAxis(MORFO_MORPHEME_TYPES);
  const pairStats: Record<string, { ok: number; fail: number }> = {};

  filtered.forEach((attempt) => {
    wordTypeStats[attempt.expectedWordType] ??= { ok: 0, fail: 0 };
    wordTypeStats[attempt.expectedWordType][attempt.wordTypeOk ? "ok" : "fail"] += 1;
    uniqueItems(attempt.expectedMorphemeTypes.map(normalizeMorphemeTypeLabel)).forEach((morphemeType) => {
      morphemeTypeStats[morphemeType] ??= { ok: 0, fail: 0 };
      morphemeTypeStats[morphemeType][attempt.morphemeTypesOk ? "ok" : "fail"] += 1;
      const pairKey = `${attempt.expectedWordType} || ${morphemeType}`;
      pairStats[pairKey] ??= { ok: 0, fail: 0 };
      pairStats[pairKey][attempt.wordTypeOk && attempt.morphemeTypesOk ? "ok" : "fail"] += 1;
    });
  });

  const [weakWordTypes, strongWordTypes] = axisSummary(wordTypeStats);
  const [weakMorphemeTypes, strongMorphemeTypes] = axisSummary(morphemeTypeStats);

  return {
    totalAttempts: filtered.length,
    weakWordTypes,
    strongWordTypes,
    weakMorphemeTypes,
    strongMorphemeTypes,
    wordTypeOverview: axisOverview(wordTypeStats),
    morphemeTypeOverview: axisOverview(morphemeTypeStats),
    weakPairs: pairSummary(pairStats),
  };
}

export function buildMixBucket(targetWeight: number, normalWeight: number): boolean[] {
  const safeTarget = Math.max(0, targetWeight);
  const safeNormal = Math.max(0, normalWeight);
  const total = safeTarget + safeNormal;
  const normalizedTarget = total === 0 ? 40 : safeTarget;
  const normalizedNormal = total === 0 ? 60 : safeNormal;
  const bucket = [
    ...Array.from({ length: normalizedTarget }, () => true),
    ...Array.from({ length: normalizedNormal }, () => false),
  ];
  for (let index = bucket.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = bucket[index];
    bucket[index] = bucket[swapIndex];
    bucket[swapIndex] = current;
  }
  return bucket;
}

export function popMixTargeted(bucket: boolean[], targetWeight: number, normalWeight: number): [boolean, boolean[]] {
  const nextBucket = bucket.length > 0 ? [...bucket] : buildMixBucket(targetWeight, normalWeight);
  const targeted = nextBucket.pop() ?? false;
  return [targeted, nextBucket];
}

function weightedPick(rows: SummaryRow[]): string {
  const totalWeight = rows.reduce((sum, row) => sum + Math.max(0.05, row.failRate), 0);
  let cursor = Math.random() * totalWeight;
  for (const row of rows) {
    cursor -= Math.max(0.05, row.failRate);
    if (cursor <= 0) {
      return row.label;
    }
  }
  return rows[rows.length - 1]?.label ?? "";
}

function weightedPairPick(rows: PairSummaryRow[]): string {
  const totalWeight = rows.reduce((sum, row) => sum + Math.max(0.05, row.failRate), 0);
  let cursor = Math.random() * totalWeight;
  for (const row of rows) {
    cursor -= Math.max(0.05, row.failRate);
    if (cursor <= 0) {
      return row.pair;
    }
  }
  return rows[rows.length - 1]?.pair ?? "";
}

export function chooseSeTarget(
  profile: SeProfile,
  focusValues: string[],
  personalized: boolean,
  forceTargeted?: boolean,
  mixLabel = "40% debilidades / 60% normal",
): SeStrategy {
  if (focusValues.length > 0) {
    return {
      mode: "foco_usuario",
      targeted: true,
      focusValues,
      requiredValue: "",
      targetValue: focusValues[Math.floor(Math.random() * focusValues.length)] ?? "",
      targetFunction: "",
      ratioHint: "100% foco",
    };
  }

  if (!personalized) {
    return {
      mode: "normal",
      targeted: false,
      focusValues: [],
      requiredValue: "",
      targetValue: "",
      targetFunction: "",
      ratioHint: "0% personalizado",
    };
  }

  const hasWeakness = profile.weakValues.length > 0 || profile.weakFunctions.length > 0;
  const targeted = hasWeakness && (forceTargeted ?? Math.random() < 0.4);
  if (!targeted) {
    return {
      mode: "personalizado_mixto",
      targeted: false,
      focusValues: [],
      requiredValue: "",
      targetValue: "",
      targetFunction: "",
      ratioHint: mixLabel,
    };
  }

  let targetValue = "";
  let targetFunction = "";

  if (profile.weakPairs.length > 0 && Math.random() < 0.65) {
    const picked = weightedPairPick(profile.weakPairs);
    const [value, fn = ""] = picked.split(" || ", 2);
    targetValue = value?.trim() ?? "";
    targetFunction = fn.trim();
  } else {
    if (profile.weakValues.length > 0) {
      targetValue = weightedPick(profile.weakValues);
    }
    if (profile.weakFunctions.length > 0) {
      targetFunction = weightedPick(profile.weakFunctions);
    }
  }

  return {
    mode: "personalizado_objetivo",
    targeted: true,
    focusValues: targetValue ? [targetValue] : [],
    requiredValue: "",
    targetValue,
    targetFunction,
    ratioHint: mixLabel,
  };
}

export function choosePeriphrasisTarget(
  profile: PeriphrasisProfile,
  focusStructures: string[],
  personalized: boolean,
  forceTargeted?: boolean,
  mixLabel = "40% debilidades / 60% normal",
): PeriphrasisStrategy {
  if (focusStructures.length > 0) {
    return {
      mode: "foco_usuario",
      targeted: true,
      focusStructures,
      targetStructure: focusStructures[Math.floor(Math.random() * focusStructures.length)] ?? "",
      targetPeriphrasisType: "",
      ratioHint: "100% foco",
    };
  }

  if (!personalized) {
    return {
      mode: "normal",
      targeted: false,
      focusStructures: [],
      targetStructure: "",
      targetPeriphrasisType: "",
      ratioHint: "0% personalizado",
    };
  }

  const hasWeakness = profile.weakStructures.length > 0 || profile.weakPeriphrasisTypes.length > 0;
  const targeted = hasWeakness && (forceTargeted ?? Math.random() < 0.4);
  if (!targeted) {
    return {
      mode: "personalizado_mixto",
      targeted: false,
      focusStructures: [],
      targetStructure: "",
      targetPeriphrasisType: "",
      ratioHint: mixLabel,
    };
  }

  let targetStructure = "";
  let targetPeriphrasisType = "";

  if (profile.weakPairs.length > 0 && Math.random() < 0.65) {
    const picked = weightedPairPick(profile.weakPairs);
    const [structure, periphrasisType = ""] = picked.split(" || ", 2);
    targetStructure = structure?.trim() ?? "";
    targetPeriphrasisType = periphrasisType.trim();
  } else {
    if (profile.weakStructures.length > 0) {
      targetStructure = weightedPick(profile.weakStructures);
    }
    if (profile.weakPeriphrasisTypes.length > 0) {
      targetPeriphrasisType = weightedPick(profile.weakPeriphrasisTypes);
    }
  }

  return {
    mode: "personalizado_objetivo",
    targeted: true,
    focusStructures: targetStructure ? [targetStructure] : [],
    targetStructure,
    targetPeriphrasisType,
    ratioHint: mixLabel,
  };
}

export function chooseMorfoTarget(
  profile: MorfoProfile,
  focusWordTypes: string[],
  personalized: boolean,
  forceTargeted?: boolean,
  mixLabel = "40% debilidades / 60% normal",
): MorfoStrategy {
  if (focusWordTypes.length > 0) {
    return {
      mode: "foco_usuario",
      targeted: true,
      focusWordTypes,
      targetWordType: focusWordTypes[Math.floor(Math.random() * focusWordTypes.length)] ?? "",
      targetMorphemeType: "",
      ratioHint: "100% foco",
    };
  }

  if (!personalized) {
    return {
      mode: "normal",
      targeted: false,
      focusWordTypes: [],
      targetWordType: "",
      targetMorphemeType: "",
      ratioHint: "0% personalizado",
    };
  }

  const hasWeakness = profile.weakWordTypes.length > 0 || profile.weakMorphemeTypes.length > 0;
  const targeted = hasWeakness && (forceTargeted ?? Math.random() < 0.4);
  if (!targeted) {
    return {
      mode: "personalizado_mixto",
      targeted: false,
      focusWordTypes: [],
      targetWordType: "",
      targetMorphemeType: "",
      ratioHint: mixLabel,
    };
  }

  let targetWordType = "";
  let targetMorphemeType = "";

  if (profile.weakPairs.length > 0 && Math.random() < 0.65) {
    const picked = weightedPairPick(profile.weakPairs);
    const [wordType, morphemeType = ""] = picked.split(" || ", 2);
    targetWordType = wordType?.trim() ?? "";
    targetMorphemeType = morphemeType.trim();
  } else {
    if (profile.weakWordTypes.length > 0) {
      targetWordType = weightedPick(profile.weakWordTypes);
    }
    if (profile.weakMorphemeTypes.length > 0) {
      targetMorphemeType = weightedPick(profile.weakMorphemeTypes);
    }
  }

  return {
    mode: "personalizado_objetivo",
    targeted: true,
    focusWordTypes: targetWordType ? [targetWordType] : [],
    targetWordType,
    targetMorphemeType,
    ratioHint: mixLabel,
  };
}

function normalizedTokens(sentence: string): string[] {
  return (sentence.toLowerCase().match(/\w+/g) ?? []).filter(Boolean);
}

function sentenceSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalizedTokens(left));
  const rightTokens = new Set(normalizedTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / new Set([...leftTokens, ...rightTokens]).size;
}

export function isNovelSentence(sentence: string, recentSentences: string[], threshold = 0.72): boolean {
  const normalized = sentence.trim().toLowerCase();
  return recentSentences.every((previous) => {
    const oldNormalized = previous.trim().toLowerCase();
    return normalized !== oldNormalized && sentenceSimilarity(sentence, previous) < threshold;
  });
}

export function isNovelWord(word: string, recentWords: string[]): boolean {
  const normalized = word.trim().toLowerCase();
  return recentWords.every((previous) => previous.trim().toLowerCase() !== normalized);
}

export function fetchRecentSeSentences(attempts: SeAttempt[], profileId: string, limit = 12): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  attempts
    .filter((attempt) => attempt.profileId === profileId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .forEach((attempt) => {
      const key = attempt.sentence.trim().toLowerCase();
      if (!key || seen.has(key) || results.length >= limit) {
        return;
      }
      seen.add(key);
      results.push(attempt.sentence);
    });
  return results;
}

export function fetchRecentSeLabels(
  attempts: SeAttempt[],
  profileId: string,
  limit = 10,
): Array<{ value: string; function: string; verbalStructure: string; periphrasisType: string }> {
  return attempts
    .filter((attempt) => attempt.profileId === profileId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
    .map((attempt) => ({
      value: attempt.expectedValue,
      function: attempt.expectedFunction,
      verbalStructure: attempt.expectedVerbalStructure,
      periphrasisType: attempt.expectedPeriphrasisType,
    }));
}

export function fetchRecentPeriphrasisSentences(
  attempts: PeriphrasisAttempt[],
  profileId: string,
  limit = 12,
): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  attempts
    .filter((attempt) => attempt.profileId === profileId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .forEach((attempt) => {
      const key = attempt.sentence.trim().toLowerCase();
      if (!key || seen.has(key) || results.length >= limit) {
        return;
      }
      seen.add(key);
      results.push(attempt.sentence);
    });
  return results;
}

export function fetchRecentPeriphrasisLabels(
  attempts: PeriphrasisAttempt[],
  profileId: string,
  limit = 10,
): Array<{ structure: string; periphrasisType: string }> {
  return attempts
    .filter((attempt) => attempt.profileId === profileId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
    .map((attempt) => ({
      structure: attempt.expectedStructure,
      periphrasisType: attempt.expectedPeriphrasisType,
    }));
}

export function fetchRecentMorfoWords(attempts: MorfoAttempt[], profileId: string, limit = 12): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  attempts
    .filter((attempt) => attempt.profileId === profileId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .forEach((attempt) => {
      const key = attempt.word.trim().toLowerCase();
      if (!key || seen.has(key) || results.length >= limit) {
        return;
      }
      seen.add(key);
      results.push(attempt.word);
    });
  return results;
}

export function fetchRecentMorfoLabels(
  attempts: MorfoAttempt[],
  profileId: string,
  limit = 10,
): Array<{ wordType: string; morphemeType: string }> {
  return attempts
    .filter((attempt) => attempt.profileId === profileId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
    .map((attempt) => ({
      wordType: attempt.expectedWordType,
      morphemeType: attempt.expectedPrimaryMorphemeType,
    }));
}

export function fetchRecentSintaxisPhrases(attempts: SintaxisAttempt[], profileId: string, limit = 12): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  attempts
    .filter((attempt) => attempt.profileId === profileId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .forEach((attempt) => {
      const key = attempt.phrase.trim().toLowerCase();
      if (!key || seen.has(key) || results.length >= limit) {
        return;
      }
      seen.add(key);
      results.push(attempt.phrase);
    });
  return results;
}

export function fetchRecentDerivativeFunctions(attempts: DerivativeAttempt[], profileId: string, limit = 12): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  attempts
    .filter((attempt) => attempt.profileId === profileId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .forEach((attempt) => {
      const key = normalizeTextToken(attempt.functionText);
      if (!key || seen.has(key) || results.length >= limit) {
        return;
      }
      seen.add(key);
      results.push(attempt.functionText);
    });
  return results;
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function fallbackSeBatch(
  difficulty: Difficulty,
  strategies: SeStrategy[],
  recentSentences: string[],
): Array<SeItem | null> {
  const memory = [...recentSentences];
  return strategies.map((strategy) => {
    let pool = [...SE_SAMPLE_BANK[difficulty]];
    const targetValues = strategy.requiredValue
      ? [strategy.requiredValue]
      : strategy.focusValues.length > 0
        ? strategy.focusValues
        : strategy.targetValue
          ? [strategy.targetValue]
          : [];
    if (targetValues.length > 0) {
      const filtered = pool.filter((item) => targetValues.includes(item.seValue));
      if (filtered.length > 0) {
        pool = filtered;
      } else {
        return null;
      }
    }
    const novel = pool.filter((item) => isNovelSentence(item.sentence, memory, 0.75));
    if (novel.length > 0) {
      pool = novel;
    }
    const chosen = randomItem(pool);
    memory.push(chosen.sentence);
    return {
      ...chosen,
      id: createId("se"),
      mode: strategy.mode,
    };
  });
}

export function fallbackPeriphrasisBatch(
  difficulty: Difficulty,
  strategies: PeriphrasisStrategy[],
  recentSentences: string[],
): PeriphrasisItem[] {
  const recentMemory = [...recentSentences];
  const batchMemory: string[] = [];
  return strategies.map((strategy) => {
    let pool = [...PERIPHRASIS_SAMPLE_BANK[difficulty]];
    const targetStructures =
      strategy.focusStructures.length > 0 ? strategy.focusStructures : strategy.targetStructure ? [strategy.targetStructure] : [];
    if (targetStructures.length > 0) {
      const filtered = pool.filter((item) => targetStructures.includes(item.verbalStructure));
      if (filtered.length > 0) {
        pool = filtered;
      }
    }
    if (strategy.targetPeriphrasisType) {
      const filtered = pool.filter((item) => item.periphrasisType === strategy.targetPeriphrasisType);
      if (filtered.length > 0) {
        pool = filtered;
      }
    }
    const unusedInBatch = pool.filter((item) => isNovelSentence(item.sentence, batchMemory, 0.75));
    const novel = unusedInBatch.filter((item) => isNovelSentence(item.sentence, recentMemory, 0.75));
    if (novel.length > 0) {
      pool = novel;
    } else if (unusedInBatch.length > 0) {
      pool = unusedInBatch;
    }
    const chosen = randomItem(pool);
    recentMemory.push(chosen.sentence);
    batchMemory.push(chosen.sentence);
    return {
      ...chosen,
      id: createId("perifrasis"),
      mode: strategy.mode,
    };
  });
}

export function fallbackMorfoBatch(
  difficulty: Difficulty,
  strategies: MorfoStrategy[],
  recentWords: string[],
): MorfoItem[] {
  const memory = [...recentWords];
  return strategies.map((strategy) => {
    let pool = [...MORFO_SAMPLE_BANK[difficulty]];
    const targetWordTypes =
      strategy.focusWordTypes.length > 0 ? strategy.focusWordTypes : strategy.targetWordType ? [strategy.targetWordType] : [];
    if (targetWordTypes.length > 0) {
      const filtered = pool.filter((item) => targetWordTypes.includes(item.wordType));
      if (filtered.length > 0) {
        pool = filtered;
      }
    }
    if (strategy.targetMorphemeType) {
      const filtered = pool.filter((item) => item.morphemeTypes.includes(strategy.targetMorphemeType));
      if (filtered.length > 0) {
        pool = filtered;
      }
    }
    const novel = pool.filter((item) => isNovelWord(item.word, memory));
    if (novel.length > 0) {
      pool = novel;
    }
    const chosen = randomItem(pool);
    memory.push(chosen.word);
    return {
      ...chosen,
      id: createId("morfo"),
      mode: strategy.mode,
    };
  });
}

function chooseManualSentenceItem<T extends { sentence: string }>(
  pool: T[],
  recentMemory: string[],
  batchMemory: string[],
): T | null {
  if (pool.length === 0) {
    return null;
  }

  const unusedInBatch = pool.filter((item) => isNovelSentence(item.sentence, batchMemory, 0.75));
  const novel = unusedInBatch.filter((item) => isNovelSentence(item.sentence, recentMemory, 0.75));
  const candidates = novel.length > 0 ? novel : unusedInBatch.length > 0 ? unusedInBatch : pool;
  return randomItem(candidates);
}

function chooseManualPhraseItem<T extends { phrase: string }>(
  pool: T[],
  recentMemory: string[],
  batchMemory: string[],
): T | null {
  if (pool.length === 0) {
    return null;
  }

  const unusedInBatch = pool.filter((item) => isNovelSentence(item.phrase, batchMemory, 0.75));
  const novel = unusedInBatch.filter((item) => isNovelSentence(item.phrase, recentMemory, 0.75));
  const candidates = novel.length > 0 ? novel : unusedInBatch.length > 0 ? unusedInBatch : pool;
  return randomItem(candidates);
}

function chooseManualDerivativeItem<T extends { functionText: string }>(
  pool: T[],
  recentMemory: string[],
  batchMemory: string[],
): T | null {
  if (pool.length === 0) {
    return null;
  }

  const unusedInBatch = pool.filter((item) => isNovelWord(item.functionText, batchMemory));
  const novel = unusedInBatch.filter((item) => isNovelWord(item.functionText, recentMemory));
  const candidates = novel.length > 0 ? novel : unusedInBatch.length > 0 ? unusedInBatch : pool;
  return randomItem(candidates);
}

function chooseManualWordItem<T extends { word: string }>(pool: T[], recentMemory: string[], batchMemory: string[]): T | null {
  if (pool.length === 0) {
    return null;
  }

  const unusedInBatch = pool.filter((item) => isNovelWord(item.word, batchMemory));
  const novel = unusedInBatch.filter((item) => isNovelWord(item.word, recentMemory));
  const candidates = novel.length > 0 ? novel : unusedInBatch.length > 0 ? unusedInBatch : pool;
  return randomItem(candidates);
}

export function manualSeBatch(
  strategies: SeStrategy[],
  recentSentences: string[],
  questionBank: StoredSeItem[],
): Array<SeItem | null> {
  const recentMemory = [...recentSentences];
  const batchMemory: string[] = [];
  const basePool = questionBank;

  return strategies.map((strategy) => {
    let pool = [...basePool];
    const targetValues = strategy.requiredValue
      ? [strategy.requiredValue]
      : strategy.focusValues.length > 0
        ? strategy.focusValues
        : strategy.targetValue
          ? [strategy.targetValue]
          : [];
    if (targetValues.length > 0) {
      const filtered = pool.filter((item) =>
        targetValues.some((value) => normalizeTextToken(value) === normalizeTextToken(item.seValue)),
      );
      if (filtered.length > 0) {
        pool = filtered;
      }
    }

    const chosen = chooseManualSentenceItem(pool, recentMemory, batchMemory);
    if (!chosen) {
      return null;
    }

    recentMemory.push(chosen.sentence);
    batchMemory.push(chosen.sentence);
    return {
      ...chosen,
      id: createId("se_manual"),
      mode: strategy.mode,
    };
  });
}

export function manualPeriphrasisBatch(
  strategies: PeriphrasisStrategy[],
  recentSentences: string[],
  questionBank: StoredPeriphrasisItem[],
): Array<PeriphrasisItem | null> {
  const recentMemory = [...recentSentences];
  const batchMemory: string[] = [];
  const basePool = questionBank;

  return strategies.map((strategy) => {
    let pool = [...basePool];
    const targetStructures =
      strategy.focusStructures.length > 0 ? strategy.focusStructures : strategy.targetStructure ? [strategy.targetStructure] : [];
    if (targetStructures.length > 0) {
      const filtered = pool.filter((item) =>
        targetStructures.some((structure) => normalizeTextToken(structure) === normalizeTextToken(item.verbalStructure)),
      );
      if (filtered.length > 0) {
        pool = filtered;
      }
    }
    if (strategy.targetPeriphrasisType) {
      const filtered = pool.filter(
        (item) => normalizeTextToken(item.periphrasisType) === normalizeTextToken(strategy.targetPeriphrasisType),
      );
      if (filtered.length > 0) {
        pool = filtered;
      }
    }

    const chosen = chooseManualSentenceItem(pool, recentMemory, batchMemory);
    if (!chosen) {
      return null;
    }

    recentMemory.push(chosen.sentence);
    batchMemory.push(chosen.sentence);
    return {
      ...chosen,
      id: createId("perifrasis_manual"),
      mode: strategy.mode,
    };
  });
}

export function manualMorfoBatch(
  strategies: MorfoStrategy[],
  recentWords: string[],
  questionBank: StoredMorfoItem[],
): Array<MorfoItem | null> {
  const recentMemory = [...recentWords];
  const batchMemory: string[] = [];
  const basePool = questionBank;

  return strategies.map((strategy) => {
    let pool = [...basePool];
    const targetWordTypes =
      strategy.focusWordTypes.length > 0 ? strategy.focusWordTypes : strategy.targetWordType ? [strategy.targetWordType] : [];
    if (targetWordTypes.length > 0) {
      const filtered = pool.filter((item) =>
        targetWordTypes.some((wordType) => normalizeTextToken(wordType) === normalizeTextToken(item.wordType)),
      );
      if (filtered.length > 0) {
        pool = filtered;
      }
    }
    if (strategy.targetMorphemeType) {
      const filtered = pool.filter((item) =>
        item.morphemeTypes.some(
          (morphemeType) => normalizeTextToken(morphemeType) === normalizeTextToken(strategy.targetMorphemeType),
        ),
      );
      if (filtered.length > 0) {
        pool = filtered;
      }
    }

    const chosen = chooseManualWordItem(pool, recentMemory, batchMemory);
    if (!chosen) {
      return null;
    }

    recentMemory.push(chosen.word);
    batchMemory.push(chosen.word);
    return {
      ...chosen,
      id: createId("morfo_manual"),
      mode: strategy.mode,
    };
  });
}

export function manualSintaxisBatch(
  batchSize: number,
  recentPhrases: string[],
  questionBank: StoredSintaxisItem[],
  randomizeOrder: boolean,
): Array<SintaxisItem | null> {
  const recentMemory = [...recentPhrases];
  const batchMemory: string[] = [];
  const basePool = questionBank;

  return Array.from({ length: coercePracticeBatchSize(batchSize) }, () => {
    const chosen = randomizeOrder
      ? chooseManualPhraseItem(basePool, recentMemory, batchMemory)
      : basePool.find((item) => isNovelSentence(item.phrase, batchMemory, 0.75) && isNovelSentence(item.phrase, recentMemory, 0.75)) ??
        basePool.find((item) => isNovelSentence(item.phrase, batchMemory, 0.75)) ??
        null;
    if (!chosen) {
      return null;
    }

    recentMemory.push(chosen.phrase);
    batchMemory.push(chosen.phrase);
    return {
      ...chosen,
      id: createId("sintaxis_manual"),
      mode: "normal",
    };
  });
}

export function manualDerivativeBatch(
  batchSize: number,
  recentFunctions: string[],
  questionBank: StoredDerivativeItem[],
  randomizeOrder: boolean,
): Array<DerivativeItem | null> {
  const recentMemory = [...recentFunctions];
  const batchMemory: string[] = [];
  const basePool = questionBank;

  return Array.from({ length: coercePracticeBatchSize(batchSize) }, () => {
    const chosen = randomizeOrder
      ? chooseManualDerivativeItem(basePool, recentMemory, batchMemory)
      : basePool.find((item) => isNovelWord(item.functionText, batchMemory) && isNovelWord(item.functionText, recentMemory)) ??
        basePool.find((item) => isNovelWord(item.functionText, batchMemory)) ??
        null;
    if (!chosen) {
      return null;
    }

    recentMemory.push(chosen.functionText);
    batchMemory.push(chosen.functionText);
    return {
      ...chosen,
      id: createId("derivative_manual"),
      mode: "normal",
    };
  });
}

export function normalizeFunctionLabel(value: string): string {
  const key = value.trim().toLowerCase();
  const mapping: Record<string, string> = {
    cd: "CD",
    ci: "CI",
    "sin funcion": "Sin funcion sintactica propia",
    "sin funcion sintactica propia": "Sin funcion sintactica propia",
    "morfema verbal": "Morfema verbal",
    "marca de pasiva": "Marca de pasiva",
    "marca de impersonal": "Marca de impersonal",
  };
  return mapping[key] ?? value.trim();
}

export function normalizeSeValueLabel(value: string, options: readonly string[] = SE_VALUES): string {
  return normalizeLabelAgainstOptions(value, options);
}

export function normalizeTextToken(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizePieceToken(value: string): string {
  return normalizeTextToken(value).replace(/\s+/g, "").replace(/[-\u2010\u2011\u2012\u2013\u2014]/g, "");
}

export function normalizeVerbalStructureLabel(value: string, options: readonly string[] = SE_VERBAL_STRUCTURES): string {
  return normalizeLabelAgainstOptions(value, options);
}

export function normalizePeriphrasisStructureLabel(
  value: string,
  options: readonly string[] = PERIPHRASIS_STRUCTURES,
): string {
  return normalizeLabelAgainstOptions(value, options);
}

export function normalizePeriphrasisTypeLabel(
  value: string,
  options: readonly string[] = SE_PERIPHRASIS_TYPES,
): string {
  return normalizeLabelAgainstOptions(value, options);
}

export function normalizeMorphemeTypeLabel(value: string): string {
  const key = normalizeTextToken(value);
  const aliases: Record<string, string> = {
    prefijo: "Prefijo derivativo",
    sufijo: "Sufijo derivativo",
    genero: "Morfema flexivo nominal (genero)",
    "morfema de genero": "Morfema flexivo nominal (genero)",
    numero: "Morfema flexivo nominal (numero)",
    "morfema de numero": "Morfema flexivo nominal (numero)",
    "vocal tematica": "Vocal tematica",
    vt: "Vocal tematica",
    "morfema verbal tma": "Morfema flexivo verbal (tiempo/modo/aspecto)",
    "tiempo/modo/aspecto": "Morfema flexivo verbal (tiempo/modo/aspecto)",
    "persona y numero": "Morfema flexivo verbal (persona/numero)",
    "persona/numero": "Morfema flexivo verbal (persona/numero)",
    "morfema flexivo verbal (persona y numero)": "Morfema flexivo verbal (persona/numero)",
  };
  if (aliases[key]) {
    return aliases[key];
  }
  const mapping = new Map<string, string>(
    MORFO_MORPHEME_TYPES.map((label) => [normalizeTextToken(label), label]),
  );
  return mapping.get(key) ?? value.trim();
}

export function uniqueItems<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function uniqueNormalizedItems(items: string[], normalize = normalizeTextToken): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  items.forEach((item) => {
    const trimmed = item.trim();
    const key = normalize(trimmed);
    if (!trimmed || !key || seen.has(key)) {
      return;
    }
    seen.add(key);
    values.push(trimmed);
  });
  return values;
}

export function acceptedLexemesForItem(item: Pick<MorfoItem, "lexeme" | "acceptedLexemes">): string[] {
  return uniqueNormalizedItems([item.lexeme, ...item.acceptedLexemes], normalizeTextToken);
}

export function parseGuessList(rawText: string): string[] {
  return rawText
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizedMultisetEquals(left: string[], right: string[], normalize: (value: string) => string): boolean {
  const leftCounts = new Map<string, number>();
  const rightCounts = new Map<string, number>();

  left.map(normalize).filter(Boolean).forEach((value) => {
    leftCounts.set(value, (leftCounts.get(value) ?? 0) + 1);
  });
  right.map(normalize).filter(Boolean).forEach((value) => {
    rightCounts.set(value, (rightCounts.get(value) ?? 0) + 1);
  });

  return (
    leftCounts.size > 0 &&
    leftCounts.size === rightCounts.size &&
    [...leftCounts].every(([value, count]) => rightCounts.get(value) === count)
  );
}

export function evaluateSeGuess(
  item: SeItem,
  guessValue: string,
  guessFunction: string,
  guessVerbalStructure = item.verbalStructure,
  guessPeriphrasisType = item.periphrasisType,
): SeEvaluation {
  const valueOk = normalizeTextToken(guessValue) === normalizeTextToken(item.seValue);
  const functionOk = item.acceptedFunctions.map(normalizeFunctionLabel).includes(normalizeFunctionLabel(guessFunction));
  const verbalStructureOk =
    normalizeTextToken(guessVerbalStructure) === normalizeTextToken(item.verbalStructure);
  const periphrasisTypeOk =
    normalizeTextToken(guessPeriphrasisType) === normalizeTextToken(item.periphrasisType);
  return {
    guessValue,
    guessFunction,
    guessVerbalStructure,
    guessPeriphrasisType,
    valueOk,
    functionOk,
    verbalStructureOk,
    periphrasisTypeOk,
    overallOk: valueOk && functionOk && verbalStructureOk && periphrasisTypeOk,
  };
}

export function evaluatePeriphrasisGuess(
  item: PeriphrasisItem,
  guessStructure: string,
  guessPeriphrasisType: string,
): PeriphrasisEvaluation {
  const structureOk = normalizeTextToken(guessStructure) === normalizeTextToken(item.verbalStructure);
  const periphrasisTypeOk = normalizeTextToken(guessPeriphrasisType) === normalizeTextToken(item.periphrasisType);
  return {
    guessStructure,
    guessPeriphrasisType,
    structureOk,
    periphrasisTypeOk,
    overallOk: structureOk && periphrasisTypeOk,
  };
}

export function evaluateMorfoGuess(
  item: MorfoItem,
  guessWordType: string,
  guessLexeme: string,
  guessMorphemesText: string,
  guessMorphemeTypes: string[],
): MorfoEvaluation {
  const expectedLexemes = acceptedLexemesForItem(item).map(normalizeTextToken).filter(Boolean);
  const lexemeOk = expectedLexemes.includes(normalizeTextToken(guessLexeme));
  const guessedMorphemes = parseGuessList(guessMorphemesText);
  const morphemesOk = normalizedMultisetEquals(item.morphemes, guessedMorphemes, normalizePieceToken);

  const expectedTypes = uniqueItems(item.morphemeTypes.map(normalizeMorphemeTypeLabel)).filter((value) =>
    MORFO_MORPHEME_TYPES.includes(value as (typeof MORFO_MORPHEME_TYPES)[number]),
  );
  const guessedTypes = uniqueItems(guessMorphemeTypes.map(normalizeMorphemeTypeLabel)).filter((value) =>
    MORFO_MORPHEME_TYPES.includes(value as (typeof MORFO_MORPHEME_TYPES)[number]),
  );
  const expectedTypeSet = new Set(expectedTypes);
  const guessedTypeSet = new Set(guessedTypes);
  const morphemeTypesOk =
    expectedTypeSet.size > 0 &&
    expectedTypeSet.size === guessedTypeSet.size &&
    [...expectedTypeSet].every((value) => guessedTypeSet.has(value));

  const wordTypeOk = guessWordType === item.wordType;

  return {
    guessWordType,
    guessLexeme,
    guessMorphemes: guessedMorphemes,
    guessMorphemeTypes: guessedTypes,
    wordTypeOk,
    lexemeOk,
    morphemesOk,
    morphemeTypesOk,
    overallOk: wordTypeOk && lexemeOk && morphemesOk && morphemeTypesOk,
  };
}

export function makeSeAttempt(item: SeItem, settings: SeSettings, evaluation: SeEvaluation): SeAttempt {
  return {
    id: item.id,
    profileId: settings.profileId.trim() || "alumno",
    createdAt: nowIso(),
    difficulty: item.difficulty,
    sentence: item.sentence,
    expectedValue: item.seValue,
    expectedFunction: item.seFunction,
    expectedVerbalStructure: item.verbalStructure,
    expectedPeriphrasisType: item.periphrasisType,
    guessValue: evaluation.guessValue,
    guessFunction: evaluation.guessFunction,
    guessVerbalStructure: evaluation.guessVerbalStructure,
    guessPeriphrasisType: evaluation.guessPeriphrasisType,
    valueOk: evaluation.valueOk,
    functionOk: evaluation.functionOk,
    verbalStructureOk: evaluation.verbalStructureOk,
    periphrasisTypeOk: evaluation.periphrasisTypeOk,
    overallOk: evaluation.overallOk,
    phraseType: item.phraseType,
    explanation: item.explanation,
    mode: item.mode,
  };
}

export function makePeriphrasisAttempt(
  item: PeriphrasisItem,
  settings: PeriphrasisSettings,
  evaluation: PeriphrasisEvaluation,
): PeriphrasisAttempt {
  return {
    id: item.id,
    profileId: settings.profileId.trim() || "alumno",
    createdAt: nowIso(),
    difficulty: item.difficulty,
    sentence: item.sentence,
    expectedStructure: item.verbalStructure,
    expectedPeriphrasisType: item.periphrasisType,
    guessStructure: evaluation.guessStructure,
    guessPeriphrasisType: evaluation.guessPeriphrasisType,
    structureOk: evaluation.structureOk,
    periphrasisTypeOk: evaluation.periphrasisTypeOk,
    overallOk: evaluation.overallOk,
    phraseType: item.phraseType,
    explanation: item.explanation,
    mode: item.mode,
  };
}

export function makeMorfoAttempt(item: MorfoItem, settings: MorfoSettings, evaluation: MorfoEvaluation): MorfoAttempt {
  return {
    id: item.id,
    profileId: settings.profileId.trim() || "alumno",
    createdAt: nowIso(),
    difficulty: item.difficulty,
    word: item.word,
    expectedWordType: item.wordType,
    expectedLexeme: item.lexeme,
    expectedLexemes: acceptedLexemesForItem(item),
    expectedMorphemes: item.morphemes,
    expectedMorphemeTypes: item.morphemeTypes,
    expectedPrimaryMorphemeType: item.morphemeTypes[0] ?? "",
    guessWordType: evaluation.guessWordType,
    guessLexeme: evaluation.guessLexeme.trim(),
    guessMorphemes: evaluation.guessMorphemes,
    guessMorphemeTypes: evaluation.guessMorphemeTypes,
    wordTypeOk: evaluation.wordTypeOk,
    lexemeOk: evaluation.lexemeOk,
    morphemesOk: evaluation.morphemesOk,
    morphemeTypesOk: evaluation.morphemeTypesOk,
    overallOk: evaluation.overallOk,
    analysisType: item.analysisType,
    explanation: item.explanation,
    mode: item.mode,
  };
}

export function makeSintaxisAttempt(
  item: SintaxisItem,
  settings: SintaxisSettings,
  userAnswer: string,
): SintaxisAttempt {
  return {
    id: item.id,
    profileId: settings.profileId.trim() || "alumno",
    createdAt: nowIso(),
    difficulty: item.difficulty,
    phrase: item.phrase,
    userAnswer: userAnswer.trim(),
    correction: item.correction,
    mode: item.mode,
  };
}

export function makeDerivativeAttempt(item: DerivativeItem, settings: DerivativeSettings): DerivativeAttempt {
  return {
    id: item.id,
    profileId: settings.profileId.trim() || "alumno",
    createdAt: nowIso(),
    functionText: item.functionText,
    derivative: item.derivative,
    mode: item.mode,
  };
}

export function seAccuracy(attempts: SeAttempt[]): number {
  if (attempts.length === 0) {
    return 0;
  }
  const hits = attempts.filter((attempt) => attempt.overallOk).length;
  return (hits / attempts.length) * 100;
}

export function periphrasisAccuracy(attempts: PeriphrasisAttempt[]): number {
  if (attempts.length === 0) {
    return 0;
  }
  const hits = attempts.filter((attempt) => attempt.overallOk).length;
  return (hits / attempts.length) * 100;
}

export function resetSeAttempts(attempts: SeAttempt[], profileId: string): SeAttempt[] {
  return attempts.filter((attempt) => attempt.profileId !== profileId);
}

export function resetPeriphrasisAttempts(attempts: PeriphrasisAttempt[], profileId: string): PeriphrasisAttempt[] {
  return attempts.filter((attempt) => attempt.profileId !== profileId);
}

export function resetMorfoAttempts(attempts: MorfoAttempt[], profileId: string): MorfoAttempt[] {
  return attempts.filter((attempt) => attempt.profileId !== profileId);
}

export function resetSintaxisAttempts(attempts: SintaxisAttempt[], profileId: string): SintaxisAttempt[] {
  return attempts.filter((attempt) => attempt.profileId !== profileId);
}

export function resetDerivativeAttempts(attempts: DerivativeAttempt[], profileId: string): DerivativeAttempt[] {
  return attempts.filter((attempt) => attempt.profileId !== profileId);
}
