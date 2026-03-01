import type { SentenceToken } from "../types/syntax";

const punctuationPattern = /^[,.;:!?()¿¡]+$/;

export function toSentenceTokens(rawTokens: string[]): SentenceToken[] {
  return rawTokens.map((text, index) => ({
    index,
    text,
    normalized: text.toLowerCase(),
    isPunctuation: punctuationPattern.test(text),
  }));
}

export function tokenizeFallback(sentence: string): string[] {
  return sentence
    .match(/\w+|[^\s\w]/g)
    ?.filter(Boolean)
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}
