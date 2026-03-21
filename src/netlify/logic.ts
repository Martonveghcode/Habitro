import {
  MODEL_OPTIONS,
  MORFO_MORPHEME_TYPES,
  MORFO_SAMPLE_BANK,
  MORFO_WORD_TYPES,
  SE_FUNCTIONS,
  SE_SAMPLE_BANK,
  SE_VALUES,
} from "./data";
import type {
  Difficulty,
  MorfoAttempt,
  MorfoEvaluation,
  MorfoItem,
  MorfoProfile,
  MorfoSettings,
  MorfoStrategy,
  PairSummaryRow,
  SeAttempt,
  SeEvaluation,
  SeItem,
  SeProfile,
  SeSettings,
  SeStrategy,
  StorageState,
  SummaryRow,
} from "./types";

const STORAGE_KEY = "sintaxis-netlify-practice-v1";
const DEFAULT_MODEL = MODEL_OPTIONS[0]?.value ?? "gemini-2.5-flash-lite";

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
    difficulty: 2,
    personalized: true,
    focusValues: [],
    targetWeight: 40,
    normalWeight: 60,
    hideHistory: false,
  };
}

function defaultMorfoSettings(): MorfoSettings {
  return {
    profileId: "alumno",
    modelName: DEFAULT_MODEL,
    difficulty: 2,
    personalized: true,
    focusWordTypes: [],
    targetWeight: 40,
    normalWeight: 60,
    hideHistory: false,
  };
}

export function createDefaultStorageState(): StorageState {
  return {
    version: 1,
    geminiApiKey: "",
    seSettings: defaultSeSettings(),
    morfoSettings: defaultMorfoSettings(),
    seAttempts: [],
    morfoAttempts: [],
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
    return {
      version: 1,
      geminiApiKey: typeof parsed.geminiApiKey === "string" ? parsed.geminiApiKey : "",
      seSettings: { ...defaultSeSettings(), ...(parsed.seSettings ?? {}) },
      morfoSettings: { ...defaultMorfoSettings(), ...(parsed.morfoSettings ?? {}) },
      seAttempts: Array.isArray(parsed.seAttempts) ? parsed.seAttempts : [],
      morfoAttempts: Array.isArray(parsed.morfoAttempts) ? parsed.morfoAttempts : [],
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
  const valueStats = emptyAxis(SE_VALUES);
  const functionStats = emptyAxis(SE_FUNCTIONS);
  const pairStats: Record<string, { ok: number; fail: number }> = {};

  filtered.forEach((attempt) => {
    valueStats[attempt.expectedValue] ??= { ok: 0, fail: 0 };
    functionStats[attempt.expectedFunction] ??= { ok: 0, fail: 0 };
    valueStats[attempt.expectedValue][attempt.valueOk ? "ok" : "fail"] += 1;
    functionStats[attempt.expectedFunction][attempt.functionOk ? "ok" : "fail"] += 1;
    const pairKey = `${attempt.expectedValue} || ${attempt.expectedFunction}`;
    pairStats[pairKey] ??= { ok: 0, fail: 0 };
    pairStats[pairKey][attempt.valueOk && attempt.functionOk ? "ok" : "fail"] += 1;
  });

  const [weakValues, strongValues] = axisSummary(valueStats);
  const [weakFunctions, strongFunctions] = axisSummary(functionStats);

  return {
    totalAttempts: filtered.length,
    weakValues,
    strongValues,
    weakFunctions,
    strongFunctions,
    valueOverview: axisOverview(valueStats),
    functionOverview: axisOverview(functionStats),
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
    targetValue,
    targetFunction,
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

export function fetchRecentSeLabels(attempts: SeAttempt[], profileId: string, limit = 10): Array<{ value: string; function: string }> {
  return attempts
    .filter((attempt) => attempt.profileId === profileId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit)
    .map((attempt) => ({ value: attempt.expectedValue, function: attempt.expectedFunction }));
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

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function fallbackSeBatch(
  difficulty: Difficulty,
  strategies: SeStrategy[],
  recentSentences: string[],
): SeItem[] {
  const memory = [...recentSentences];
  return strategies.map((strategy) => {
    let pool = [...SE_SAMPLE_BANK[difficulty]];
    const targetValues = strategy.focusValues.length > 0 ? strategy.focusValues : strategy.targetValue ? [strategy.targetValue] : [];
    if (targetValues.length > 0) {
      const filtered = pool.filter((item) => targetValues.includes(item.seValue));
      if (filtered.length > 0) {
        pool = filtered;
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

export function normalizeTextToken(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizePieceToken(value: string): string {
  return normalizeTextToken(value).replace(/\s+/g, "");
}

export function normalizeMorphemeTypeLabel(value: string): string {
  const key = normalizeTextToken(value);
  const mapping = new Map<string, string>(
    MORFO_MORPHEME_TYPES.map((label) => [normalizeTextToken(label), label]),
  );
  return mapping.get(key) ?? value.trim();
}

export function uniqueItems<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function parseGuessList(rawText: string): string[] {
  return rawText
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function evaluateSeGuess(item: SeItem, guessValue: string, guessFunction: string): SeEvaluation {
  const valueOk = guessValue === item.seValue;
  const functionOk = item.acceptedFunctions.includes(guessFunction);
  return {
    guessValue,
    guessFunction,
    valueOk,
    functionOk,
    overallOk: valueOk && functionOk,
  };
}

export function evaluateMorfoGuess(
  item: MorfoItem,
  guessWordType: string,
  guessLexeme: string,
  guessMorphemesText: string,
  guessMorphemeTypes: string[],
): MorfoEvaluation {
  const expectedLexemes = item.acceptedLexemes.map(normalizeTextToken).filter(Boolean);
  const lexemeOk = expectedLexemes.includes(normalizeTextToken(guessLexeme));
  const guessedMorphemes = parseGuessList(guessMorphemesText);
  const expectedMorphemeSet = new Set(item.morphemes.map(normalizePieceToken).filter(Boolean));
  const guessedMorphemeSet = new Set(guessedMorphemes.map(normalizePieceToken).filter(Boolean));
  const morphemesOk =
    expectedMorphemeSet.size > 0 &&
    expectedMorphemeSet.size === guessedMorphemeSet.size &&
    [...expectedMorphemeSet].every((value) => guessedMorphemeSet.has(value));

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
    guessValue: evaluation.guessValue,
    guessFunction: evaluation.guessFunction,
    valueOk: evaluation.valueOk,
    functionOk: evaluation.functionOk,
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
    expectedLexemes: item.acceptedLexemes,
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

export function seAccuracy(attempts: SeAttempt[]): number {
  if (attempts.length === 0) {
    return 0;
  }
  const hits = attempts.filter((attempt) => attempt.valueOk && attempt.functionOk).length;
  return (hits / attempts.length) * 100;
}

export function resetSeAttempts(attempts: SeAttempt[], profileId: string): SeAttempt[] {
  return attempts.filter((attempt) => attempt.profileId !== profileId);
}

export function resetMorfoAttempts(attempts: MorfoAttempt[], profileId: string): MorfoAttempt[] {
  return attempts.filter((attempt) => attempt.profileId !== profileId);
}
