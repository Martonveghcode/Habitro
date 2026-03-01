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
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "./firebase";
import type { ErrorDocument, UserAnalyticsSummary } from "../types/firestore";
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
  return (snap.exists() ? (snap.data() as UserAnalyticsSummary) : null);
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
