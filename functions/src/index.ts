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

function getModelName(): string {
  return process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
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
        modelName: getModelName(),
        systemPrompt: GENERATOR_SYSTEM_PROMPT,
        userPrompt,
        schema: generationResponseSchema,
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

      const userPrompt = JSON.stringify(
        {
          requestType: "grading",
          input: payload,
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
        },
        null,
        2,
      );

      const grade = await requestStrictJson({
        apiKey: geminiApiKey.value(),
        modelName: getModelName(),
        systemPrompt: GRADER_SYSTEM_PROMPT,
        userPrompt,
        schema: gradingResponseSchema,
      });

      response.status(200).json(grade);
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
