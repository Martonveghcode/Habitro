import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { z } from "zod";

function extractJsonCandidate(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const objectMatch = text.match(/\{[\s\S]*\}$/);
  if (objectMatch?.[0]) {
    return objectMatch[0].trim();
  }
  throw new Error("Model response did not contain JSON.");
}

async function parseAndValidate<T>(text: string, schema: z.ZodSchema<T>): Promise<T> {
  const candidate = extractJsonCandidate(text);
  const parsed = JSON.parse(candidate) as unknown;
  return schema.parseAsync(parsed);
}

async function requestText(
  model: GenerativeModel,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
): Promise<string> {
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature,
    },
    systemInstruction: {
      role: "system",
      parts: [{ text: systemPrompt }],
    },
  });

  return result.response.text();
}

function isMissingModelError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return normalized.includes("404") && normalized.includes("model") && normalized.includes("not found");
}

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("429") ||
    normalized.includes("too many requests") ||
    normalized.includes("quota exceeded") ||
    normalized.includes("rate limit")
  );
}

async function requestAndValidateWithModel<T>(input: {
  client: GoogleGenerativeAI;
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
  temperature: number;
}): Promise<T> {
  const model = input.client.getGenerativeModel({ model: input.modelName });
  const firstText = await requestText(model, input.systemPrompt, input.userPrompt, input.temperature);

  try {
    return await parseAndValidate(firstText, input.schema);
  } catch {
    const repairPrompt = [
      "Reescribe la salida estrictamente como JSON valido, sin markdown.",
      "No agregues comentarios.",
      "Salida original:",
      firstText,
    ].join("\n");

    const repairedText = await requestText(model, input.systemPrompt, repairPrompt, input.temperature);
    return parseAndValidate(repairedText, input.schema);
  }
}

export async function requestStrictJson<T>(input: {
  apiKey: string;
  modelNames: string[];
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
  temperature?: number;
}): Promise<T> {
  const client = new GoogleGenerativeAI(input.apiKey);
  const uniqueModelNames = Array.from(new Set(input.modelNames.map((name) => name.trim()).filter(Boolean)));
  if (uniqueModelNames.length === 0) {
    throw new Error("No Gemini model names were provided.");
  }

  let lastError: unknown = null;
  for (const modelName of uniqueModelNames) {
    try {
      return await requestAndValidateWithModel({
        client,
        modelName,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        schema: input.schema,
        temperature: input.temperature ?? 0.25,
      });
    } catch (error) {
      lastError = error;
      if (!isMissingModelError(error) && !isQuotaError(error)) {
        throw error;
      }
      console.warn(`Gemini model failed, trying fallback model: ${modelName}`);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All Gemini model fallbacks failed.");
}
