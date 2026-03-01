export type SentenceType = "simple" | "compuesta";
export type Difficulty = 1 | 2 | 3;

export type PosTag =
  | "sustantivo"
  | "pronombre"
  | "verbo"
  | "adjetivo"
  | "adverbio"
  | "determinante"
  | "preposicion"
  | "conjuncion"
  | "interjeccion"
  | "otro";

export type AnnotationLevel = 1 | 2 | 3 | 4 | 5;
export type AnnotationKind = "wordFunction" | "groupFunction" | "clause" | "sentenceType";

export interface SentenceToken {
  index: number;
  text: string;
  normalized: string;
  isPunctuation: boolean;
}

export interface SpanRef {
  start: number;
  end: number;
}

export interface AnnotationNode {
  id: string;
  level: AnnotationLevel;
  kind: AnnotationKind;
  label: string;
  code?: string;
  span: SpanRef;
  parentId: string | null;
  childIds: string[];
  laneId: string;
  sourceRegion: "above_sentence" | "below_sentence";
  notes?: string;
}

export interface SentenceTypeBuild {
  id: string;
  tags: string[];
}

export interface UserAnalysisPayload {
  sentenceId: string;
  sentence: string;
  sentenceType: SentenceType;
  difficulty: Difficulty;
  focusTopics: string[];
  settings: {
    showPosRow: boolean;
    simplifyPunctuation: boolean;
    compactLayout: boolean;
  };
  tokens: SentenceToken[];
  tokenPosAssignments: Array<{ tokenIndex: number; pos: string }>;
  annotations: AnnotationNode[];
  sentenceTypeBuild: SentenceTypeBuild;
}

export type ErrorCategory = "pos" | "function" | "grouping" | "sentenceType" | "punctuation";
export type ErrorSeverity = "minor" | "major";

export interface GraderError {
  error_code: string;
  category: ErrorCategory;
  expected: string | null;
  got: string | null;
  spanStart: number;
  spanEnd: number;
  severity: ErrorSeverity;
  explanation?: string;
}

export interface GradeResult {
  feedbackMarkdown: string;
  errors: GraderError[];
  score?: {
    overall: number;
    byCategory: Partial<Record<ErrorCategory, number>>;
  };
}

export interface GenerationRequest {
  sentenceType: SentenceType;
  difficulty: Difficulty;
  focusTopics: string[];
  punctuationPolicy: {
    simplify: boolean;
    excludeMarksFromLabeling: boolean;
  };
  weaknessSummary?: string;
}

export interface GenerationResponse {
  sentence: string;
  tokens: string[];
  targetFeatures: string[];
  appliedPolicies: {
    punctuationSimplified: boolean;
  };
}
