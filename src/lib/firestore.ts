import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "./firebase";
import type { ErrorDocument, PracticePreferences, UserAnalyticsSummary } from "../types/firestore";
import type { AnnotationKind } from "../types/syntax";
import type { GraderError, SentenceType } from "../types/syntax";

export async function saveError(
  user: User,
  data: {
    sentenceType: SentenceType;
    difficulty: 1 | 2 | 3;
    error: GraderError;
  },
): Promise<void> {
  await addDoc(collection(db, "errors"), {
    uid: user.uid,
    createdAt: serverTimestamp(),
    sentenceType: data.sentenceType,
    difficulty: data.difficulty,
    error_code: data.error.error_code,
    category: data.error.category,
    expected: data.error.expected,
    got: data.error.got,
    spanStart: data.error.spanStart,
    spanEnd: data.error.spanEnd,
    severity: data.error.severity,
  });
}

export async function saveErrors(user: User, sentenceType: SentenceType, difficulty: 1 | 2 | 3, errors: GraderError[]) {
  await Promise.all(
    errors.map((error) =>
      saveError(user, {
        sentenceType,
        difficulty,
        error,
      }),
    ),
  );
}

export async function readAnalyticsSummary(user: User): Promise<UserAnalyticsSummary | null> {
  const ref = doc(db, "users", user.uid, "analytics", "summary");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return null;
  }

  const raw = snap.data() as Partial<UserAnalyticsSummary>;
  return {
    ...(raw as UserAnalyticsSummary),
    totalErrors: raw.totalErrors ?? 0,
    errorsByCode: raw.errorsByCode ?? {},
    errorsByCategory: {
      pos: raw.errorsByCategory?.pos ?? 0,
      function: raw.errorsByCategory?.function ?? 0,
      grouping: raw.errorsByCategory?.grouping ?? 0,
      sentenceType: raw.errorsByCategory?.sentenceType ?? 0,
      punctuation: raw.errorsByCategory?.punctuation ?? 0,
    },
    errorsByDifficulty: {
      1: raw.errorsByDifficulty?.[1] ?? 0,
      2: raw.errorsByDifficulty?.[2] ?? 0,
      3: raw.errorsByDifficulty?.[3] ?? 0,
    },
    last30dCount: raw.last30dCount ?? 0,
  };
}

export async function getLastErrors(user: User, size = 20): Promise<Array<ErrorDocument & { id: string }>> {
  const q = query(
    collection(db, "errors"),
    where("uid", "==", user.uid),
    orderBy("createdAt", "desc"),
    limit(size),
  );
  const snap = await getDocs(q);
  return snap.docs.map((docItem) => ({ id: docItem.id, ...(docItem.data() as ErrorDocument) }));
}

export async function readPracticePreferences(user: User): Promise<PracticePreferences | null> {
  const ref = doc(db, "users", user.uid, "preferences", "practice");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return null;
  }

  const raw = snap.data() as Partial<PracticePreferences>;
  const customAnnotationLabelsRaw = raw.customAnnotationLabels as Partial<Record<AnnotationKind, unknown>> | undefined;

  const parseLabelList = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

  return {
    ...(raw as PracticePreferences),
    customFocusTopics: Array.isArray(raw.customFocusTopics)
      ? raw.customFocusTopics.filter((entry): entry is string => typeof entry === "string")
      : [],
    selectedFocusTopics: Array.isArray(raw.selectedFocusTopics)
      ? raw.selectedFocusTopics.filter((entry): entry is string => typeof entry === "string")
      : [],
    customAnnotationLabels: {
      wordFunction: parseLabelList(customAnnotationLabelsRaw?.wordFunction),
      groupFunction: parseLabelList(customAnnotationLabelsRaw?.groupFunction),
      clause: parseLabelList(customAnnotationLabelsRaw?.clause),
      sentenceType: parseLabelList(customAnnotationLabelsRaw?.sentenceType),
    },
  };
}

export async function savePracticePreferences(
  user: User,
  payload: {
    customFocusTopics: string[];
    selectedFocusTopics: string[];
    customAnnotationLabels: Record<AnnotationKind, string[]>;
  },
): Promise<void> {
  const ref = doc(db, "users", user.uid, "preferences", "practice");
  await setDoc(
    ref,
    {
      updatedAt: serverTimestamp(),
      customFocusTopics: payload.customFocusTopics,
      selectedFocusTopics: payload.selectedFocusTopics,
      customAnnotationLabels: payload.customAnnotationLabels,
    },
    { merge: true },
  );
}
