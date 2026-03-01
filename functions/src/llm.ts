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

async function requestText(model: GenerativeModel, systemPrompt: string, userPrompt: string): Promise<string> {
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4,
    },
    systemInstruction: {
      role: "system",
      parts: [{ text: systemPrompt }],
    },
  });

  return result.response.text();
}

export async function requestStrictJson<T>(input: {
  apiKey: string;
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodSchema<T>;
}): Promise<T> {
  const client = new GoogleGenerativeAI(input.apiKey);
  const model = client.getGenerativeModel({ model: input.modelName });
  const firstText = await requestText(model, input.systemPrompt, input.userPrompt);

  try {
    return await parseAndValidate(firstText, input.schema);
  } catch {
    const repairPrompt = [
      "Reescribe la salida estrictamente como JSON valido, sin markdown.",
      "No agregues comentarios.",
      "Salida original:",
      firstText,
    ].join("\n");

    const repairedText = await requestText(model, input.systemPrompt, repairPrompt);
    return parseAndValidate(repairedText, input.schema);
  }
}
