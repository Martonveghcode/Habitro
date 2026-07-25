import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

import { PHILOSOPHY_CARDS, PHILOSOPHY_CHAPTERS, type PhilosophyCard } from "./philosophyData";
import { useUiText } from "./uiLanguage";

const SETTINGS_KEY = "habitro-philosophy-settings-v1";
const DEFAULT_BATCH_SIZE = 20;

interface PhilosophySettings {
  selectedChapterIds: string[];
  batchSize: number;
  randomOrder: boolean;
}

interface PhilosophySession {
  cards: PhilosophyCard[];
  currentIndex: number;
  finished: boolean;
}

function clampBatchSize(value: unknown, max = PHILOSOPHY_CARDS.length): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.min(DEFAULT_BATCH_SIZE, Math.max(1, max));
  }
  return Math.min(Math.max(1, Math.trunc(numeric)), Math.max(1, max));
}

function defaultSettings(): PhilosophySettings {
  return {
    selectedChapterIds: PHILOSOPHY_CHAPTERS.map((chapter) => chapter.id),
    batchSize: Math.min(DEFAULT_BATCH_SIZE, PHILOSOPHY_CARDS.length),
    randomOrder: true,
  };
}

function loadSettings(): PhilosophySettings {
  if (typeof window === "undefined") {
    return defaultSettings();
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return defaultSettings();
    }

    const parsed = JSON.parse(raw) as Partial<PhilosophySettings>;
    const knownIds = new Set(PHILOSOPHY_CHAPTERS.map((chapter) => chapter.id));
    const selectedChapterIds = Array.isArray(parsed.selectedChapterIds)
      ? parsed.selectedChapterIds.filter((id): id is string => typeof id === "string" && knownIds.has(id))
      : [];

    return {
      selectedChapterIds: selectedChapterIds.length
        ? selectedChapterIds
        : PHILOSOPHY_CHAPTERS.map((chapter) => chapter.id),
      batchSize: clampBatchSize(parsed.batchSize),
      randomOrder: parsed.randomOrder !== false,
    };
  } catch {
    return defaultSettings();
  }
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function PhilosophyPracticeApp({ active }: { active: boolean }) {
  const uiText = useUiText();
  const [settings, setSettings] = useState<PhilosophySettings>(() => loadSettings());
  const [session, setSession] = useState<PhilosophySession | null>(null);
  const [answerVisible, setAnswerVisible] = useState(false);

  const selectedChapterIds = useMemo(() => new Set(settings.selectedChapterIds), [settings.selectedChapterIds]);
  const selectedCards = useMemo(
    () => PHILOSOPHY_CARDS.filter((card) => selectedChapterIds.has(card.chapterId)),
    [selectedChapterIds],
  );
  const selectedAll = settings.selectedChapterIds.length === PHILOSOPHY_CHAPTERS.length;
  const effectiveBatchSize = clampBatchSize(settings.batchSize, selectedCards.length);
  const displayedBatchSize = selectedCards.length ? effectiveBatchSize : 0;
  const currentCard = session && !session.finished ? session.cards[session.currentIndex] : null;
  const cardsByChapter = useMemo(() => {
    const counts = new Map<string, number>();
    for (const card of PHILOSOPHY_CARDS) {
      counts.set(card.chapterId, (counts.get(card.chapterId) ?? 0) + 1);
    }
    return counts;
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!active || !session || session.finished) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        return;
      }

      if ((event.key === " " || event.key === "Enter") && !answerVisible) {
        event.preventDefault();
        setAnswerVisible(true);
        return;
      }

      if (event.key === "ArrowRight" && answerVisible) {
        event.preventDefault();
        setSession((current) => {
          if (!current) {
            return current;
          }
          const nextIndex = current.currentIndex + 1;
          return nextIndex >= current.cards.length
            ? { ...current, finished: true }
            : { ...current, currentIndex: nextIndex };
        });
        setAnswerVisible(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, answerVisible, session]);

  const toggleChapter = (chapterId: string) => {
    if (session && !session.finished) {
      return;
    }
    setSettings((current) => {
      const next = new Set(current.selectedChapterIds);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return {
        ...current,
        selectedChapterIds: PHILOSOPHY_CHAPTERS.filter((chapter) => next.has(chapter.id)).map(
          (chapter) => chapter.id,
        ),
      };
    });
  };

  const toggleAllChapters = () => {
    if (session && !session.finished) {
      return;
    }
    setSettings((current) => ({
      ...current,
      selectedChapterIds: selectedAll ? [] : PHILOSOPHY_CHAPTERS.map((chapter) => chapter.id),
    }));
  };

  const startSession = () => {
    if (!selectedCards.length) {
      return;
    }
    const ordered = settings.randomOrder ? shuffled(selectedCards) : [...selectedCards];
    setSession({
      cards: ordered.slice(0, effectiveBatchSize),
      currentIndex: 0,
      finished: false,
    });
    setAnswerVisible(false);
  };

  const showNextCard = () => {
    setSession((current) => {
      if (!current) {
        return current;
      }
      const nextIndex = current.currentIndex + 1;
      return nextIndex >= current.cards.length
        ? { ...current, finished: true }
        : { ...current, currentIndex: nextIndex };
    });
    setAnswerVisible(false);
  };

  const endSession = () => {
    setSession(null);
    setAnswerVisible(false);
  };

  return (
    <section className={`workspace philosophy-workspace${active ? "" : " hidden-workspace"}`} aria-hidden={!active}>
      <div className="philosophy-layout">
        <aside className="philosophy-sidebar" aria-label={uiText.philosophyChaptersAria}>
          <div className="philosophy-sidebar__heading">
            <div>
              <span className="eyebrow">{uiText.syllabus}</span>
              <h2>{uiText.chapters}</h2>
            </div>
            <span className="philosophy-selected-count">{settings.selectedChapterIds.length}/6</span>
          </div>

          <button
            aria-pressed={selectedAll}
            className={`philosophy-chapter philosophy-chapter--all${selectedAll ? " philosophy-chapter--selected" : ""}`}
            disabled={Boolean(session && !session.finished)}
            type="button"
            onClick={toggleAllChapters}
          >
            <span className="philosophy-chapter__marker" aria-hidden="true">
              {selectedAll ? "✓" : ""}
            </span>
            <span className="philosophy-chapter__copy">
              <strong>{uiText.allTopics}</strong>
              <small>{uiText.cardsCount(PHILOSOPHY_CARDS.length)}</small>
            </span>
          </button>

          <div className="philosophy-chapter-list">
            {PHILOSOPHY_CHAPTERS.map((chapter) => {
              const selected = selectedChapterIds.has(chapter.id);
              return (
                <button
                  key={chapter.id}
                  aria-pressed={selected}
                  className={`philosophy-chapter${selected ? " philosophy-chapter--selected" : ""}`}
                  disabled={Boolean(session && !session.finished)}
                  type="button"
                  onClick={() => toggleChapter(chapter.id)}
                >
                  <span className="philosophy-chapter__marker" aria-hidden="true">
                    {selected ? "✓" : ""}
                  </span>
                  <span className="philosophy-chapter__copy">
                    <strong>{chapter.shortTitle}</strong>
                    <span>{chapter.title}</span>
                    <small>{uiText.cardsCount(cardsByChapter.get(chapter.id) ?? 0)}</small>
                  </span>
                </button>
              );
            })}
          </div>

          {session && !session.finished ? (
            <p className="philosophy-sidebar__note">{uiText.selectionLocked}</p>
          ) : null}
        </aside>

        <div className="philosophy-main">
          {!session ? (
            <section className="philosophy-start-card">
              <div className="philosophy-start-card__header">
                <h2>{uiText.prepareCards}</h2>
              </div>

              <div className="philosophy-settings-grid">
                <label className="philosophy-setting">
                  <span>{uiText.batchSize}</span>
                  <div className="philosophy-batch-row">
                    <input
                      aria-label={uiText.batchSize}
                      disabled={!selectedCards.length}
                      max={Math.max(1, selectedCards.length)}
                      min={1}
                      type="range"
                      value={effectiveBatchSize}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          batchSize: clampBatchSize(event.target.value, selectedCards.length),
                        }))
                      }
                    />
                    <input
                      aria-label={uiText.exactBatchSize}
                      className="philosophy-batch-number"
                      disabled={!selectedCards.length}
                      max={Math.max(1, selectedCards.length)}
                      min={1}
                      type="number"
                      value={effectiveBatchSize}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          batchSize: clampBatchSize(event.target.value, selectedCards.length),
                        }))
                      }
                    />
                  </div>
                </label>

                <label className="philosophy-random-setting">
                  <input
                    checked={settings.randomOrder}
                    type="checkbox"
                    onChange={(event) =>
                      setSettings((current) => ({ ...current, randomOrder: event.target.checked }))
                    }
                  />
                  <span>
                    <strong>{uiText.randomOrder}</strong>
                    <small>{uiText.philosophyRandomHelp}</small>
                  </span>
                </label>
              </div>

              {!selectedCards.length ? (
                <div className="inline-banner warn">{uiText.selectChapterToStart}</div>
              ) : null}

              <button className="primary-btn philosophy-start-btn" disabled={!selectedCards.length} type="button" onClick={startSession}>
                {uiText.startCards(displayedBatchSize)}
              </button>

            </section>
          ) : session.finished ? (
            <section className="philosophy-finished-card">
              <span className="philosophy-finished-card__icon" aria-hidden="true">
                ✓
              </span>
              <span className="eyebrow">{uiText.sessionCompleted}</span>
              <h2>{uiText.reviewedCards(session.cards.length)}</h2>
              <p>{uiText.philosophyCompletedHelp}</p>
              <div className="button-row philosophy-finished-actions">
                <button className="primary-btn" type="button" onClick={startSession}>
                  {uiText.repeatSession}
                </button>
                <button className="ghost-btn" type="button" onClick={endSession}>
                  {uiText.changeSelection}
                </button>
              </div>
            </section>
          ) : currentCard ? (
            <section className="philosophy-session">
              <div className="philosophy-session__topbar">
                <div>
                  <span className="eyebrow">{uiText.cardProgress(session.currentIndex + 1, session.cards.length)}</span>
                  <div
                    className="philosophy-progress"
                    aria-label={`${uiText.progress}: ${session.currentIndex + 1}/${session.cards.length}`}
                  >
                    <span style={{ width: `${((session.currentIndex + 1) / session.cards.length) * 100}%` }} />
                  </div>
                </div>
                <button className="ghost-btn philosophy-end-btn" type="button" onClick={endSession}>
                  {uiText.endSession}
                </button>
              </div>

              <article className="philosophy-flashcard">
                <div className="philosophy-card-meta">
                  <span className="philosophy-topic-badge">{currentCard.chapterTitle}</span>
                  <span className={`philosophy-source-badge philosophy-source-badge--${currentCard.source}`}>
                    {currentCard.source === "anki" ? "Anki" : uiText.book}
                  </span>
                </div>
                <p className="philosophy-section-label">{currentCard.section}</p>
                <h2 className="philosophy-question">{currentCard.question}</h2>

                {!answerVisible ? (
                  <div className="philosophy-reveal-area">
                    <button className="primary-btn philosophy-reveal-btn" type="button" onClick={() => setAnswerVisible(true)}>
                      {uiText.showAnswer}
                    </button>
                    <span>{uiText.revealShortcut}</span>
                  </div>
                ) : (
                  <div className="philosophy-answer-shell">
                    <div className="philosophy-answer-label">{uiText.answer}</div>
                    <div className="philosophy-answer">
                      <ReactMarkdown>{currentCard.answer}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </article>

              {answerVisible ? (
                <div className="philosophy-next-row">
                  <span>← {uiText.reviewThenContinue}</span>
                  <button className="primary-btn philosophy-next-btn" type="button" onClick={showNextCard}>
                    {session.currentIndex + 1 === session.cards.length ? uiText.finalize : uiText.next} →
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
