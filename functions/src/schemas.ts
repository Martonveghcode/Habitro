import { z } from "zod";

export const errorCategorySchema = z.enum(["pos", "function", "grouping", "sentenceType", "punctuation"]);
export const errorSeveritySchema = z.enum(["minor", "major"]);
export const sentenceTypeSchema = z.enum(["simple", "compuesta"]);
export const difficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const generationRequestSchema = z.object({
  sentenceType: sentenceTypeSchema,
  difficulty: difficultySchema,
  focusTopics: z.array(z.string()).default([]),
  punctuationPolicy: z.object({
    simplify: z.boolean().default(true),
    excludeMarksFromLabeling: z.boolean().default(true),
  }),
  weaknessSummary: z.string().optional(),
});

export const generationResponseSchema = z.object({
  sentence: z.string().min(1),
  tokens: z.array(z.string().min(1)).min(1),
  targetFeatures: z.array(z.string()).default([]),
  appliedPolicies: z.object({
    punctuationSimplified: z.boolean(),
  }),
});

export const gradingRequestSchema = z.object({
  sentence: z.string().min(1),
  tokens: z.array(z.string().min(1)).min(1),
  practiceSettings: z.object({
    sentenceType: sentenceTypeSchema,
    difficulty: difficultySchema,
    focusTopics: z.array(z.string()).default([]),
    simplifyPunctuation: z.boolean(),
  }),
  analysis: z.unknown(),
});

export const graderErrorSchema = z.object({
  error_code: z.string().min(1),
  category: errorCategorySchema,
  expected: z.string().nullable(),
  got: z.string().nullable(),
  spanStart: z.number().int().positive(),
  spanEnd: z.number().int().positive(),
  severity: errorSeveritySchema,
  explanation: z.string().optional(),
});

export const reviewItemSchema = z.object({
  status: z.enum(["correct", "incorrect"]),
  title: z.string().min(1),
  detail: z.string().min(1),
  spanStart: z.number().int().positive().optional(),
  spanEnd: z.number().int().positive().optional(),
});

export const gradingResponseSchema = z.object({
  feedbackMarkdown: z.string().min(1),
  correctedAnswerMarkdown: z.string().min(1),
  reviewItems: z.array(reviewItemSchema).default([]),
  errors: z.array(graderErrorSchema),
  score: z
    .object({
      overall: z.number(),
      byCategory: z
        .object({
          pos: z.number().optional(),
          function: z.number().optional(),
          grouping: z.number().optional(),
          sentenceType: z.number().optional(),
          punctuation: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type GenerationResponse = z.infer<typeof generationResponseSchema>;
export type GradingRequest = z.infer<typeof gradingRequestSchema>;
export type GradingResponse = z.infer<typeof gradingResponseSchema>;
