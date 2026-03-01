import type { Timestamp } from "firebase/firestore";

import type { Difficulty, ErrorCategory, ErrorSeverity, SentenceType } from "./syntax";

export interface ErrorDocument {
  uid: string;
  createdAt: Timestamp;
  sentenceType: SentenceType;
  difficulty: Difficulty;
  error_code: string;
  category: ErrorCategory;
  expected: string | null;
  got: string | null;
  spanStart: number;
  spanEnd: number;
  severity: ErrorSeverity;
}

export interface UserAnalyticsSummary {
  updatedAt: Timestamp;
  totalErrors: number;
  errorsByCode: Record<string, number>;
  errorsByCategory: {
    pos: number;
    function: number;
    grouping: number;
    sentenceType: number;
    punctuation: number;
  };
  errorsByDifficulty: {
    1: number;
    2: number;
    3: number;
  };
  last30dCount: number;
}
