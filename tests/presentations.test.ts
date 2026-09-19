import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { CARDS, CLASSES, DEFAULT_PREFERENCES, cardById, createSession, emptyDatabase, finishSession, predictMs, reviewSession, selectCards, tickSession, type Rating, type Review, type Session } from "../src/netlify/presentations/engine";
import { decodeBackup, encodeBackup, mergeBackup, validateDatabase } from "../src/netlify/presentations/database";

const reveal = (s: Session) => ({ ...s, current: { ...s.current!, revealed: true } });
function rate(s: Session, rating: Rating, history: Review[] = []) { return reviewSession(reveal(tickSession(s, 4000)), rating, history, 1000); }
test("all 25 source questions and answers are preserved verbatim", () => {
  assert.equal(CARDS.length, 25);
  for (const c of CLASSES) {
    const bytes = readFileSync(`public${c.source}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), c.sha256);
    const text = bytes.toString("utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    const entries = [...text.matchAll(/^Class (\d+), act (\d+): (.+)$/gm)];
    entries.forEach((entry, i) => {
      const card = cardById(`c${entry[1]}-a${entry[2]}`);
      assert.equal(card.question, entry[3]);
      assert.equal(card.answer, text.slice(entry.index! + entry[0].length, entries[i + 1]?.index ?? text.length).trim());
      assert.equal(card.blocks.map(b => b.text).join(" "), card.answer.replace(/\s+/g, " "));
    });
    assert.equal(readFileSync(`public${c.pdf}`).subarray(0, 5).toString(), "%PDF-");
  }
});
test("filters use only answer length and support all class/length combinations", () => {
  for (const card of CARDS) {
    assert.equal(card.words, card.answer.split(/\s+/).length);
    assert.equal(card.length, card.words <= 30 ? "short" : card.words <= 75 ? "medium" : "long");
  }
  assert.equal(selectCards({ ...DEFAULT_PREFERENCES, classes: [4], lengths: ["short"] }).length, 0);
  assert.equal(selectCards({ ...DEFAULT_PREFERENCES, classes: [2, 3], lengths: ["short", "medium"] }).length, 17);
  assert.throws(() => createSession({ ...DEFAULT_PREFERENCES, classes: [] }));
  assert.throws(() => createSession({ ...DEFAULT_PREFERENCES, minutes: 0 }));
});
test("normal order follows classes and activities; random order shuffles without losing cards", () => {
  const normal = createSession(DEFAULT_PREFERENCES);
  assert.deepEqual(normal.queue.map(q => q.cardId), CARDS.map(c => c.id));
  const random = createSession({ ...DEFAULT_PREFERENCES, order: "random" }, 0, () => .3);
  assert.notDeepEqual(normal.queue, random.queue);
  assert.deepEqual(random.queue.map(q => q.cardId).sort(), normal.queue.map(q => q.cardId).sort());
});
test("Wrong returns after exactly one intervening question, including consecutive failures", () => {
  const first = createSession(DEFAULT_PREFERENCES);
  const a = first.current!.cardId;
  const second = rate(first, "wrong").session;
  const b = second.current!.cardId;
  assert.notEqual(a, b);
  const third = rate(second, "wrong").session;
  assert.equal(third.current!.cardId, a);
  const fourth = rate(third, "medium").session;
  assert.equal(fourth.current!.cardId, b);
});
test("Easy retires cards for this session; a new session includes them again", () => {
  let s = createSession(DEFAULT_PREFERENCES);
  const seen = new Set<string>();
  while (!s.reason) { assert.ok(!seen.has(s.current!.cardId)); seen.add(s.current!.cardId); s = rate(s, "easy").session; }
  assert.equal(seen.size, 25); assert.equal(s.reason, "mastered");
  assert.equal(createSession(DEFAULT_PREFERENCES).queue.filter(q => q.retired).length, 0);
});
test("single-card deck finishes honestly instead of breaking the mandatory gap", () => {
  const s = createSession({ ...DEFAULT_PREFERENCES, classes: [2], lengths: ["long"] });
  assert.equal(rate(s, "wrong").session.reason, "gap");
});
test("no consecutive repeat, no Easy resurfacing, even in a small deck", () => {
  let s = createSession({ ...DEFAULT_PREFERENCES, classes: [4], lengths: ["long"] });
  const retired = s.current!.cardId;
  s = rate(s, "easy").session;
  for (let i = 0; i < 80; i++) {
    const previous = s.current!.cardId;
    s = rate(s, i % 3 === 0 ? "wrong" : "medium").session;
    assert.notEqual(s.current?.cardId, retired); assert.notEqual(s.current?.cardId, previous);
  }
});
test("Hard/Medium intervals grow with horizon; Medium spaces further than Hard", () => {
  const delay = (minutes: number, rating: Rating) => {
    const s = rate(createSession({ ...DEFAULT_PREFERENCES, minutes }), rating).session;
    return s.queue[0].dueMs - s.elapsedMs;
  };
  assert.ok(delay(60, "hard") > delay(30, "hard"));
  assert.ok(delay(90, "medium") > delay(60, "medium"));
  assert.ok(delay(60, "medium") > delay(60, "hard"));
});
test("reviews remain inside remaining horizon; a card in progress can finish after expiry", () => {
  let s = createSession(DEFAULT_PREFERENCES); s.elapsedMs = 3590000;
  const r = rate(s, "medium").session;
  assert.ok(r.queue[0].dueMs <= 3600000);
  s.elapsedMs = 3600001;
  assert.equal(rate(s, "medium").session.reason, "time");
});
test("recall freezes at reveal, checking is separate, pauses and sleep do not inflate timing", () => {
  let s = tickSession(createSession(DEFAULT_PREFERENCES), 3000);
  s = tickSession(reveal(s), 2000);
  assert.equal(s.current!.recallMs, 3000); assert.equal(s.current!.checkMs, 2000);
  assert.deepEqual(tickSession({ ...s, paused: true }, 100000), { ...s, paused: true });
  assert.equal(tickSession(s, 100000).elapsedMs, 10000);
  assert.throws(() => reviewSession(createSession(DEFAULT_PREFERENCES), "hard", []));
});
test("100 observations learn non-linear length timing and class/card differences", () => {
  const history: Review[] = [];
  for (let i = 0; i < 100; i++) {
    const c = CARDS[i % CARDS.length];
    history.push({ id: String(i), sessionId: "sample", cardId: c.id, classId: c.classId, words: c.words, characters: c.characters,
      rating: "medium", recallMs: 15000 + Math.pow(c.words, 1.3) * 1300, checkMs: 3000 + c.words * 120, at: i, repetition: 1 });
  }
  const long = cardById("c2-a13"), short = cardById("c2-a1");
  assert.ok(predictMs(long, history) > predictMs(long, []) * 1.4);
  assert.ok(predictMs(long, history) > predictMs(short, history) * 4);
  assert.ok(predictMs(long, history, "checkMs") < predictMs(long, history));
  assert.ok(Number.isFinite(predictMs(long, [{ ...history[0], recallMs: Infinity }])));
});
test("backups validate, round-trip and restore idempotently without dropping existing history", () => {
  const db = emptyDatabase();
  const result = rate(createSession(DEFAULT_PREFERENCES), "wrong");
  db.active = result.session; db.reviews = [result.review];
  const restored = decodeBackup(encodeBackup(db));
  assert.deepEqual(restored, db);
  const merged = mergeBackup(emptyDatabase(), restored);
  assert.equal(merged.active!.paused, true);
  merged.sessions.push(finishSession(merged.active!, "stopped")); merged.active = null;
  const again = mergeBackup(merged, restored);
  assert.equal(again.reviews.length, 1); assert.equal(again.sessions.length, 1); assert.equal(again.active, null);
  assert.throws(() => mergeBackup(db, restored));
});
test("malformed or inconsistent backups are rejected before any write", () => {
  const db = emptyDatabase();
  assert.throws(() => decodeBackup('{"format":"other"}'));
  assert.throws(() => validateDatabase({ ...db, version: 2 }));
  assert.throws(() => validateDatabase({ ...db, preferences: { ...db.preferences, minutes: NaN } }));
  const s = createSession(DEFAULT_PREFERENCES);
  assert.throws(() => validateDatabase({ ...db, active: { ...s, queue: [s.queue[0], s.queue[0]] } }));
  assert.throws(() => validateDatabase({ ...db, active: { ...s, completed: 3 } }));
});
