import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

import { requestStrictJson } from "./llm";
import { GENERATOR_SYSTEM_PROMPT, GRADER_AUDIT_SYSTEM_PROMPT, GRADER_SYSTEM_PROMPT } from "./prompts";
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
  const maxIndex = tokenCount - 1;

  start = Math.max(0, Math.min(maxIndex, start));
  end = Math.max(0, Math.min(maxIndex, end));

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

interface AnalysisLike {
  settings?: {
    showPosRow?: boolean;
  };
  tokenPosAssignments?: Array<{
    tokenIndex?: number;
    pos?: string;
  }>;
  annotations?: Array<{
    label?: string;
    kind?: string;
    span?: {
      start?: number;
      end?: number;
    };
  }>;
}

function isPunctuationToken(token: string): boolean {
  return /^[.,;:!?()[\]{}"'\-]+$/.test(token.trim());
}

function collectRuleBasedErrors(payload: GradingRequest): GraderError[] {
  const analysis = (payload.analysis ?? {}) as AnalysisLike;
  const tokenCount = payload.tokens.length;
  const errors: GraderError[] = [];

  if (analysis.settings?.showPosRow) {
    const assignedPos = new Set<number>();
    (analysis.tokenPosAssignments ?? []).forEach((entry) => {
      const tokenIndex = entry.tokenIndex;
      if (typeof tokenIndex !== "number" || !Number.isInteger(tokenIndex) || !entry.pos?.trim()) {
        return;
      }
      assignedPos.add(tokenIndex);
    });

    payload.tokens.forEach((token, index) => {
      if (isPunctuationToken(token)) {
        return;
      }
      if (assignedPos.has(index)) {
        return;
      }
      errors.push({
        error_code: "POS_MISSING",
        category: "pos",
        expected: "Categoria gramatical asignada",
        got: null,
        spanStart: index,
        spanEnd: index,
        severity: "major",
        explanation: "Falta la categoria gramatical de este token.",
      });
    });
  }

  const annotations = analysis.annotations ?? [];
  if (annotations.length === 0 && tokenCount > 0) {
    errors.push({
      error_code: "FUNCTION_MISSING",
      category: "function",
      expected: "Al menos una anotacion sintactica",
      got: "Sin anotaciones",
      spanStart: 0,
      spanEnd: tokenCount - 1,
      severity: "major",
      explanation: "No hay funciones sintacticas marcadas en la oracion.",
    });
    return errors;
  }

  annotations.forEach((annotation) => {
    const start = annotation.span?.start;
    const end = annotation.span?.end;
    const hasValidBounds = Number.isInteger(start) && Number.isInteger(end);
    const normalizedStart = Number.isInteger(start) ? Number(start) : 0;
    const normalizedEnd = Number.isInteger(end) ? Number(end) : 0;

    if (!annotation.label?.trim()) {
      errors.push({
        error_code: "FUNCTION_LABEL_MISMATCH",
        category: annotation.kind === "groupFunction" ? "grouping" : "function",
        expected: "Etiqueta sintactica valida",
        got: annotation.label ?? null,
        spanStart: Math.max(0, Math.min(tokenCount - 1, normalizedStart)),
        spanEnd: Math.max(0, Math.min(tokenCount - 1, normalizedEnd)),
        severity: "major",
        explanation: "La anotacion no tiene etiqueta.",
      });
    }

    if (!hasValidBounds || tokenCount === 0) {
      return;
    }

    if (normalizedStart < 0 || normalizedEnd < 0 || normalizedStart >= tokenCount || normalizedEnd >= tokenCount) {
      errors.push({
        error_code: "GROUPING_SPAN_MISMATCH",
        category: "grouping",
        expected: `Indices entre 0 y ${tokenCount - 1}`,
        got: `${normalizedStart}-${normalizedEnd}`,
        spanStart: Math.max(0, Math.min(tokenCount - 1, normalizedStart)),
        spanEnd: Math.max(0, Math.min(tokenCount - 1, normalizedEnd)),
        severity: "major",
        explanation: "El tramo de la anotacion queda fuera de los limites de tokens.",
      });
      return;
    }

    if (normalizedStart > normalizedEnd) {
      errors.push({
        error_code: "GROUPING_SPAN_MISMATCH",
        category: "grouping",
        expected: "spanStart <= spanEnd",
        got: `${normalizedStart}-${normalizedEnd}`,
        spanStart: normalizedEnd,
        spanEnd: normalizedStart,
        severity: "major",
        explanation: "El tramo tiene inicio mayor que el final.",
      });
    }
  });

  return errors;
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

      const userPrompt = JSON.stringify(
        {
          requestType: "generation",
          constraints: {
            sentenceType: payload.sentenceType,
            difficulty: payload.difficulty,
            focusTopics: payload.focusTopics,
            punctuationPolicy: payload.punctuationPolicy,
            weaknessSummary: payload.weaknessSummary ?? null,
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

      const generation = await requestStrictJson({
        apiKey: geminiApiKey.value(),
        modelNames: getModelCandidates(),
        systemPrompt: GENERATOR_SYSTEM_PROMPT,
        userPrompt,
        schema: generationResponseSchema,
        temperature: 0.35,
      });

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
        gradingPolicy: {
          mustBeExhaustive: true,
          reportEveryMismatchSeparately: true,
          preferMajorWhenClearlyWrong: true,
        },
        requiredOutputSchema: {
          feedbackMarkdown: "string",
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
        temperature: 0.1,
      });

      let auditGrade: GradingResponse | null = null;
      try {
        const auditPrompt = JSON.stringify(
          {
            requestType: "grading_audit",
            originalInput: payload,
            preliminaryErrors: mainGrade.errors,
            requiredOutputSchema: promptEnvelope.requiredOutputSchema,
          },
          null,
          2,
        );

        auditGrade = await requestStrictJson({
          apiKey: geminiApiKey.value(),
          modelNames: getModelCandidates(),
          systemPrompt: GRADER_AUDIT_SYSTEM_PROMPT,
          userPrompt: auditPrompt,
          schema: gradingResponseSchema,
          temperature: 0,
        });
      } catch (auditError) {
        console.warn("Grading audit pass failed; returning primary grading only.", auditError);
      }

      const tokenCount = payload.tokens.length;
      const primarySanitized = mainGrade.errors
        .map((error) => sanitizeError(error, tokenCount))
        .filter((error): error is GraderError => error !== null);
      const auditSanitized = (auditGrade?.errors ?? [])
        .map((error) => sanitizeError(error, tokenCount))
        .filter((error): error is GraderError => error !== null);
      const ruleBased = collectRuleBasedErrors(payload)
        .map((error) => sanitizeError(error, tokenCount))
        .filter((error): error is GraderError => error !== null);
      const mergedErrors = dedupeErrors([...primarySanitized, ...auditSanitized, ...ruleBased]);

      const extraErrorsFound = Math.max(0, mergedErrors.length - primarySanitized.length);
      const feedbackTail =
        extraErrorsFound > 0
          ? `\n\nRevision adicional: se detectaron ${extraErrorsFound} errores extra en la auditoria.`
          : "";

      response.status(200).json({
        ...mainGrade,
        feedbackMarkdown: `${mainGrade.feedbackMarkdown}${feedbackTail}`,
        errors: mergedErrors,
      } satisfies GradingResponse);
    } catch (error) {
      const status = errorStatus(error);
      response.status(status).send(error instanceof Error ? error.message : "Grading failed.");
    }
  },
);

type ErrorCategory = "pos" | "function" | "grouping" | "sentenceType" | "punctuation";
type Difficulty = 1 | 2 | 3;

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
