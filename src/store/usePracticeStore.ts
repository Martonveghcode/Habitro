import { create } from "zustand";

import type {
  AnnotationKind,
  AnnotationLevel,
  AnnotationNode,
  GradeResult,
  SentenceToken,
  SentenceTypeBuild,
} from "../types/syntax";

interface PracticeSettingsState {
  sentenceType: "simple" | "compuesta";
  difficulty: 1 | 2 | 3;
  focusTopics: string[];
  showPosRow: boolean;
  simplifyPunctuation: boolean;
  compactLayout: boolean;
  personalizedMode: boolean;
}

interface SentenceState {
  sentenceId: string | null;
  sentence: string;
  tokens: SentenceToken[];
  targetFeatures: string[];
}

export interface SpanSelection {
  start: number;
  end: number;
}

interface PracticeStore {
  settings: PracticeSettingsState;
  customFocusTopics: string[];
  customAnnotationLabels: Record<AnnotationKind, string[]>;
  sentenceState: SentenceState;
  tokenPosAssignments: Array<{ tokenIndex: number; pos: string }>;
  annotations: AnnotationNode[];
  selectedSpan: SpanSelection | null;
  annotationDraft: {
    label: string;
    kind: AnnotationKind;
    level: AnnotationLevel;
  };
  sentenceTypeBuild: SentenceTypeBuild;
  gradeResult: GradeResult | null;
  isGenerating: boolean;
  isGrading: boolean;
  errorMessage: string | null;
  setSetting: <K extends keyof PracticeSettingsState>(key: K, value: PracticeSettingsState[K]) => void;
  setFocusTopics: (topics: string[]) => void;
  setCustomFocusTopics: (topics: string[]) => void;
  setCustomAnnotationLabels: (labels: Record<AnnotationKind, string[]>) => void;
  addCustomAnnotationLabel: (kind: AnnotationKind, label: string) => void;
  setSentenceData: (payload: { sentenceId: string; sentence: string; tokens: SentenceToken[]; targetFeatures: string[] }) => void;
  clearSentence: () => void;
  setSelectedSpan: (span: SpanSelection | null) => void;
  setAnnotationDraft: (draft: Partial<PracticeStore["annotationDraft"]>) => void;
  addAnnotationToLane: (laneId: string) => void;
  moveAnnotation: (annotationId: string, laneId: string) => void;
  deleteAnnotation: (annotationId: string) => void;
  setTokenPos: (tokenIndex: number, pos: string) => void;
  setSentenceTypeTags: (tags: string[]) => void;
  setGradeResult: (result: GradeResult | null) => void;
  setGenerating: (state: boolean) => void;
  setGrading: (state: boolean) => void;
  setErrorMessage: (message: string | null) => void;
}

const defaultSettings: PracticeSettingsState = {
  sentenceType: "simple",
  difficulty: 1,
  focusTopics: ["CD", "CI"],
  showPosRow: true,
  simplifyPunctuation: true,
  compactLayout: false,
  personalizedMode: false,
};

const defaultSentenceTypeBuild: SentenceTypeBuild = {
  id: "sentence_type_builder",
  tags: ["oracion simple", "predicativa"],
};

const lanePrefix = "lane";
const laneDraftPreset: Record<string, { kind: AnnotationKind; level: AnnotationLevel }> = {
  "lane-1": { kind: "wordFunction", level: 1 },
  "lane-2": { kind: "groupFunction", level: 2 },
  "lane-3": { kind: "groupFunction", level: 3 },
  "lane-4": { kind: "clause", level: 4 },
  "lane-5": { kind: "sentenceType", level: 5 },
};

export const usePracticeStore = create<PracticeStore>((set, get) => ({
  settings: defaultSettings,
  customFocusTopics: [],
  customAnnotationLabels: {
    wordFunction: [],
    groupFunction: [],
    clause: [],
    sentenceType: [],
  },
  sentenceState: {
    sentenceId: null,
    sentence: "",
    tokens: [],
    targetFeatures: [],
  },
  tokenPosAssignments: [],
  annotations: [],
  selectedSpan: null,
  annotationDraft: {
    label: "",
    kind: "groupFunction",
    level: 2,
  },
  sentenceTypeBuild: defaultSentenceTypeBuild,
  gradeResult: null,
  isGenerating: false,
  isGrading: false,
  errorMessage: null,
  setSetting: (key, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        [key]: value,
      },
    })),
  setFocusTopics: (topics) =>
    set((state) => ({
      settings: {
        ...state.settings,
        focusTopics: topics,
      },
    })),
  setCustomFocusTopics: (topics) => set({ customFocusTopics: topics }),
  setCustomAnnotationLabels: (labels) => set({ customAnnotationLabels: labels }),
  addCustomAnnotationLabel: (kind, label) =>
    set((state) => {
      const cleaned = label.trim();
      if (!cleaned) {
        return state;
      }
      const exists = state.customAnnotationLabels[kind].some(
        (entry) => entry.trim().toLowerCase() === cleaned.toLowerCase(),
      );
      if (exists) {
        return state;
      }
      return {
        customAnnotationLabels: {
          ...state.customAnnotationLabels,
          [kind]: [...state.customAnnotationLabels[kind], cleaned],
        },
      };
    }),
  setSentenceData: ({ sentenceId, sentence, tokens, targetFeatures }) =>
    set({
      sentenceState: { sentenceId, sentence, tokens, targetFeatures },
      tokenPosAssignments: [],
      annotations: [],
      selectedSpan: null,
      gradeResult: null,
      errorMessage: null,
    }),
  clearSentence: () =>
    set({
      sentenceState: {
        sentenceId: null,
        sentence: "",
        tokens: [],
        targetFeatures: [],
      },
      tokenPosAssignments: [],
      annotations: [],
      selectedSpan: null,
      gradeResult: null,
    }),
  setSelectedSpan: (span) => set({ selectedSpan: span }),
  setAnnotationDraft: (draft) =>
    set((state) => ({
      annotationDraft: {
        ...state.annotationDraft,
        ...draft,
      },
    })),
  addAnnotationToLane: (laneId) => {
    const { selectedSpan, annotationDraft, annotations } = get();
    if (!selectedSpan || !annotationDraft.label.trim()) {
      return;
    }

    const lanePreset = laneDraftPreset[laneId] ?? {
      kind: annotationDraft.kind,
      level: annotationDraft.level,
    };

    const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const node: AnnotationNode = {
      id,
      level: lanePreset.level,
      kind: lanePreset.kind,
      label: annotationDraft.label.trim(),
      span: { ...selectedSpan },
      parentId: null,
      childIds: [],
      laneId,
      sourceRegion: laneId.startsWith(lanePrefix) ? "below_sentence" : "above_sentence",
    };

    set({
      annotations: [...annotations, node],
      selectedSpan: null,
      annotationDraft: {
        ...annotationDraft,
        label: "",
      },
    });
  },
  moveAnnotation: (annotationId, laneId) =>
    set((state) => ({
      annotations: state.annotations.map((annotation) =>
        annotation.id === annotationId
          ? {
              ...annotation,
              laneId,
              sourceRegion: laneId.startsWith(lanePrefix) ? "below_sentence" : "above_sentence",
            }
          : annotation,
      ),
    })),
  deleteAnnotation: (annotationId) =>
    set((state) => ({
      annotations: state.annotations.filter((annotation) => annotation.id !== annotationId),
    })),
  setTokenPos: (tokenIndex, pos) =>
    set((state) => {
      const next = [...state.tokenPosAssignments];
      const existing = next.find((entry) => entry.tokenIndex === tokenIndex);
      if (existing) {
        existing.pos = pos;
      } else {
        next.push({ tokenIndex, pos });
      }
      return { tokenPosAssignments: next };
    }),
  setSentenceTypeTags: (tags) =>
    set((state) => ({
      sentenceTypeBuild: {
        ...state.sentenceTypeBuild,
        tags,
      },
    })),
  setGradeResult: (result) => set({ gradeResult: result }),
  setGenerating: (state) => set({ isGenerating: state }),
  setGrading: (state) => set({ isGrading: state }),
  setErrorMessage: (message) => set({ errorMessage: message }),
}));

export const TRACK_IDS = ["lane-1", "lane-2", "lane-3", "lane-4", "lane-5"] as const;
