# Catalan presentations

The Exercises menu contains **Catalan presentations**. It includes the 25 activities supplied for classes 2, 3 and 4. Select any combination of classes and answer lengths, normal or random order, and 5–480 minutes on the study page. Questions remain in Catalan. Use Show answer (Space), then Wrong, Hard, Medium or Easy (1–4). Session controls and backup actions are on the same page.

## Content fidelity

`public/catalan/presentations` contains the original source text files and three unmodified PDFs. `content.json` preserves each question and answer; display blocks change only whitespace and list/paragraph layout. The test suite compares all 25 cards to the source text and checks source SHA-256 hashes. No spelling, factual statements or lettered answer prefixes have been corrected. The slide links refer to the original PDF pages. Class 4 activity 5 spans slides 27–28.

Answer-only whitespace-delimited word counts define short (≤30, 13 cards), medium (31–75, 7 cards) and long (76+, 5 cards). Boundaries are fixed so the same activity does not change category when filters change. Question length has no effect.

## Scheduling and evidence

Spacing and retrieval practice inform the design:

- Cepeda et al. (2008), *Spacing effects in learning: A temporal ridgeline of optimal retention*, https://escholarship.org/uc/item/0kp5q19x : useful spacing depends on the retention horizon.
- Cepeda et al. (2006), *Distributed practice in verbal recall tasks: A review and quantitative synthesis*, https://pubmed.ncbi.nlm.nih.gov/16719566/ : distributed practice generally improves retention, with spacing and retention intervals interacting.

The short-session policy here is an engineering heuristic. These studies do **not** validate its specific minute-scale constants, and it is not FSRS or Anki's long-term scheduler.

- Wrong overrides time-based scheduling and returns after exactly one other completed activity, taking priority over unseen/due cards. Every repeat requires a different intervening card.
- Easy retires the activity for this session only. Future sessions include it again.
- Hard and Medium use an exponential forgetting curve, `R(t) = exp(-t/S)`. Session length, rating history and successful repetition adjust stability. Hard targets 80% recall and a lower stability; Medium targets 75% with a larger stability. Intervals are bounded by remaining active session time and the predicted time to recall/check the card. Interval values are never displayed on rating buttons.
- Unseen cards retain normal or shuffled order. Due cards and mandatory Wrong returns take priority. When no card is due, unseen cards fill the gap; if the deck is exhausted, the earliest eligible review is brought forward for continuous practice.
- If no different non-retired card is available, the session ends with an explanation rather than violating the required gap or repeating Easy cards. The current activity may be completed and rated after the timer expires; no new activity starts after that.

## Timing model

Recall runs from presentation to Show answer; checking runs from reveal to rating. No keystroke content is collected. An explicitly paused session, hidden browser tab, another app section, browser closure or reload does not accrue time. Restored sessions require Resume. Monotonic timer deltas are capped at five seconds to avoid system sleep distorting estimates.

Predictions start at 12 seconds + 2.4 seconds per answer word for recall, and 4 seconds + 0.35 seconds per word for checking. Each phase independently fits a regularized power-law relationship between answer words and duration. Examples from the same class and similar answer character density carry more weight; recent per-card times are blended in with shrinkage. Very short samples are excluded from prediction (but kept in history), and extreme values are bounded. The most recent 2,000 eligible observations inform predictions; all observations remain in the database. The model updates after each rating, with no 100-review threshold.

## Storage and recovery

The IndexedDB database `habitro-catalan-presentations` holds preferences, every completed review, completed sessions and the active session. Writes are serialized and transactional. One Web Lock prevents concurrent writers across browser tabs. Active-session checkpoints are saved every second and on interactions. An abrupt browser/process termination may lose the last second of uncommitted active timing; completed ratings are committed immediately. Save errors pause study and leave the in-memory data available for export.

Data stays on this browser and origin; it is not synced to an account or server. Download database exports versioned JSON. Restore validates types, IDs, source metadata, queue invariants and history consistency before merging immutable reviews and sessions. Re-import is idempotent, conflicting data is rejected, and active sessions resume paused. Restore is disabled during an active session. These controls are specific to this IndexedDB database; the older app-wide localStorage backup does not contain it. Clearing site storage removes the local database; keep downloaded backups for recovery or transfer.

## Validation

Run `npm run test:presentations` for source fidelity, filters, ordering, scheduling, timing, prediction and backup validation. Run `npm run build` for TypeScript and the production bundle. Run `npm run test:presentations:browser` with Google Chrome installed for the real IndexedDB, backup round-trip, pause/resume, multiple-tab locking and responsive presentation. Set `PRESENTATIONS_TEST_URL` to check a deployed preview instead of the local Vite server.
