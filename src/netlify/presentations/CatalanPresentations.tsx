import { useEffect, useRef, useState } from "react";
import { CARDS, CLASSES, LENGTHS, RATINGS, cardById, createSession, finishSession, predictMs, reviewSession, selectCards, tickSession, type Card, type Database, type Length, type Preferences, type Rating, type Review } from "./engine";
import { decodeBackup, encodeBackup, loadDatabase, mergeBackup, saveDatabase } from "./database";
import "./presentations.css";

const labels = { short: "Short", medium: "Medium", long: "Long", wrong: "Wrong", hard: "Hard", easy: "Easy" };
const ranges: Record<Length, string> = { short: "≤30 words", medium: "31–75 words", long: "76+ words" };
const duration = (ms: number) => { const seconds = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; };
const average = (rows: Review[], key: "recallMs" | "checkMs") => rows.length ? duration(rows.reduce((sum, r) => sum + r[key], 0) / rows.length) : "—";

function Answer({ card }: { card: Card }) {
  const elements = [];
  for (let i = 0; i < card.blocks.length; i++) {
    const block = card.blocks[i];
    if (block.kind === "li") {
      const items: { text: string; children: string[] }[] = [{ text: block.text, children: [] }];
      while (["li", "subli"].includes(card.blocks[i + 1]?.kind)) {
        const next = card.blocks[++i];
        if (next.kind === "subli") items[items.length - 1].children.push(next.text);
        else items.push({ text: next.text, children: [] });
      }
      elements.push(<ul key={i}>{items.map((item, index) => <li key={index}>{item.text}{item.children.length > 0 && <ul>{item.children.map((text, j) => <li key={j}>{text}</li>)}</ul>}</li>)}</ul>);
    } else if (block.kind === "heading") elements.push(<h3 key={i}>{block.text}</h3>);
    else elements.push(<p key={i}>{block.text}</p>);
  }
  return <div className="cp-answer" lang="ca">{elements}</div>;
}

function Statistics({ data }: { data: Database }) {
  const groups = [
    ...CLASSES.map(c => ({ label: `Class ${c.id}`, rows: data.reviews.filter(r => r.classId === c.id) })),
    ...LENGTHS.map(length => ({ label: labels[length], rows: data.reviews.filter(r => cardById(r.cardId).length === length) })),
  ];
  return <details className="cp-statistics">
    <summary>Statistics <span>{data.reviews.length} reviews · {data.sessions.length} finished sessions</span></summary>
    {data.reviews.length ? <>
      <div className="cp-table-wrap"><table><caption>Active time per review</caption><thead><tr><th>Group</th><th>Reviews</th><th>Recalled</th><th>Writing / recall</th><th>Checking</th></tr></thead><tbody>
        {groups.map(g => <tr key={g.label}><th>{g.label}</th><td>{g.rows.length}</td><td>{g.rows.length ? `${Math.round(100 * g.rows.filter(r => r.rating !== "wrong").length / g.rows.length)}%` : "—"}</td><td>{average(g.rows, "recallMs")}</td><td>{average(g.rows, "checkMs")}</td></tr>)}
      </tbody></table></div>
      <p className="cp-muted">Recalled is based on your ratings. Paused and hidden-tab time is excluded.</p>
      <details><summary>By activity</summary><div className="cp-table-wrap"><table><thead><tr><th>Activity</th><th>Answer words</th><th>Reviews</th><th>Avg. recall</th><th>Est. recall</th><th>Avg. check</th></tr></thead><tbody>
        {CARDS.map(card => { const rows = data.reviews.filter(r => r.cardId === card.id); return <tr key={card.id}><th>Class {card.classId}, act {card.activity}</th><td>{card.words}</td><td>{rows.length}</td><td>{average(rows, "recallMs")}</td><td>{duration(predictMs(card, data.reviews))}</td><td>{average(rows, "checkMs")}</td></tr>; })}
      </tbody></table></div></details>
      <details><summary>Recent reviews</summary><div className="cp-table-wrap"><table><thead><tr><th>Date</th><th>Activity</th><th>Rating</th><th>Recall</th><th>Check</th></tr></thead><tbody>
        {data.reviews.slice(-50).reverse().map(r => <tr key={r.id}><td>{new Date(r.at).toLocaleString()}</td><th>Class {r.classId}, act {cardById(r.cardId).activity}</th><td>{labels[r.rating]}</td><td>{duration(r.recallMs)}</td><td>{duration(r.checkMs)}</td></tr>)}
      </tbody></table></div></details>
    </> : <p className="cp-muted">Your timings and ratings will appear here after your first review.</p>}
  </details>;
}

export function CatalanPresentations({ active }: { active: boolean }) {
  const [data, setData] = useState<Database | null>(null);
  const currentData = useRef<Database | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [locked, setLocked] = useState(false);
  const [minutes, setMinutes] = useState("60");
  const [loadKey, setLoadKey] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastClock = useRef(performance.now());
  const activeRef = useRef(active);
  activeRef.current = active;
  const writable = useRef(false);
  const writeTail = useRef(Promise.resolve());
  const alive = useRef(true);
  const answerFocus = useRef<HTMLHeadingElement>(null);
  const mainPanel = useRef<HTMLDivElement>(null);

  function persist(next: Database) {
    if (!writable.current) return;
    currentData.current = next; setData(next);
    writeTail.current = writeTail.current.catch(() => {}).then(() => saveDatabase(next)).catch(() => {
      if (!alive.current) return;
      setError("Your latest changes could not be saved. Download a backup, or retry saving.");
      const latest = currentData.current;
      if (latest?.active) { const paused = { ...latest, active: { ...latest.active, paused: true } }; currentData.current = paused; setData(paused); }
    });
  }

  function captureTime() {
    const now = performance.now();
    const delta = now - lastClock.current; lastClock.current = now;
    const latest = currentData.current;
    if (!latest?.active || latest.active.paused || !activeRef.current) return latest;
    return { ...latest, active: tickSession(latest.active, delta) };
  }

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    let release: () => void = () => {};
    const held = new Promise<void>(resolve => { release = resolve; });
    async function initialize() {
      try {
        // Let React's development effect cleanup run before acquiring an external lock.
        await Promise.resolve();
        if (cancelled) return;
        if (!navigator.locks) throw new Error("Use a current browser with Web Locks support to save study sessions safely.");
        await navigator.locks.request("habitro-catalan-presentations-writer", { ifAvailable: true }, async lock => {
          if (cancelled) return;
          if (!lock) { setLocked(true); return; }
          setLocked(false);
          try {
            const loaded = await loadDatabase();
            if (cancelled) return;
            if (loaded.active) loaded.active.paused = true;
            writable.current = true; currentData.current = loaded;
            setData(loaded); setMinutes(String(loaded.preferences.minutes)); setError("");
            await held;
            await writeTail.current;
          } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "The study database could not be opened."); }
          finally { writable.current = false; }
        });
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "The study database could not be opened."); }
    }
    void initialize();
    return () => { cancelled = true; alive.current = false; release(); };
  }, [loadKey]);

  useEffect(() => {
    if (!active) {
      const latest = currentData.current;
      if (latest?.active && !latest.active.paused) persist({ ...latest, active: { ...tickSession(latest.active, performance.now() - lastClock.current), paused: true } });
    }
    lastClock.current = performance.now();
  }, [active]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const next = captureTime();
      if (next && next !== currentData.current) persist(next);
    }, 1000);
    const pauseWhenHidden = () => {
      if (document.visibilityState !== "hidden") return;
      const next = captureTime();
      if (next?.active && !next.active.paused) persist({ ...next, active: { ...next.active, paused: true } });
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    window.addEventListener("pagehide", pauseWhenHidden);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", pauseWhenHidden); window.removeEventListener("pagehide", pauseWhenHidden); };
  }, []);

  const session = data?.active;
  const card = session?.current ? cardById(session.current.cardId) : null;
  useEffect(() => {
    if (!active || !card || session?.paused || !answerFocus.current || !mainPanel.current) return;
    answerFocus.current.focus({ preventScroll: true });
    const navHeight = document.querySelector(".globalnav")?.getBoundingClientRect().height ?? 56;
    mainPanel.current.style.scrollMarginTop = `${navHeight + 12}px`;
    mainPanel.current.scrollIntoView({ block: "start", behavior: "instant" });
  }, [card?.id, active, session?.paused]);

  function reveal() {
    const next = captureTime();
    if (!next?.active?.current || next.active.paused || next.active.current.revealed || error) return;
    persist({ ...next, active: { ...next.active, current: { ...next.active.current, revealed: true } } });
  }
  function rate(rating: Rating) {
    const next = captureTime();
    if (!next?.active?.current?.revealed || next.active.paused || error) return;
    const result = reviewSession(next.active, rating, next.reviews);
    persist({ ...next, reviews: [...next.reviews, result.review], active: result.session.reason ? null : result.session,
      sessions: result.session.reason ? [...next.sessions, result.session] : next.sessions });
    if (result.session.reason) setNotice(result.session.reason === "mastered" ? "All selected activities were rated Easy. Session complete."
      : result.session.reason === "time" ? "Study time complete. Your reviews are saved."
      : "Session complete. There are no other available activities to place between repeats. Select more activities for a longer session.");
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!active || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) return;
      const latest = currentData.current?.active;
      if (!latest || latest.paused || error) return;
      if (event.code === "Space" && !latest.current?.revealed) { event.preventDefault(); reveal(); }
      else if (latest.current?.revealed && /^[1-4]$/.test(event.key)) { event.preventDefault(); rate(RATINGS[Number(event.key) - 1]); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [active, error]);

  function updatePreferences(patch: Partial<Preferences>) {
    if (!currentData.current || currentData.current.active) return;
    persist({ ...currentData.current, preferences: { ...currentData.current.preferences, ...patch } });
  }
  function togglePause() {
    const next = captureTime();
    if (!next?.active) return;
    lastClock.current = performance.now();
    persist({ ...next, active: { ...next.active, paused: !next.active.paused } });
  }
  function stop() {
    const next = captureTime();
    if (!next?.active) return;
    persist({ ...next, sessions: [...next.sessions, finishSession(next.active, "stopped")], active: null });
    setNotice("Session ended. Completed reviews are saved.");
  }
  function download() {
    const next = captureTime() ?? currentData.current;
    if (!next) return;
    if (next !== currentData.current) persist(next);
    const url = URL.createObjectURL(new Blob([encodeBackup(next)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `catalan-study-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function restore(file: File) {
    try {
      if (file.size > 50000000) throw new Error("This file is too large (maximum 50 MB).");
      const incoming = decodeBackup(await file.text());
      if (!currentData.current || !writable.current) return;
      const next = mergeBackup(currentData.current, incoming);
      persist(next); setMinutes(String(next.preferences.minutes)); setNotice("Backup restored. Existing reviews were kept.");
    } catch { setNotice("Could not restore this backup. Use a Catalan presentations backup with valid study data. Your existing data has not changed."); }
  }

  if (!data || locked) return <section className={`workspace cp-workspace${active ? "" : " hidden-workspace"}`} aria-hidden={!active}>
    <p role="status">{locked ? "Catalan presentations is open in another tab. Close it there to study here." : error || "Opening study database…"}</p>
    {(locked || error) && <button className="ghost-btn" onClick={() => setLoadKey(k => k + 1)}>Try again</button>}
  </section>;
  const selected = selectCards(data.preferences);
  const validMinutes = /^\d+$/.test(minutes) && Number(minutes) >= 5 && Number(minutes) <= 480;
  const expectedCycle = selected.length ? selected.reduce((sum, c) => sum + predictMs(c, data.reviews) + predictMs(c, data.reviews, "checkMs"), 0) / selected.length : 0;
  const currentReviews = data.reviews.filter(r => r.sessionId === session?.id);
  const remaining = session ? Math.max(0, session.preferences.minutes * 60000 - session.elapsedMs) : 0;
  return <section className={`workspace cp-workspace${active ? "" : " hidden-workspace"}`} aria-hidden={!active} lang="en">
    {error && <div className="cp-error" role="alert">{error} <button className="ghost-btn" onClick={() => { setError(""); if (currentData.current) persist(currentData.current); }}>Retry saving</button></div>}
    {notice && !session && <div className="cp-notice" role="status">{notice}</div>}
    <div className="cp-layout">
      <aside className="cp-sidebar" aria-label="Study options">
        <fieldset disabled={Boolean(session) || Boolean(error)}><legend>Classes</legend>
          <details className="cp-class-picker">
            <summary>{data.preferences.classes.length === 0 ? "No classes selected" : `${data.preferences.classes.length} ${data.preferences.classes.length === 1 ? "class" : "classes"} selected`}</summary>
            <div className="cp-class-menu">
              <button className="cp-text-button" type="button" onClick={() => updatePreferences({ classes: data.preferences.classes.length === 3 ? [] : [2, 3, 4] })}>{data.preferences.classes.length === 3 ? "Deselect all" : "Select all"}</button>
              {CLASSES.map(c => <div className="cp-class-row" key={c.id}>
                <button type="button" className="cp-class-choice" aria-pressed={data.preferences.classes.includes(c.id)} onClick={() => updatePreferences({ classes: data.preferences.classes.includes(c.id) ? data.preferences.classes.filter(id => id !== c.id) : [...data.preferences.classes, c.id] })}>
                  <span className="cp-check" aria-hidden="true">{data.preferences.classes.includes(c.id) ? "✓" : ""}</span><span><strong>Class {c.id}<small>{CARDS.filter(card => card.classId === c.id).length} activities</small></strong><span lang="ca">{c.title}</span></span>
                </button>
              </div>)}
            </div>
          </details>
        </fieldset>
        <fieldset disabled={Boolean(session) || Boolean(error)}><legend>Answer length</legend><div className="cp-lengths">
          {LENGTHS.map(length => <button key={length} type="button" aria-pressed={data.preferences.lengths.includes(length)} onClick={() => updatePreferences({ lengths: data.preferences.lengths.includes(length) ? data.preferences.lengths.filter(l => l !== length) : [...data.preferences.lengths, length] })}><strong>{labels[length]}</strong><small>{ranges[length]}</small></button>)}
        </div></fieldset>
        <fieldset disabled={Boolean(session) || Boolean(error)}><legend>Study time</legend>
          <label className="cp-time-input"><span>Minutes</span><input type="number" min="5" max="480" step="1" value={minutes} aria-invalid={!validMinutes} onChange={e => { setMinutes(e.target.value); const n = Number(e.target.value); if (Number.isInteger(n) && n >= 5 && n <= 480) updatePreferences({ minutes: n }); }} /></label>
          {!validMinutes && <p className="cp-error-text">Enter 5–480 minutes.</p>}
        </fieldset>
        <fieldset disabled={Boolean(session) || Boolean(error)}><legend>Order</legend><div className="cp-segment">{(["normal", "random"] as const).map(order => <button key={order} aria-pressed={data.preferences.order === order} onClick={() => updatePreferences({ order })}>{order === "normal" ? "Normal" : "Random"}</button>)}</div></fieldset>
        <details className="cp-sources"><summary>Presentations & source text</summary>{CLASSES.map(c => <div key={c.id}><span>Class {c.id}</span><a href={c.pdf} target="_blank" rel="noreferrer">Presentation ↗</a><a href={c.source} download>Text ↓</a></div>)}</details>
      </aside>
      <div className="cp-main" ref={mainPanel}>
        {session && card ? <>
          <div className="cp-session-bar"><span><strong>{duration(remaining)}</strong> remaining</span><span>{session.completed} reviews · {session.queue.filter(q => q.retired).length} easy</span><div><button className="ghost-btn" disabled={Boolean(error)} onClick={togglePause}>{session.paused ? "Resume" : "Pause"}</button><button className="cp-text-button" onClick={stop}>End session</button></div></div>
          <div className="cp-progress" role="progressbar" aria-label="Study time elapsed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(session.elapsedMs / (session.preferences.minutes * 600)))}><span style={{ width: `${Math.min(100, session.elapsedMs / (session.preferences.minutes * 600))}%` }} /></div>
          {session.paused ? <div className="cp-paused"><h2>Session paused</h2><p>Your place and timings are saved.</p><button className="primary-btn" disabled={Boolean(error)} onClick={togglePause}>Resume study</button></div> : <article className="cp-card" key={card.id}>
            <div className="cp-card-meta"><span>Class {card.classId} · Activity {card.activity}</span><span>{labels[card.length]} answer · {card.words} words</span></div>
            <h2 tabIndex={-1} ref={answerFocus} lang="ca">{card.question}</h2>
            {!session.current?.revealed ? <div className="cp-reveal"><p>Write or recall your answer, then check it.</p><button className="primary-btn" onClick={reveal}>Show answer</button><span className="cp-shortcut">Space</span></div> : <>
              <div className="cp-answer-header"><span>Answer</span><a href={`${CLASSES.find(c => c.id === card.classId)!.pdf}#page=${card.page}`} target="_blank" rel="noreferrer">View slide ↗</a></div>
              <Answer card={card} />
              <div className="cp-rating"><p>How well did you recall it?</p><div>{RATINGS.map((rating, i) => <button key={rating} className={`cp-rate cp-rate--${rating}`} disabled={Boolean(error)} onClick={() => rate(rating)}><span>{labels[rating]}</span><kbd>{i + 1}</kbd></button>)}</div></div>
            </>}
            {remaining === 0 && <p className="cp-notice">Your study time is up. Finish and rate this answer to close the session.</p>}
          </article>}
          {currentReviews.length > 0 && <div className="cp-session-totals">{RATINGS.map(rating => <span key={rating}>{labels[rating]} <strong>{currentReviews.filter(r => r.rating === rating).length}</strong></span>)}</div>}
        </> : <div className="cp-ready">
          <h2>{selected.length ? `${selected.length} activities selected` : "Choose your activities"}</h2>
          <div className="cp-selection-summary">{LENGTHS.map(length => <div key={length}><strong>{selected.filter(c => c.length === length).length}</strong><span>{labels[length]}</span></div>)}</div>
          {selected.length > 0 && validMinutes && <p className="cp-capacity">About {Math.max(1, Math.floor(Number(minutes) * 60000 / expectedCycle))} reviews in {minutes} minutes.</p>}
          {selected.length === 1 && <p className="cp-muted">With one activity, the session ends after one review. Select more to space out repeats.</p>}
          {!selected.length && <p className="cp-muted">Select a class and an answer length with matching activities.</p>}
          <button className="primary-btn cp-start" disabled={!selected.length || !validMinutes || Boolean(error)} onClick={() => {
            const latest = currentData.current; if (!latest || latest.active) return;
            lastClock.current = performance.now(); setNotice("");
            persist({ ...latest, active: createSession(latest.preferences) });
            void navigator.storage?.persist?.().catch(() => {});
          }}>Start study session</button>
        </div>}
      </div>
    </div>
    <Statistics data={data} />
    <footer className="cp-backup"><div><button className="ghost-btn" onClick={download}>Download database</button><button className="ghost-btn" disabled={Boolean(session) || Boolean(error)} onClick={() => fileInput.current?.click()}>Restore backup</button></div><input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void restore(file); }} /></footer>
  </section>;
}
