import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

import { requestStrictJson } from "./llm";
import { GENERATOR_SYSTEM_PROMPT, GRADER_SYSTEM_PROMPT } from "./prompts";
import {
  type GenerationRequest,
  generationRequestSchema,
  generationResponseSchema,
  type GradingRequest,
  type GradingResponse,
  gradingRequestSchema,
  gradingResponseSchema,
} from "./schemas";

initializeApp();
const db = getFirestore();
const geminiApiKey = defineSecret("GEMINI_API_KEY");

async function verifyUserUid(authorizationHeader?: string): Promise<string> {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new HttpsError("unauthenticated", "Missing bearer token.");
  }
  const idToken = authorizationHeader.replace("Bearer ", "").trim();
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    throw new HttpsError("unauthenticated", "Invalid Firebase ID token.");
  }
}

function badRequest(message: string): never {
  throw new HttpsError("invalid-argument", message);
}

function getModelCandidates(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const fallbacks = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
  return preferred ? [preferred, ...fallbacks] : fallbacks;
}

function errorStatus(error: unknown): number {
  if (!(error instanceof HttpsError)) {
    return 500;
  }
  if (error.code === "unauthenticated") {
    return 401;
  }
  if (error.code === "invalid-argument") {
    return 400;
  }
  return 500;
}

type GraderError = GradingResponse["errors"][number];

function normalizeErrorCode(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "UNSPECIFIED_ERROR";
}

function sanitizeError(error: GraderError, tokenCount: number): GraderError | null {
  if (tokenCount <= 0) {
    return null;
  }
  if (!Number.isFinite(error.spanStart) || !Number.isFinite(error.spanEnd)) {
    return null;
  }

  let start = Math.trunc(error.spanStart);
  let end = Math.trunc(error.spanEnd);
  const minIndex = 1;
  const maxIndex = tokenCount;

  start = Math.max(minIndex, Math.min(maxIndex, start));
  end = Math.max(minIndex, Math.min(maxIndex, end));

  if (end < start) {
    const nextStart = end;
    end = start;
    start = nextStart;
  }

  return {
    ...error,
    error_code: normalizeErrorCode(error.error_code),
    expected: error.expected?.trim() ?? null,
    got: error.got?.trim() ?? null,
    explanation: error.explanation?.trim() || undefined,
    spanStart: start,
    spanEnd: end,
  };
}

function dedupeErrors(errors: GraderError[]): GraderError[] {
  const seen = new Set<string>();
  const merged: GraderError[] = [];

  errors.forEach((error) => {
    const key = [
      error.category,
      error.error_code,
      error.spanStart,
      error.spanEnd,
      error.expected ?? "",
      error.got ?? "",
    ].join("|");

    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(error);
  });

  return merged;
}

type SentenceType = "simple" | "compuesta";
type Difficulty = 1 | 2 | 3;

interface DifficultyProfile {
  minTokens: number;
  maxTokens: number;
  complexityHint: string;
}

const difficultyProfiles: Record<SentenceType, Record<Difficulty, DifficultyProfile>> = {
  simple: {
    1: {
      minTokens: 5,
      maxTokens: 8,
      complexityHint: "Estructura muy directa, una sola forma verbal personal, complementos basicos.",
    },
    2: {
      minTokens: 8,
      maxTokens: 12,
      complexityHint: "Una sola forma verbal personal con expansion moderada (CN/CC/CI).",
    },
    3: {
      minTokens: 12,
      maxTokens: 18,
      complexityHint: "Una sola forma verbal personal con alta densidad de complementos y expansion.",
    },
  },
  compuesta: {
    1: {
      minTokens: 8,
      maxTokens: 12,
      complexityHint: "Dos proposiciones breves enlazadas por un nexo claro.",
    },
    2: {
      minTokens: 12,
      maxTokens: 18,
      complexityHint: "Dos proposiciones con expansion intermedia y nexo claro.",
    },
    3: {
      minTokens: 18,
      maxTokens: 26,
      complexityHint: "Dos o tres proposiciones con complejidad sintactica avanzada.",
    },
  },
};

function profileFor(sentenceType: SentenceType, difficulty: Difficulty): DifficultyProfile {
  return difficultyProfiles[sentenceType][difficulty];
}

function fitsDifficultyProfile(tokens: string[], profile: DifficultyProfile): boolean {
  return tokens.length >= profile.minTokens && tokens.length <= profile.maxTokens;
}

export const generateSentence = onRequest(
  { cors: true, secrets: [geminiApiKey], region: "us-central1" },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Only POST is allowed.");
      return;
    }

    try {
      await verifyUserUid(request.headers.authorization);
      const parsed = generationRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        badRequest(parsed.error.message);
      }
      const payload = parsed.data as GenerationRequest;
      const profile = profileFor(payload.sentenceType, payload.difficulty);

      const buildGenerationPrompt = (retryNote?: string) =>
        JSON.stringify(
        {
          requestType: "generation",
          constraints: {
            sentenceType: payload.sentenceType,
            difficulty: payload.difficulty,
            focusTopics: payload.focusTopics,
            punctuationPolicy: payload.punctuationPolicy,
            weaknessSummary: payload.weaknessSummary ?? null,
            difficultyProfile: {
              minTokens: profile.minTokens,
              maxTokens: profile.maxTokens,
              complexityHint: profile.complexityHint,
            },
            retryNote: retryNote ?? null,
          },
          requiredOutputSchema: {
            sentence: "string",
            tokens: ["string"],
            targetFeatures: ["string"],
            appliedPolicies: {
              punctuationSimplified: "boolean",
            },
          },
        },
        null,
        2,
      );

      let generation = await requestStrictJson({
        apiKey: geminiApiKey.value(),
        modelNames: getModelCandidates(),
        systemPrompt: GENERATOR_SYSTEM_PROMPT,
        userPrompt: buildGenerationPrompt(),
        schema: generationResponseSchema,
        temperature: 0.35,
      });

      if (!fitsDifficultyProfile(generation.tokens, profile)) {
        generation = await requestStrictJson({
          apiKey: geminiApiKey.value(),
          modelNames: getModelCandidates(),
          systemPrompt: GENERATOR_SYSTEM_PROMPT,
          userPrompt: buildGenerationPrompt(
            `Salida anterior fuera de rango: ${generation.tokens.length} tokens. Debes cumplir estrictamente ${profile.minTokens}-${profile.maxTokens} tokens.`,
          ),
          schema: generationResponseSchema,
          temperature: 0.25,
        });
      }

      response.status(200).json(generation);
    } catch (error) {
      const status = errorStatus(error);
      response.status(status).send(error instanceof Error ? error.message : "Generation failed.");
    }
  },
);

export const gradeAttempt = onRequest(
  { cors: true, secrets: [geminiApiKey], region: "us-central1" },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Only POST is allowed.");
      return;
    }

    try {
      await verifyUserUid(request.headers.authorization);
      const parsed = gradingRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        badRequest(parsed.error.message);
      }
      const payload = parsed.data as GradingRequest;

      const promptEnvelope = {
        requestType: "grading",
        input: payload,
        requiredOutputSchema: {
          feedbackMarkdown: "string",
          correctedAnswerMarkdown: "string",
          reviewItems: [
            {
              status: "correct|incorrect",
              title: "string",
              detail: "string",
              spanStart: "number(optional, 1-based)",
              spanEnd: "number(optional, 1-based)",
            },
          ],
          errors: [
            {
              error_code: "string",
              category: "pos|function|grouping|sentenceType|punctuation",
              expected: "string|null",
              got: "string|null",
              spanStart: "number",
              spanEnd: "number",
              severity: "minor|major",
              explanation: "string(optional)",
            },
          ],
        },
      };

      const userPrompt = JSON.stringify(promptEnvelope, null, 2);

      const mainGrade = await requestStrictJson({
        apiKey: geminiApiKey.value(),
        modelNames: getModelCandidates(),
        systemPrompt: GRADER_SYSTEM_PROMPT,
        userPrompt,
        schema: gradingResponseSchema,
        temperature: 0.2,
      });

      const tokenCount = payload.tokens.length;
      const primarySanitized = mainGrade.errors
        .map((error) => sanitizeError(error, tokenCount))
        .filter((error): error is GraderError => error !== null);
      const mergedErrors = dedupeErrors(primarySanitized);

      response.status(200).json({
        ...mainGrade,
        feedbackMarkdown: mainGrade.feedbackMarkdown,
        errors: mergedErrors,
      } satisfies GradingResponse);
    } catch (error) {
      const status = errorStatus(error);
      response.status(status).send(error instanceof Error ? error.message : "Grading failed.");
    }
  },
);

type ErrorCategory = "pos" | "function" | "grouping" | "sentenceType" | "punctuation";

interface ErrorDocument {
  uid: string;
  createdAt: FirebaseFirestore.Timestamp;
  sentenceType: "simple" | "compuesta";
  difficulty: Difficulty;
  error_code: string;
  category: ErrorCategory;
  expected: string | null;
  got: string | null;
  spanStart: number;
  spanEnd: number;
  severity: "minor" | "major";
}

const EMPTY_SUMMARY = {
  totalErrors: 0,
  errorsByCode: {} as Record<string, number>,
  errorsByCategory: {
    pos: 0,
    function: 0,
    grouping: 0,
    sentenceType: 0,
    punctuation: 0,
  },
  errorsByDifficulty: {
    1: 0,
    2: 0,
    3: 0,
  },
  last30dCount: 0,
};

export const onErrorCreated = onDocumentCreated("errors/{errorId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    return;
  }

  const errorDoc = snapshot.data() as ErrorDocument;
  if (!errorDoc?.uid || !errorDoc?.error_code) {
    return;
  }

  const summaryRef = db.doc(`users/${errorDoc.uid}/analytics/summary`);
  const thirtyDaysAgo = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);

  await db.runTransaction(async (tx) => {
    const summarySnap = await tx.get(summaryRef);
    if (!summarySnap.exists) {
      tx.set(summaryRef, {
        ...EMPTY_SUMMARY,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const last30dQuery = db
      .collection("errors")
      .where("uid", "==", errorDoc.uid)
      .where("createdAt", ">=", thirtyDaysAgo)
      .orderBy("createdAt", "desc");

    const last30dSnap = await tx.get(last30dQuery);

    tx.set(
      summaryRef,
      {
        updatedAt: FieldValue.serverTimestamp(),
        totalErrors: FieldValue.increment(1),
        [`errorsByCode.${errorDoc.error_code}`]: FieldValue.increment(1),
        [`errorsByCategory.${errorDoc.category}`]: FieldValue.increment(1),
        [`errorsByDifficulty.${errorDoc.difficulty}`]: FieldValue.increment(1),
        last30dCount: last30dSnap.size,
      },
      { merge: true },
    );
  });
});
