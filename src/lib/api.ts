import type { User } from "firebase/auth";
import { z } from "zod";

import type { GenerationRequest, GenerationResponse, GradeResult, UserAnalysisPayload } from "../types/syntax";

const baseUrlFromEnv = import.meta.env.VITE_FUNCTIONS_BASE_URL as string | undefined;
const FUNCTIONS_BASE_URL = baseUrlFromEnv?.replace(/\/$/, "") ?? "";

const generationResponseSchema = z.object({
  sentence: z.string(),
  tokens: z.array(z.string()),
  targetFeatures: z.array(z.string()).default([]),
  appliedPolicies: z.object({
    punctuationSimplified: z.boolean(),
  }),
});

const gradeResponseSchema = z.object({
  feedbackMarkdown: z.string(),
  correctedAnswerMarkdown: z.string(),
  reviewItems: z.array(
    z.object({
      status: z.enum(["correct", "incorrect"]),
      title: z.string(),
      detail: z.string(),
      spanStart: z.number().int().positive().optional(),
      spanEnd: z.number().int().positive().optional(),
    }),
  ),
  errors: z.array(
    z.object({
      error_code: z.string(),
      category: z.enum(["pos", "function", "grouping", "sentenceType", "punctuation"]),
      expected: z.string().nullable(),
      got: z.string().nullable(),
      spanStart: z.number().int().positive(),
      spanEnd: z.number().int().positive(),
      severity: z.enum(["minor", "major"]),
      explanation: z.string().optional(),
    }),
  ),
});

async function postWithAuth<T>(
  path: string,
  user: User,
  payload: unknown,
  schema: z.ZodSchema<T>,
): Promise<T> {
  if (!FUNCTIONS_BASE_URL) {
    throw new Error("Missing VITE_FUNCTIONS_BASE_URL in environment variables.");
  }

  const token = await user.getIdToken();
  const response = await fetch(`${FUNCTIONS_BASE_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  const json = (await response.json()) as unknown;
  return schema.parse(json);
}

export async function generateSentence(
  user: User,
  request: GenerationRequest,
): Promise<GenerationResponse> {
  return postWithAuth("generateSentence", user, request, generationResponseSchema);
}

export async function gradeAttempt(
  user: User,
  request: {
    sentence: string;
    tokens: string[];
    practiceSettings: {
      sentenceType: "simple" | "compuesta";
      difficulty: 1 | 2 | 3;
      focusTopics: string[];
      simplifyPunctuation: boolean;
    };
    analysis: UserAnalysisPayload;
  },
): Promise<GradeResult> {
  return postWithAuth("gradeAttempt", user, request, gradeResponseSchema);
}
