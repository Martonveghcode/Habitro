export type Difficulty = 1 | 2 | 3;

export type Mode = "normal" | "personalizado_mixto" | "personalizado_objetivo" | "foco_usuario";

export interface ModelOption {
  label: string;
  value: string;
}

export interface SummaryRow {
  label: string;
  ok: number;
  fail: number;
  attempts: number;
  failRate: number;
}

export interface PairSummaryRow {
  pair: string;
  ok: number;
  fail: number;
  attempts: number;
  failRate: number;
}

export interface SeItem {
  id: string;
  sentence: string;
  difficulty: Difficulty;
  seValue: string;
  seFunction: string;
  acceptedFunctions: string[];
  verbalStructure: string;
  periphrasisType: string;
  phraseType: string;
  explanation: string;
  mode: Mode;
}

export interface PeriphrasisItem {
  id: string;
  sentence: string;
  difficulty: Difficulty;
  verbalStructure: string;
  periphrasisType: string;
  phraseType: string;
  explanation: string;
  mode: Mode;
}

export interface MorfoItem {
  id: string;
  word: string;
  difficulty: Difficulty;
  wordType: string;
  lexeme: string;
  acceptedLexemes: string[];
  morphemes: string[];
  morphemeTypes: string[];
  analysisType: string;
  explanation: string;
  mode: Mode;
}

export interface SeAttempt {
  id: string;
  profileId: string;
  createdAt: string;
  difficulty: Difficulty;
  sentence: string;
  expectedValue: string;
  expectedFunction: string;
  expectedVerbalStructure: string;
  expectedPeriphrasisType: string;
  guessValue: string;
  guessFunction: string;
  guessVerbalStructure: string;
  guessPeriphrasisType: string;
  valueOk: boolean;
  functionOk: boolean;
  verbalStructureOk: boolean;
  periphrasisTypeOk: boolean;
  overallOk: boolean;
  phraseType: string;
  explanation: string;
  mode: Mode;
}

export interface PeriphrasisAttempt {
  id: string;
  profileId: string;
  createdAt: string;
  difficulty: Difficulty;
  sentence: string;
  expectedStructure: string;
  expectedPeriphrasisType: string;
  guessStructure: string;
  guessPeriphrasisType: string;
  structureOk: boolean;
  periphrasisTypeOk: boolean;
  overallOk: boolean;
  phraseType: string;
  explanation: string;
  mode: Mode;
}

export interface MorfoAttempt {
  id: string;
  profileId: string;
  createdAt: string;
  difficulty: Difficulty;
  word: string;
  expectedWordType: string;
  expectedLexeme: string;
  expectedLexemes: string[];
  expectedMorphemes: string[];
  expectedMorphemeTypes: string[];
  expectedPrimaryMorphemeType: string;
  guessWordType: string;
  guessLexeme: string;
  guessMorphemes: string[];
  guessMorphemeTypes: string[];
  wordTypeOk: boolean;
  lexemeOk: boolean;
  morphemesOk: boolean;
  morphemeTypesOk: boolean;
  overallOk: boolean;
  analysisType: string;
  explanation: string;
  mode: Mode;
}

export interface SeSettings {
  profileId: string;
  modelName: string;
  difficulty: Difficulty;
  personalized: boolean;
  batchSize: number;
  focusValues: string[];
  customValues: string[];
  customPeriphrasisTypes: string[];
  targetWeight: number;
  normalWeight: number;
  hideHistory: boolean;
}

export interface PeriphrasisSettings {
  profileId: string;
  modelName: string;
  difficulty: Difficulty;
  personalized: boolean;
  batchSize: number;
  focusStructures: string[];
  customPeriphrasisTypes: string[];
  targetWeight: number;
  normalWeight: number;
  hideHistory: boolean;
}

export interface MorfoSettings {
  profileId: string;
  modelName: string;
  difficulty: Difficulty;
  personalized: boolean;
  batchSize: number;
  focusWordTypes: string[];
  targetWeight: number;
  normalWeight: number;
  hideHistory: boolean;
}

export interface StorageState {
  version: 1;
  geminiApiKey: string;
  seSettings: SeSettings;
  periphrasisSettings: PeriphrasisSettings;
  morfoSettings: MorfoSettings;
  seAttempts: SeAttempt[];
  periphrasisAttempts: PeriphrasisAttempt[];
  morfoAttempts: MorfoAttempt[];
}

export interface SeProfile {
  totalAttempts: number;
  weakValues: SummaryRow[];
  strongValues: SummaryRow[];
  weakFunctions: SummaryRow[];
  strongFunctions: SummaryRow[];
  weakVerbalStructures: SummaryRow[];
  strongVerbalStructures: SummaryRow[];
  weakPeriphrasisTypes: SummaryRow[];
  strongPeriphrasisTypes: SummaryRow[];
  valueOverview: SummaryRow[];
  functionOverview: SummaryRow[];
  verbalStructureOverview: SummaryRow[];
  periphrasisTypeOverview: SummaryRow[];
  weakPairs: PairSummaryRow[];
}

export interface PeriphrasisProfile {
  totalAttempts: number;
  weakStructures: SummaryRow[];
  strongStructures: SummaryRow[];
  weakPeriphrasisTypes: SummaryRow[];
  strongPeriphrasisTypes: SummaryRow[];
  structureOverview: SummaryRow[];
  periphrasisTypeOverview: SummaryRow[];
  weakPairs: PairSummaryRow[];
}

export interface MorfoProfile {
  totalAttempts: number;
  weakWordTypes: SummaryRow[];
  strongWordTypes: SummaryRow[];
  weakMorphemeTypes: SummaryRow[];
  strongMorphemeTypes: SummaryRow[];
  wordTypeOverview: SummaryRow[];
  morphemeTypeOverview: SummaryRow[];
  weakPairs: PairSummaryRow[];
}

export interface SeStrategy {
  mode: Mode;
  targeted: boolean;
  focusValues: string[];
  requiredValue: string;
  targetValue: string;
  targetFunction: string;
  ratioHint: string;
}

export interface PeriphrasisStrategy {
  mode: Mode;
  targeted: boolean;
  focusStructures: string[];
  targetStructure: string;
  targetPeriphrasisType: string;
  ratioHint: string;
}

export interface MorfoStrategy {
  mode: Mode;
  targeted: boolean;
  focusWordTypes: string[];
  targetWordType: string;
  targetMorphemeType: string;
  ratioHint: string;
}

export interface SeEvaluation {
  guessValue: string;
  guessFunction: string;
  guessVerbalStructure: string;
  guessPeriphrasisType: string;
  valueOk: boolean;
  functionOk: boolean;
  verbalStructureOk: boolean;
  periphrasisTypeOk: boolean;
  overallOk: boolean;
}

export interface PeriphrasisEvaluation {
  guessStructure: string;
  guessPeriphrasisType: string;
  structureOk: boolean;
  periphrasisTypeOk: boolean;
  overallOk: boolean;
}

export interface MorfoEvaluation {
  guessWordType: string;
  guessLexeme: string;
  guessMorphemes: string[];
  guessMorphemeTypes: string[];
  wordTypeOk: boolean;
  lexemeOk: boolean;
  morphemesOk: boolean;
  morphemeTypesOk: boolean;
  overallOk: boolean;
}

export interface RecheckResultSe {
  success: boolean;
  model?: string;
  isCorrect?: boolean;
  correctedValue?: string;
  correctedFunction?: string;
  correctedVerbalStructure?: string;
  correctedPeriphrasisType?: string;
  issues?: string[];
  correctionNote?: string;
  error?: string;
}

export interface RecheckResultMorfo {
  success: boolean;
  model?: string;
  isCorrect?: boolean;
  correctedWordType?: string;
  correctedLexeme?: string;
  correctedMorphemes?: string[];
  correctedMorphemeTypes?: string[];
  issues?: string[];
  correctionNote?: string;
  error?: string;
}

export interface QuestionResult {
  success: boolean;
  model?: string;
  answer?: string;
  error?: string;
}
