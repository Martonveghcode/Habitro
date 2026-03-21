import { normalizeFunctionLabel, normalizeMorphemeTypeLabel } from "./logic";
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

function sanitizeSeItem(raw: Record<string, unknown>, strategy: SeStrategy): Omit<SeItem, "id"> | null {
  const sentence = String(raw.sentence ?? "").trim();
  const seValue = String(raw.seValue ?? "").trim();
  const seFunction = normalizeFunctionLabel(String(raw.seFunction ?? "").trim());
  const acceptedFunctions = Array.isArray(raw.acceptedFunctions)
    ? raw.acceptedFunctions.map((entry) => normalizeFunctionLabel(String(entry).trim())).filter(Boolean)
    : [];
  const phraseType = String(raw.phraseType ?? "").trim();
  const explanation = String(raw.explanation ?? "").trim();
  const difficulty = Number(raw.difficulty ?? 0) as SeItem["difficulty"];

  if (!sentence || !seValue || !seFunction || !phraseType || !explanation || !difficulty) {
    return null;
  }

  return {
    sentence,
    difficulty,
    seValue,
    seFunction,
    acceptedFunctions: acceptedFunctions.length > 0 ? acceptedFunctions : [seFunction],
    phraseType,
    explanation,
    mode: strategy.mode,
  };
}

function sanitizeMorfoItem(raw: Record<string, unknown>, strategy: MorfoStrategy): Omit<MorfoItem, "id"> | null {
  const word = String(raw.word ?? "").trim();
  const wordType = String(raw.wordType ?? "").trim();
  const lexeme = String(raw.lexeme ?? "").trim();
  const acceptedLexemes = Array.isArray(raw.acceptedLexemes)
    ? raw.acceptedLexemes.map((entry) => String(entry).trim()).filter(Boolean)
    : [];
  const morphemes = Array.isArray(raw.morphemes) ? raw.morphemes.map((entry) => String(entry).trim()).filter(Boolean) : [];
  const morphemeTypes = Array.isArray(raw.morphemeTypes)
    ? raw.morphemeTypes.map((entry) => normalizeMorphemeTypeLabel(String(entry).trim())).filter(Boolean)
    : [];
  const analysisType = String(raw.analysisType ?? "").trim();
  const explanation = String(raw.explanation ?? "").trim();
  const difficulty = Number(raw.difficulty ?? 0) as MorfoItem["difficulty"];

  if (!word || !wordType || !lexeme || !analysisType || !explanation || !difficulty) {
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
  recentLabels: Array<{ value: string; function: string }>;
}): Promise<Array<Omit<SeItem, "id">>> {
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
      },
    },
    input.apiKey,
  );

  return (payload.items ?? [])
    .map((item, index) => sanitizeSeItem(item, input.strategies[index] ?? input.strategies[0]))
    .filter((item): item is Omit<SeItem, "id"> => item !== null);
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
  phraseType: string;
  explanation: string;
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
