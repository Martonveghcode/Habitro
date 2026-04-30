import {
  normalizeFunctionLabel,
  normalizeMorphemeTypeLabel,
  normalizePieceToken,
  normalizePeriphrasisTypeLabel,
  normalizeSeValueLabel,
  normalizeTextToken,
  uniqueNormalizedItems,
  normalizeVerbalStructureLabel,
} from "./logic";
import type {
  MorfoItem,
  MorfoStrategy,
  QuestionResult,
  RecheckResultMorfo,
  RecheckResultSe,
  SeItem,
  SeStrategy,
} from "./types";

async function postAi<T>(body: unknown, apiKey?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey?.trim()) {
    headers["x-gemini-api-key"] = apiKey.trim();
  }

  const response = await fetch("/api/ai", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "AI request failed.");
  }
  return payload as T;
}

function cleanMorphemeToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^[\s\-\u2010\u2011\u2012\u2013\u2014]+|[\s\-\u2010\u2011\u2012\u2013\u2014]+$/g, "");
}

function sanitizeSeItem(
  raw: Record<string, unknown>,
  strategy: SeStrategy,
  options: {
    allowedValues: readonly string[];
    allowedVerbalStructures: readonly string[];
    allowedPeriphrasisTypes: readonly string[];
  },
): Omit<SeItem, "id"> | null {
  const sentence = String(raw.sentence ?? "").trim();
  const seValue = normalizeSeValueLabel(String(raw.seValue ?? raw.se_value ?? "").trim(), options.allowedValues);
  const seFunction = normalizeFunctionLabel(String(raw.seFunction ?? raw.se_function ?? "").trim());
  const rawAcceptedFunctions = raw.acceptedFunctions ?? raw.accepted_functions;
  const acceptedFunctions = Array.isArray(rawAcceptedFunctions)
    ? rawAcceptedFunctions
        .map((entry: unknown) => normalizeFunctionLabel(String(entry).trim()))
        .filter(Boolean)
    : [];
  const verbalStructure = normalizeVerbalStructureLabel(
    String(raw.verbalStructure ?? raw.verbal_structure ?? "").trim(),
    options.allowedVerbalStructures,
  );
  const periphrasisType = normalizePeriphrasisTypeLabel(
    String(raw.periphrasisType ?? raw.periphrasis_type ?? "").trim(),
    options.allowedPeriphrasisTypes,
  );
  const phraseType = String(raw.phraseType ?? raw.phrase_type ?? "").trim();
  const explanation = String(raw.explanation ?? "").trim();
  const difficulty = Number(raw.difficulty ?? 0) as SeItem["difficulty"];

  if (!sentence || !seValue || !seFunction || !verbalStructure || !periphrasisType || !phraseType || !explanation || !difficulty) {
    return null;
  }

  return {
    sentence,
    difficulty,
    seValue,
    seFunction,
    acceptedFunctions: acceptedFunctions.length > 0 ? acceptedFunctions : [seFunction],
    verbalStructure,
    periphrasisType,
    phraseType,
    explanation,
    mode: strategy.mode,
  };
}

function sanitizeMorfoItem(raw: Record<string, unknown>, strategy: MorfoStrategy): Omit<MorfoItem, "id"> | null {
  const word = String(raw.word ?? "").trim();
  const wordType = String(raw.wordType ?? raw.word_type ?? "").trim();
  const lexeme = String(raw.lexeme ?? "").trim();
  const rawAcceptedLexemes = raw.acceptedLexemes ?? raw.accepted_lexemes;
  const acceptedLexemes = uniqueNormalizedItems(
    [
      lexeme,
      ...(Array.isArray(rawAcceptedLexemes) ? rawAcceptedLexemes.map((entry) => String(entry).trim()) : []),
    ],
    normalizeTextToken,
  );
  const morphemes = Array.isArray(raw.morphemes) ? raw.morphemes.map(cleanMorphemeToken).filter(Boolean) : [];
  const rawMorphemeTypes = raw.morphemeTypes ?? raw.morpheme_types;
  const morphemeTypes = Array.isArray(rawMorphemeTypes)
    ? rawMorphemeTypes.map((entry) => normalizeMorphemeTypeLabel(String(entry).trim())).filter(Boolean)
    : [];
  const analysisType = String(raw.analysisType ?? raw.analysis_type ?? "").trim();
  const explanation = String(raw.explanation ?? "").trim();
  const difficulty = Number(raw.difficulty ?? 0) as MorfoItem["difficulty"];

  if (
    !word ||
    !wordType ||
    !lexeme ||
    !analysisType ||
    !explanation ||
    !difficulty ||
    morphemes.length === 0 ||
    morphemes.length !== morphemeTypes.length ||
    morphemes.some((morpheme) => normalizePieceToken(morpheme) === normalizePieceToken(lexeme))
  ) {
    return null;
  }

  return {
    word,
    difficulty,
    wordType,
    lexeme,
    acceptedLexemes,
    morphemes,
    morphemeTypes,
    analysisType,
    explanation,
    mode: strategy.mode,
  };
}

export async function requestSeGeneration(input: {
  apiKey?: string;
  modelName: string;
  difficulty: 1 | 2 | 3;
  strategies: SeStrategy[];
  profile: unknown;
  recentSentences: string[];
  recentLabels: Array<{ value: string; function: string; verbalStructure: string; periphrasisType: string }>;
  allowedValues: string[];
  allowedFunctions: string[];
  allowedVerbalStructures: string[];
  allowedPeriphrasisTypes: string[];
}): Promise<Array<Omit<SeItem, "id"> | null>> {
  const payload = await postAi<{ items?: Array<Record<string, unknown>> }>(
    {
      action: "generate-se",
      modelName: input.modelName,
      payload: {
        difficulty: input.difficulty,
        strategies: input.strategies,
        profile: input.profile,
        recentSentences: input.recentSentences,
        recentLabels: input.recentLabels,
        allowedValues: input.allowedValues,
        allowedFunctions: input.allowedFunctions,
        allowedVerbalStructures: input.allowedVerbalStructures,
        allowedPeriphrasisTypes: input.allowedPeriphrasisTypes,
      },
    },
    input.apiKey,
  );

  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  return input.strategies.map((strategy, index) => {
    const item = rawItems[index];
    if (!item || typeof item !== "object") {
      return null;
    }
    return sanitizeSeItem(item, strategy, {
        allowedValues: input.allowedValues,
        allowedVerbalStructures: input.allowedVerbalStructures,
        allowedPeriphrasisTypes: input.allowedPeriphrasisTypes,
      });
  });
}

export async function requestMorfoGeneration(input: {
  apiKey?: string;
  modelName: string;
  difficulty: 1 | 2 | 3;
  strategies: MorfoStrategy[];
  profile: unknown;
  recentWords: string[];
  recentLabels: Array<{ wordType: string; morphemeType: string }>;
}): Promise<Array<Omit<MorfoItem, "id">>> {
  const payload = await postAi<{ items?: Array<Record<string, unknown>> }>(
    {
      action: "generate-morfo",
      modelName: input.modelName,
      payload: {
        difficulty: input.difficulty,
        strategies: input.strategies,
        profile: input.profile,
        recentWords: input.recentWords,
        recentLabels: input.recentLabels,
      },
    },
    input.apiKey,
  );

  return (payload.items ?? [])
    .map((item, index) => sanitizeMorfoItem(item, input.strategies[index] ?? input.strategies[0]))
    .filter((item): item is Omit<MorfoItem, "id"> => item !== null);
}

export async function requestSeRecheck(payload: {
  apiKey?: string;
  modelName: string;
  sentence: string;
  seValue: string;
  seFunction: string;
  acceptedFunctions: string[];
  verbalStructure: string;
  periphrasisType: string;
  phraseType: string;
  explanation: string;
  allowedValues: string[];
  allowedFunctions: string[];
  allowedVerbalStructures: string[];
  allowedPeriphrasisTypes: string[];
}): Promise<RecheckResultSe> {
  const { apiKey, ...rest } = payload;
  return postAi<RecheckResultSe>(
    {
      action: "recheck-se",
      modelName: rest.modelName,
      payload: rest,
    },
    apiKey,
  );
}

export async function requestMorfoRecheck(payload: {
  apiKey?: string;
  modelName: string;
  word: string;
  wordType: string;
  lexeme: string;
  morphemes: string[];
  morphemeTypes: string[];
  analysisType: string;
  explanation: string;
}): Promise<RecheckResultMorfo> {
  const { apiKey, ...rest } = payload;
  return postAi<RecheckResultMorfo>(
    {
      action: "recheck-morfo",
      modelName: rest.modelName,
      payload: rest,
    },
    apiKey,
  );
}

export async function requestSeQuestion(payload: {
  apiKey?: string;
  modelName: string;
  item: {
    sentence: string;
    seValue: string;
    seFunction: string;
    verbalStructure: string;
    periphrasisType: string;
    phraseType: string;
    explanation: string;
  };
  question: string;
  recheckResult?: unknown;
}): Promise<QuestionResult> {
  const { apiKey, ...rest } = payload;
  return postAi<QuestionResult>(
    {
      action: "question-se",
      modelName: rest.modelName,
      payload: rest,
    },
    apiKey,
  );
}

export async function requestMorfoQuestion(payload: {
  apiKey?: string;
  modelName: string;
  item: {
    word: string;
    wordType: string;
    lexeme: string;
    morphemes: string[];
    morphemeTypes: string[];
    analysisType: string;
    explanation: string;
  };
  question: string;
  recheckResult?: unknown;
}): Promise<QuestionResult> {
  const { apiKey, ...rest } = payload;
  return postAi<QuestionResult>(
    {
      action: "question-morfo",
      modelName: rest.modelName,
      payload: rest,
    },
    apiKey,
  );
}
