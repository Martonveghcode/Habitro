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
    difficulty: 2,
    personalized: true,
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
    difficulty: 2,
    personalized: true,
    focusStructures: [],
    customPeriphrasisTypes: [],
    targetWeight: 40,
    normalWeight: 60,
    hideHistory: false,
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

export function createDefaultStorageState(): StorageState {
  return {
    version: 1,
    geminiApiKey: "",
    seSettings: defaultSeSettings(),
    periphrasisSettings: defaultPeriphrasisSettings(),
    morfoSettings: defaultMorfoSettings(),
    seAttempts: [],
    periphrasisAttempts: [],
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
    const parsedSeSettings = (parsed.seSettings ?? {}) as Partial<SeSettings>;
    const parsedPeriphrasisSettings = (parsed.periphrasisSettings ?? {}) as Partial<PeriphrasisSettings>;
    const parsedMorfoSettings = (parsed.morfoSettings ?? {}) as Partial<MorfoSettings>;
    return {
      version: 1,
      geminiApiKey: typeof parsed.geminiApiKey === "string" ? parsed.geminiApiKey : "",
      seSettings: {
        ...defaultSeSettings(),
        ...parsedSeSettings,
        focusValues: Array.isArray(parsedSeSettings.focusValues)
          ? parsedSeSettings.focusValues.filter((entry): entry is string => typeof entry === "string")
          : [],
        customValues: Array.isArray(parsedSeSettings.customValues)
          ? parsedSeSettings.customValues.filter((entry): entry is string => typeof entry === "string")
          : [],
        customPeriphrasisTypes: Array.isArray(parsedSeSettings.customPeriphrasisTypes)
          ? parsedSeSettings.customPeriphrasisTypes.filter((entry): entry is string => typeof entry === "string")
          : [],
      },
      periphrasisSettings: {
        ...defaultPeriphrasisSettings(),
        ...parsedPeriphrasisSettings,
        focusStructures: Array.isArray(parsedPeriphrasisSettings.focusStructures)
          ? parsedPeriphrasisSettings.focusStructures.filter((entry): entry is string => typeof entry === "string")
          : [],
        customPeriphrasisTypes: Array.isArray(parsedPeriphrasisSettings.customPeriphrasisTypes)
          ? parsedPeriphrasisSettings.customPeriphrasisTypes.filter((entry): entry is string => typeof entry === "string")
          : [],
      },
      morfoSettings: {
        ...defaultMorfoSettings(),
        ...parsedMorfoSettings,
        focusWordTypes: Array.isArray(parsedMorfoSettings.focusWordTypes)
          ? parsedMorfoSettings.focusWordTypes.filter((entry): entry is string => typeof entry === "string")
          : [],
      },
      seAttempts: Array.isArray(parsed.seAttempts)
        ? parsed.seAttempts.map((attempt) => sanitizeStoredSeAttempt(attempt)).filter((attempt): attempt is SeAttempt => attempt !== null)
        : [],
      periphrasisAttempts: Array.isArray(parsed.periphrasisAttempts)
        ? parsed.periphrasisAttempts
            .map((attempt) => sanitizeStoredPeriphrasisAttempt(attempt))
            .filter((attempt): attempt is PeriphrasisAttempt => attempt !== null)
        : [],
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

export function fallbackPeriphrasisBatch(
  difficulty: Difficulty,
  strategies: PeriphrasisStrategy[],
  recentSentences: string[],
): PeriphrasisItem[] {
  const memory = [...recentSentences];
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
    const novel = pool.filter((item) => isNovelSentence(item.sentence, memory, 0.75));
    if (novel.length > 0) {
      pool = novel;
    }
    const chosen = randomItem(pool);
    memory.push(chosen.sentence);
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
  return normalizeTextToken(value).replace(/\s+/g, "");
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
