import content from "./content.json";

export type Length = "short" | "medium" | "long";
export type Rating = "wrong" | "hard" | "medium" | "easy";
export interface Card {
  id: string; classId: number; activity: number; question: string; answer: string;
  blocks: { kind: string; text: string }[]; words: number; characters: number; length: Length; page: number;
}
export const CARDS = content.cards as Card[];
export const CLASSES = content.classes;
export const LENGTHS: Length[] = ["short", "medium", "long"];
export const RATINGS: Rating[] = ["wrong", "hard", "medium", "easy"];
export const cardById = (id: string) => CARDS.find(card => card.id === id)!;
export interface Preferences { classes: number[]; lengths: Length[]; minutes: number; order: "normal" | "random" }
export const DEFAULT_PREFERENCES: Preferences = { classes: [2, 3, 4], lengths: [...LENGTHS], minutes: 60, order: "normal" };
export interface Review {
  id: string; sessionId: string; cardId: string; classId: number; words: number; characters: number;
  rating: Rating; recallMs: number; checkMs: number; at: number; repetition: number;
}
export interface QueueItem {
  cardId: string; dueMs: number; afterTurn: number; wrong: boolean; retired: boolean; seen: number; streak: number;
}
export interface Session {
  id: string; startedAt: number; endedAt: number | null; preferences: Preferences;
  elapsedMs: number; completed: number; queue: QueueItem[];
  current: { cardId: string; revealed: boolean; recallMs: number; checkMs: number } | null;
  paused: boolean; reason: "time" | "mastered" | "gap" | "stopped" | null;
}
export interface Database {
  version: 1; preferences: Preferences; reviews: Review[]; sessions: Session[]; active: Session | null;
}
export const emptyDatabase = (): Database => ({ version: 1, preferences: { ...DEFAULT_PREFERENCES }, reviews: [], sessions: [], active: null });
export const selectCards = (preferences: Preferences) => CARDS.filter(card => preferences.classes.includes(card.classId) && preferences.lengths.includes(card.length));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const uid = () => crypto.randomUUID();

// A regularized power-law fit learns non-linear writing time from answer length.
// Similar character density and same-class examples receive greater weight.
// Per-card evidence is blended in gradually, so a single fast/slow attempt cannot dominate.
export function predictMs(card: Card, reviews: Review[], phase: "recallMs" | "checkMs" = "recallMs"): number {
  const prior = phase === "recallMs" ? 12000 + card.words * 2400 : 4000 + card.words * 350;
  const samples = reviews.filter(r => r[phase] >= (phase === "recallMs" ? 3000 : 1000) && r[phase] <= 1800000).slice(-2000);
  if (!samples.length) return prior;
  const x0 = Math.log1p(card.words);
  let sw = 4, sx = 4 * x0, sy = 4 * Math.log(prior), sxx = 4 * x0 * x0 + 2, sxy = 4 * x0 * Math.log(prior) + 2 * .8;
  const exact: number[] = [];
  samples.forEach((r, index) => {
    const x = Math.log1p(r.words);
    const density = r.characters / Math.max(1, r.words);
    const similarity = 1 / (1 + Math.abs(density - card.characters / Math.max(1, card.words)));
    const weight = (r.classId === card.classId ? 1.5 : 1) * similarity * Math.pow(.998, samples.length - index - 1);
    // Winsorize extreme observations relative to a deliberately broad length-based prior.
    const base = phase === "recallMs" ? 12000 + r.words * 2400 : 4000 + r.words * 350;
    const y = Math.log(clamp(r[phase], base * .08, base * 8));
    sw += weight; sx += weight * x; sy += weight * y; sxx += weight * x * x; sxy += weight * x * y;
    if (r.cardId === card.id) exact.push(y);
  });
  const slope = clamp((sxy - sx * sy / sw) / Math.max(.001, sxx - sx * sx / sw), 0, 2);
  const estimate = sy / sw + slope * (x0 - sx / sw);
  const recent = exact.slice(-20);
  const confidence = recent.length / (recent.length + 8);
  const local = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
  return clamp(Math.exp(estimate * (1 - confidence) + local * confidence), phase === "recallMs" ? 5000 : 2000, 1800000);
}

export function createSession(preferences: Preferences, now = Date.now(), random = Math.random): Session {
  const cards = selectCards(preferences);
  if (!cards.length) throw new Error("Select at least one activity.");
  if (!Number.isInteger(preferences.minutes) || preferences.minutes < 5 || preferences.minutes > 480) throw new Error("Choose between 5 and 480 minutes.");
  if (preferences.order === "random") {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }
  return {
    id: uid(), startedAt: now, endedAt: null, preferences: structuredClone(preferences), elapsedMs: 0, completed: 0,
    queue: cards.map(card => ({ cardId: card.id, dueMs: 0, afterTurn: 0, wrong: false, retired: false, seen: 0, streak: 0 })),
    current: { cardId: cards[0].id, revealed: false, recallMs: 0, checkMs: 0 }, paused: false, reason: null,
  };
}

export function tickSession(session: Session, deltaMs: number): Session {
  if (session.paused || session.reason || !session.current) return session;
  // Discard sleep/abnormally throttled timer gaps rather than learning them as writing.
  const delta = clamp(deltaMs, 0, 5000);
  const phase = session.current.revealed ? "checkMs" : "recallMs";
  return { ...session, elapsedMs: session.elapsedMs + delta, current: { ...session.current, [phase]: session.current[phase] + delta } };
}

export function finishSession(session: Session, reason: NonNullable<Session["reason"]>, now = Date.now()): Session {
  return { ...session, paused: true, endedAt: now, reason, current: null };
}

export function reviewSession(session: Session, rating: Rating, reviews: Review[], now = Date.now()): { session: Session; review: Review } {
  if (!session.current?.revealed || session.paused || session.reason) throw new Error("Reveal the answer before rating it.");
  const current = session.current;
  const card = cardById(current.cardId);
  const queue = session.queue.map(item => ({ ...item }));
  const item = queue.find(q => q.cardId === card.id)!;
  const review: Review = { id: uid(), sessionId: session.id, cardId: card.id, classId: card.classId, words: card.words, characters: card.characters,
    rating, recallMs: current.recallMs, checkMs: current.checkMs, at: now, repetition: item.seen + 1 };
  const completed = session.completed + 1;
  item.seen++; item.wrong = rating === "wrong"; item.retired = rating === "easy";
  item.streak = rating === "wrong" ? 0 : item.streak + 1;
  item.afterTurn = completed + 1; // Exactly one intervening completed question for Wrong.
  const evidence = [...reviews, review];
  const cost = predictMs(card, evidence) + predictMs(card, evidence, "checkMs");
  const remaining = Math.max(0, session.preferences.minutes * 60000 - session.elapsedMs);
  const past = evidence.filter(r => r.cardId === card.id).slice(-20);
  const recallRate = (past.filter(r => r.rating !== "wrong").length + 2) / (past.length + 4);
  // Exponential forgetting: R(t)=exp(-t/S). S is a session-scaled heuristic,
  // updated by self-reported recall, successful repetitions and measured task cost.
  const stability = session.preferences.minutes * 60000 * (rating === "hard" ? .45 : 1.15)
    * (.65 + recallRate * .7) * Math.min(1.8, 1 + (item.streak - 1) * .2);
  const interval = -stability * Math.log(rating === "hard" ? .8 : .75);
  const delay = Math.min(Math.max(cost, interval), Math.max(0, remaining - cost));
  item.dueMs = rating === "wrong" ? session.elapsedMs : session.elapsedMs + delay;
  const nextSession = { ...session, completed, queue };
  if (remaining <= 0) return { session: finishSession(nextSession, "time", now), review };
  const live = queue.filter(q => !q.retired);
  if (!live.length) return { session: finishSession(nextSession, "mastered", now), review };
  const eligible = live.filter(q => q.afterTurn <= completed && q.cardId !== current.cardId);
  // Never break the mandatory gap or bring an Easy card back to fill it.
  if (!eligible.length) return { session: finishSession(nextSession, "gap", now), review };
  const wrong = eligible.filter(q => q.wrong).sort((a, b) => a.afterTurn - b.afterTurn)[0];
  const due = eligible.filter(q => q.seen > 0 && q.dueMs <= session.elapsedMs).sort((a, b) => a.dueMs - b.dueMs)[0];
  const unseen = eligible.find(q => q.seen === 0);
  // If the deck is small, bring the earliest eligible review forward to keep practice continuous.
  const next = wrong ?? due ?? unseen ?? [...eligible].sort((a, b) => a.dueMs - b.dueMs)[0];
  return { session: { ...nextSession, current: { cardId: next.cardId, revealed: false, recallMs: 0, checkMs: 0 } }, review };
}
