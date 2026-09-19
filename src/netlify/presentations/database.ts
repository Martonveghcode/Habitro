import { z } from "zod";
import { CARDS, cardById, emptyDatabase, selectCards, type Database } from "./engine";

const finiteTime = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER);
const cardId = z.string().refine(id => CARDS.some(card => card.id === id), "Unknown activity");
const preferences = z.object({
  classes: z.array(z.number().int().min(2).max(4)).max(3),
  lengths: z.array(z.enum(["short", "medium", "long"])).max(3),
  minutes: z.number().int().min(5).max(480), order: z.enum(["normal", "random"]),
}).strict();
const session = z.object({
  id: z.string().min(1).max(100), startedAt: finiteTime, endedAt: finiteTime.nullable(), preferences,
  elapsedMs: finiteTime, completed: z.number().int().nonnegative(),
  queue: z.array(z.object({ cardId, dueMs: finiteTime, afterTurn: z.number().int().nonnegative(), wrong: z.boolean(), retired: z.boolean(), seen: z.number().int().nonnegative(), streak: z.number().int().nonnegative() }).strict()).min(1).max(25),
  current: z.object({ cardId, revealed: z.boolean(), recallMs: finiteTime, checkMs: finiteTime }).strict().nullable(),
  paused: z.boolean(), reason: z.enum(["time", "mastered", "gap", "stopped"]).nullable(),
}).strict().refine(s => {
  const ids = s.queue.map(q => q.cardId);
  const selected = selectCards(s.preferences).map(c => c.id);
  return new Set(ids).size === ids.length && ids.length === selected.length && ids.every(id => selected.includes(id))
    && (s.reason ? s.current === null && s.endedAt !== null : s.current !== null && ids.includes(s.current.cardId) && s.endedAt === null)
    && s.queue.reduce((sum, q) => sum + q.seen, 0) === s.completed;
}, "Invalid session queue");
const review = z.object({
  id: z.string().min(1).max(100), sessionId: z.string().min(1).max(100), cardId,
  classId: z.number().int().min(2).max(4), words: z.number().int().positive(), characters: z.number().int().positive(),
  rating: z.enum(["wrong", "hard", "medium", "easy"]), recallMs: finiteTime, checkMs: finiteTime, at: finiteTime,
  repetition: z.number().int().positive(),
}).strict().refine(r => { const card = cardById(r.cardId); return card && r.classId === card.classId && r.words === card.words && r.characters === card.characters; }, "Activity metadata mismatch");
const schema = z.object({ version: z.literal(1), preferences, reviews: z.array(review), sessions: z.array(session), active: session.nullable() }).strict()
  .refine(db => {
    const sessions = [...db.sessions, ...(db.active ? [db.active] : [])];
    const ids = sessions.map(s => s.id);
    return new Set(ids).size === ids.length && new Set(db.reviews.map(r => r.id)).size === db.reviews.length
      && db.sessions.every(s => s.reason !== null) && (!db.active || !db.active.reason)
      && db.reviews.every(r => ids.includes(r.sessionId))
      && sessions.every(s => db.reviews.filter(r => r.sessionId === s.id).length === s.completed);
  }, "Inconsistent study history");

export function validateDatabase(value: unknown): Database { return schema.parse(value); }
export function encodeBackup(data: Database): string {
  return JSON.stringify({ format: "habitro-catalan-presentations", exportedAt: new Date().toISOString(), data }, null, 2);
}
export function decodeBackup(text: string): Database {
  const envelope = z.object({ format: z.literal("habitro-catalan-presentations"), exportedAt: z.string(), data: schema }).strict().parse(JSON.parse(text));
  return envelope.data;
}

let connection: Promise<IDBDatabase> | null = null;
function openDatabase(): Promise<IDBDatabase> {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open("habitro-catalan-presentations", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("study");
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = null; }; resolve(request.result); };
    request.onerror = () => { connection = null; reject(request.error); };
    request.onblocked = () => { connection = null; reject(new Error("Close other Habitro tabs to open the database.")); };
  });
  return connection;
}
export async function loadDatabase(): Promise<Database> {
  const db = await openDatabase();
  const value = await new Promise<unknown>((resolve, reject) => {
    const request = db.transaction("study", "readonly").objectStore("study").get("data");
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  return value === undefined ? emptyDatabase() : validateDatabase(value);
}
export async function saveDatabase(data: Database): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("study", "readwrite");
    tx.objectStore("study").put(data, "data");
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}

// Restoring merges immutable attempts and completed sessions; newer progress wins for
// the same session. This makes repeated imports idempotent and avoids erasing history.
export function mergeBackup(current: Database, incoming: Database): Database {
  if (current.active) throw new Error("Finish the current session before restoring a backup.");
  const sessions = new Map(current.sessions.map(s => [s.id, s]));
  for (const s of [...incoming.sessions, ...(incoming.active ? [incoming.active] : [])]) {
    const existing = sessions.get(s.id);
    if (!existing || s.completed > existing.completed) sessions.set(s.id, s);
  }
  const reviewMap = new Map(current.reviews.map(r => [r.id, r]));
  for (const r of incoming.reviews) {
    const old = reviewMap.get(r.id);
    if (old && JSON.stringify(old) !== JSON.stringify(r)) throw new Error("Backup contains conflicting reviews.");
    reviewMap.set(r.id, r);
  }
  const active = [...sessions.values()].find(s => !s.reason) ?? null;
  if (active) active.paused = true;
  return validateDatabase({ version: 1, preferences: incoming.preferences,
    reviews: [...reviewMap.values()].sort((a, b) => a.at - b.at), sessions: [...sessions.values()].filter(s => s.reason), active });
}
