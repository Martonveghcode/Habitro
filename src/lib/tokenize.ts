import type { SentenceToken } from "../types/syntax";

const punctuationPattern = /^[,.;:!?()\u00bf\u00a1]+$/;

export function toSentenceTokens(rawTokens: string[]): SentenceToken[] {
  return rawTokens.map((text, index) => ({
    index: index + 1,
    text,
    normalized: text.toLowerCase(),
    isPunctuation: punctuationPattern.test(text),
  }));
}

export function tokenizeFallback(sentence: string): string[] {
  return (
    sentence
      .match(/\w+|[^\s\w]/g)
      ?.filter(Boolean)
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}
