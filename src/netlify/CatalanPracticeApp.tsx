import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

type CatalanView = "study" | "library" | "import" | "prompt";
type StudyMode = "Random" | "Weak" | "Fresh" | "Mistakes";
export type AnswerMode = "Gap" | "Full";
type DeckSource = "built-in" | "local";

interface DeckManifestItem {
  name: string;
  fileName: string;
}

export interface CatalanCard {
  deckName: string;
  section: string;
  prompt: string;
  masked: string;
  answer: string;
  missing: string;
  termId: string;
}

export interface CatalanDeck {
  name: string;
  source: DeckSource;
  cards: CatalanCard[];
}

export interface CatalanCardStats {
  seen: number;
  correct: number;
  incorrect: number;
  streak: number;
  last_result: string;
  last_seen?: string;
}

interface CatalanDailyEntry {
  attempts: number;
  correct: number;
  incorrect: number;
  words: Record<string, true>;
}

export interface CatalanProgress {
  [deckName: string]: Record<string, CatalanCardStats> | Record<string, CatalanDailyEntry> | undefined;
  __daily?: Record<string, CatalanDailyEntry>;
}

interface CatalanFeedback {
  correct: boolean;
  userText: string;
  selectedIndices: number[];
}

interface DeckSummary {
  deck: CatalanDeck;
  attempts: number;
  correct: number;
  incorrect: number;
  studied: number;
  hard: number;
  accuracy: number;
  coverage: number;
  sections: number;
}

const DISPLAY_GAP = "___";
const PLACEHOLDER_CHARS = new Set(["_", "?", "*"]);
const PROGRESS_STORAGE_KEY = "catWordsProgress";
const PROGRESS_SEEDED_KEY = "catWordsProgressSeededFromAppData";
const IMPORTED_DECKS_STORAGE_KEY = "catWordsImportedDecks";
export const CATALAN_PROGRESS_UPDATED_EVENT = "catWordsProgressUpdated";
export const CATALAN_DECKS_UPDATED_EVENT = "catWordsDecksUpdated";
const TEMPLATE_CSV = "section,prompt,masked,answer,missing";

const BUILT_IN_DECKS: DeckManifestItem[] = [
  {
    name: "Classe 10 - L'accent i la di\u00e8resi",
    fileName: "Classe 10 - L'accent i la di\u00e8resi.csv",
  },
  {
    name: "Classe 12 - L'apostrofaci\u00f3",
    fileName: "Classe 12 - L'apostrofaci\u00f3.csv",
  },
  {
    name: "Classe 17 - G j tg tj",
    fileName: "Classe 17 - G j tg tj.csv",
  },
  {
    name: "Classe 6 - L'ortografia de la vocal neutra",
    fileName: "Classe 6 - L'ortografia de la vocal neutra.csv",
  },
  {
    name: "s",
    fileName: "s.csv",
  },
];

const ACCENT_DECK_NAME = BUILT_IN_DECKS[0]?.name ?? "";

const PROMPT_TEMPLATE = `You will receive a Catalan presentation, slide export, or pasted lesson text that contains fill-in-the-gap vocabulary exercises and an answer key.

Extract every gap word and match it to its correct answer.

Return exactly one CSV block and nothing else.

Use this column order exactly:
section,prompt,masked,answer,missing

Rules:
- section: slide title, unit, chapter, or topic. Use General if unclear.
- prompt: the shortest useful exercise context or sentence.
- masked: the exercise word with underscores only for the missing letters. Keep one underscore per missing letter.
- answer: the full correct word.
- missing: only the missing letters, in order, lowercase unless the source clearly uses uppercase.
- Preserve accents, apostrophes, hyphens, and Catalan spelling exactly.
- Keep duplicate words if they appear in different sections or prompts.
- Skip items that are not actual gap-fill words.
- If the slide already shows the answer, still extract it.
- Do not add comments, bullets, explanations, markdown tables, or prose.`;

const COLUMN_ALIASES: Record<string, string> = {
  section: "section",
  unit: "section",
  chapter: "section",
  topic: "section",
  group: "section",
  deck_section: "section",
  prompt: "prompt",
  clue: "prompt",
  context: "prompt",
  sentence: "prompt",
  exercise: "prompt",
  question: "prompt",
  masked: "masked",
  mask: "masked",
  gap: "masked",
  blank: "masked",
  word_with_gap: "masked",
  masked_word: "masked",
  gap_word: "masked",
  answer: "answer",
  solution: "answer",
  correct: "answer",
  correct_word: "answer",
  full_word: "answer",
  word: "answer",
  missing: "missing",
  letters: "missing",
  missing_letters: "missing",
  gap_answer: "missing",
  fill: "missing",
  target: "missing",
  term_id: "term_id",
  termid: "term_id",
  id: "term_id",
};

function cx(...tokens: Array<string | false | null | undefined>): string {
  return tokens.filter(Boolean).join(" ");
}

export function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function blankStats(): CatalanCardStats {
  return {
    seen: 0,
    correct: 0,
    incorrect: 0,
    streak: 0,
    last_result: "",
  };
}

function coerceStats(value: unknown): CatalanCardStats {
  if (!isRecord(value)) {
    return blankStats();
  }

  return {
    seen: Number(value.seen) || 0,
    correct: Number(value.correct) || 0,
    incorrect: Number(value.incorrect) || 0,
    streak: Number(value.streak) || 0,
    last_result: asString(value.last_result),
    last_seen: asString(value.last_seen) || undefined,
  };
}

function sanitizeProgress(value: unknown): CatalanProgress {
  if (!isRecord(value)) {
    return {};
  }

  const progress: CatalanProgress = {};
  Object.entries(value).forEach(([deckName, deckValue]) => {
    if (deckName === "__daily") {
      if (isRecord(deckValue)) {
        progress.__daily = Object.fromEntries(
          Object.entries(deckValue)
            .filter(([, entry]) => isRecord(entry))
            .map(([dateKey, entry]) => {
              const daily = entry as Record<string, unknown>;
              const words: Record<string, true> = {};
              if (isRecord(daily.words)) {
                Object.keys(daily.words).forEach((wordKey) => {
                  words[wordKey] = true;
                });
              }
              return [
                dateKey,
                {
                  attempts: Number(daily.attempts) || 0,
                  correct: Number(daily.correct) || 0,
                  incorrect: Number(daily.incorrect) || 0,
                  words,
                },
              ];
            }),
        );
      }
      return;
    }

    if (!isRecord(deckValue)) {
      return;
    }

    progress[deckName] = Object.fromEntries(
      Object.entries(deckValue).map(([termId, stats]) => [termId, coerceStats(stats)]),
    );
  });

  return progress;
}

export function loadStoredCatalanProgress(): CatalanProgress {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return sanitizeProgress(JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY) || "{}"));
  } catch {
    return {};
  }
}

export function saveStoredCatalanProgress(progress: CatalanProgress, notify = true): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  if (notify) {
    window.dispatchEvent(new CustomEvent(CATALAN_PROGRESS_UPDATED_EVENT));
  }
}

function hasProgressEntries(progress: CatalanProgress): boolean {
  return Object.keys(progress).some((key) => key !== "__daily" && isRecord(progress[key]));
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((part) => part.trim())) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else if (char !== undefined) {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((part) => part.trim())) {
    rows.push(row);
  }

  return rows;
}

function csvToRecords(text: string): Array<Record<string, string>> {
  const rows = parseCSVRows(text);
  const headerRow = rows.shift();
  if (!headerRow) {
    throw new Error("CSV is empty.");
  }

  const headers = headerRow.map((header) => COLUMN_ALIASES[normalizeHeader(header)] ?? normalizeHeader(header));
  if (!headers.includes("masked") || !headers.includes("answer")) {
    throw new Error("CSV needs masked and answer columns.");
  }

  return rows.map((parts) =>
    Object.fromEntries(headers.map((header, index) => [header, (parts[index] || "").trim()])),
  );
}

function chars(value: string): string[] {
  return Array.from(value || "");
}

function deriveMissing(masked: string, answer: string): string {
  const answerChars = chars(answer);
  return chars(masked)
    .map((char, index) => (PLACEHOLDER_CHARS.has(char) ? answerChars[index] || "" : ""))
    .join("");
}

function simpleHash(value: string): string {
  let hash = 5381;
  for (const char of value) {
    hash = (hash * 33) ^ (char.codePointAt(0) || 0);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function canonicalizeCatalanCards(text: string, deckName: string): CatalanCard[] {
  const records = csvToRecords(text);
  const cards = records
    .map((record, index) => {
      const masked = asString(record.masked);
      const answer = asString(record.answer);
      if (!masked || !answer) {
        return null;
      }

      const prompt = asString(record.prompt);
      const section = asString(record.section) || "General";
      const missing = asString(record.missing) || deriveMissing(masked, answer);
      const rawTermId = asString(record.term_id);
      const termId = rawTermId || `${simpleHash([section, prompt, masked, answer].join("|"))}-${index + 1}`;

      return {
        deckName,
        section,
        prompt,
        masked,
        answer,
        missing,
        termId,
      };
    })
    .filter((card): card is CatalanCard => card !== null);

  if (cards.length === 0) {
    throw new Error("CSV has no usable rows.");
  }

  return cards;
}

function sanitizeDeckName(value: string): string {
  const cleaned = value.replace(/[<>:"/\\|?*]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 80) || "Catalan deck";
}

export function loadImportedCatalanDecks(): CatalanDeck[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(IMPORTED_DECKS_STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const decks: Array<CatalanDeck | null> = parsed
      .filter(isRecord)
      .map((deck) => {
        const name = sanitizeDeckName(asString(deck.name));
        const cards = Array.isArray(deck.cards)
          ? deck.cards
              .filter(isRecord)
              .map((card) => ({
                deckName: name,
                section: asString(card.section) || "General",
                prompt: asString(card.prompt),
                masked: asString(card.masked),
                answer: asString(card.answer),
                missing: asString(card.missing),
                termId: asString(card.termId) || asString(card.term_id),
              }))
              .filter((card) => card.masked && card.answer && card.termId)
          : [];
        return cards.length ? { name, source: "local" as const, cards } : null;
      });
    return decks.filter((deck): deck is CatalanDeck => deck !== null);
  } catch {
    return [];
  }
}

export function saveImportedCatalanDecks(decks: CatalanDeck[], notify = true): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(IMPORTED_DECKS_STORAGE_KEY, JSON.stringify(decks));
  if (notify) {
    window.dispatchEvent(new CustomEvent(CATALAN_DECKS_UPDATED_EVENT));
  }
}

export async function loadBuiltInCatalanDecks(): Promise<CatalanDeck[]> {
  return Promise.all(
    BUILT_IN_DECKS.map(async (deck) => {
      const response = await fetch(encodeURI(publicAsset(`catalan/decks/${deck.fileName}`)));
      if (!response.ok) {
        throw new Error(`Could not load ${deck.fileName}.`);
      }
      const text = await response.text();
      return {
        name: deck.name,
        source: "built-in" as const,
        cards: canonicalizeCatalanCards(text, deck.name),
      };
    }),
  );
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recentDateKeys(days = 14): string[] {
  const keys: string[] = [];
  const today = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    keys.push(localDateKey(date));
  }
  return keys;
}

function formatDayLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(undefined, { weekday: "short" });
}

function deckProgress(progress: CatalanProgress, deckName: string): Record<string, CatalanCardStats> {
  const value = progress[deckName];
  return isRecord(value) ? (value as Record<string, CatalanCardStats>) : {};
}

export function statsForCatalanCard(progress: CatalanProgress, card: CatalanCard): CatalanCardStats {
  return {
    ...blankStats(),
    ...(deckProgress(progress, card.deckName)[card.termId] ?? {}),
  };
}

function isHard(stats: CatalanCardStats): boolean {
  if (!stats.seen) {
    return false;
  }
  const accuracy = stats.correct / stats.seen;
  return stats.incorrect >= 2 || (stats.seen >= 2 && accuracy < 0.7);
}

function hardnessScore(stats: CatalanCardStats): number {
  if (!stats.seen) {
    return 2.5;
  }

  const accuracy = stats.correct / stats.seen;
  return (
    stats.incorrect * 2.2 +
    (1 - accuracy) * 4 +
    (stats.last_result === "incorrect" ? 1.2 : 0) +
    Math.max(0, 2 - stats.streak) * 0.25
  );
}

function shuffleCards(cards: CatalanCard[]): CatalanCard[] {
  return [...cards].sort(() => Math.random() - 0.5);
}

function weightedShuffle(cards: CatalanCard[], progress: CatalanProgress): CatalanCard[] {
  const pool = [...cards];
  const result: CatalanCard[] = [];

  while (pool.length) {
    const weights = pool.map((card) => Math.max(0.25, hardnessScore(statsForCatalanCard(progress, card))));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let pick = Math.random() * total;
    let index = 0;
    while (pick > weights[index] && index < weights.length - 1) {
      pick -= weights[index];
      index += 1;
    }
    result.push(pool.splice(index, 1)[0]);
  }

  return result;
}

export function buildCatalanSessionRows(
  cards: CatalanCard[],
  progress: CatalanProgress,
  mode: StudyMode,
  sections: string[],
  count: number,
): CatalanCard[] {
  let rows = sections.length ? cards.filter((card) => sections.includes(card.section)) : [...cards];
  if (rows.length === 0) {
    return [];
  }

  if (mode === "Mistakes") {
    const mistakes = rows.filter((card) => statsForCatalanCard(progress, card).incorrect > 0);
    rows = weightedShuffle(mistakes.length ? mistakes : rows, progress);
  } else if (mode === "Weak") {
    rows = weightedShuffle(rows, progress);
  } else if (mode === "Fresh") {
    const unseen = rows.filter((card) => statsForCatalanCard(progress, card).seen === 0);
    const seen = rows.filter((card) => statsForCatalanCard(progress, card).seen > 0);
    rows = [...shuffleCards(unseen), ...weightedShuffle(seen, progress)];
  } else {
    rows = shuffleCards(rows);
  }

  return rows.slice(0, Math.max(1, Math.min(count, rows.length)));
}

export function normalizeCatalanAnswer(value: string): string {
  return value.trim().replace(/[’‘`]/g, "'").replace(/\s+/g, "").toLocaleLowerCase();
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function isCatalanAccentCard(card: CatalanCard | null): boolean {
  return card?.deckName === ACCENT_DECK_NAME;
}

function gapIndices(card: CatalanCard): number[] {
  return chars(card.masked).reduce<number[]>((indices, char, index) => {
    if (PLACEHOLDER_CHARS.has(char)) {
      indices.push(index);
    }
    return indices;
  }, []);
}

export function catalanAccentBaseWord(card: CatalanCard): string {
  return stripDiacritics(card.answer || card.masked).replace(/[_?*]+/g, "");
}

function accentTargets(card: CatalanCard): Array<{ index: number; value: string }> {
  const answerChars = chars(card.answer);
  return gapIndices(card)
    .map((index) => ({ index, value: answerChars[index] || "" }))
    .filter((target) => target.value && stripDiacritics(target.value) !== target.value);
}

export function expectedCatalanAccentInput(card: CatalanCard): string {
  return accentTargets(card).map((target) => target.value).join("");
}

export function expectedCatalanAccentIndices(card: CatalanCard): number[] {
  return accentTargets(card).map((target) => target.index);
}

function displayMaskedSource(value: string): string {
  return value.replace(/^([_?*]+)\s+/, "$1");
}

export function displayCatalanMaskedWord(value: string): string {
  return displayMaskedSource(value).replace(/[_?*]+/g, DISPLAY_GAP);
}

export function previewCatalanMaskedWord(masked: string, userText: string): string {
  const inputChars = chars(userText);
  let inputIndex = 0;
  let output = "";
  const maskedChars = chars(displayMaskedSource(masked));

  for (let index = 0; index < maskedChars.length; index += 1) {
    const char = maskedChars[index];
    if (!PLACEHOLDER_CHARS.has(char)) {
      output += char;
      continue;
    }

    let gapLength = 1;
    while (index + gapLength < maskedChars.length && PLACEHOLDER_CHARS.has(maskedChars[index + gapLength])) {
      gapLength += 1;
    }

    const hasLaterGap = maskedChars.slice(index + gapLength).some((item) => PLACEHOLDER_CHARS.has(item));
    const chunkEnd = hasLaterGap ? inputIndex + gapLength : inputChars.length;
    const typedChunk = inputChars.slice(inputIndex, chunkEnd).join("");
    output += typedChunk || DISPLAY_GAP;
    inputIndex += typedChunk.length;
    index += gapLength - 1;
  }

  return output || displayCatalanMaskedWord(masked);
}

export function displayCatalanPrompt(card: CatalanCard): string {
  const question = card.prompt || card.section || "";
  if (isCatalanAccentCard(card)) {
    return question.replaceAll(card.masked, catalanAccentBaseWord(card)).replace(/[_?*]+/g, "");
  }
  const masked = displayCatalanMaskedWord(card.masked);
  if (card.answer && question.includes(card.answer)) {
    return question.replaceAll(card.answer, masked).replace(/[_*]+/g, DISPLAY_GAP);
  }
  return question.replace(/[_*]+/g, DISPLAY_GAP);
}

export function updateCatalanProgressWithAttempt(progress: CatalanProgress, card: CatalanCard, correct: boolean): CatalanProgress {
  const currentDeckProgress = deckProgress(progress, card.deckName);
  const stats = {
    ...blankStats(),
    ...(currentDeckProgress[card.termId] ?? {}),
  };
  stats.seen += 1;
  stats.correct += correct ? 1 : 0;
  stats.incorrect += correct ? 0 : 1;
  stats.streak = correct ? stats.streak + 1 : 0;
  stats.last_result = correct ? "correct" : "incorrect";
  stats.last_seen = new Date().toISOString();

  const daily = { ...(progress.__daily ?? {}) };
  const today = localDateKey();
  const todayEntry = daily[today]
    ? {
        ...daily[today],
        words: { ...daily[today].words },
      }
    : { attempts: 0, correct: 0, incorrect: 0, words: {} };

  todayEntry.attempts += 1;
  todayEntry.correct += correct ? 1 : 0;
  todayEntry.incorrect += correct ? 0 : 1;
  todayEntry.words[`${card.deckName}::${card.termId}`] = true;
  daily[today] = todayEntry;

  return {
    ...progress,
    [card.deckName]: {
      ...currentDeckProgress,
      [card.termId]: stats,
    },
    __daily: daily,
  };
}

function summarizeDeck(deck: CatalanDeck, progress: CatalanProgress): DeckSummary {
  const attempts = deck.cards.reduce((total, card) => total + statsForCatalanCard(progress, card).seen, 0);
  const correct = deck.cards.reduce((total, card) => total + statsForCatalanCard(progress, card).correct, 0);
  const incorrect = deck.cards.reduce((total, card) => total + statsForCatalanCard(progress, card).incorrect, 0);
  const studied = deck.cards.filter((card) => statsForCatalanCard(progress, card).seen > 0).length;
  const hard = deck.cards.filter((card) => isHard(statsForCatalanCard(progress, card))).length;
  const accuracy = attempts ? Math.round((correct / attempts) * 100) : 0;
  const coverage = deck.cards.length ? Math.round((studied / deck.cards.length) * 100) : 0;

  return {
    deck,
    attempts,
    correct,
    incorrect,
    studied,
    hard,
    accuracy,
    coverage,
    sections: new Set(deck.cards.map((card) => card.section)).size,
  };
}

function dailyWordCount(entry: CatalanDailyEntry | undefined): number {
  return Object.keys(entry?.words || {}).length;
}

function ToggleChoice({
  active,
  children,
  disabled = false,
  onClick,
}: {
  active: boolean;
  children: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cx("choice-pill", active && "active")}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function CatalanPracticeApp({ active }: { active: boolean }) {
  const [view, setView] = useState<CatalanView>("study");
  const [builtInDecks, setBuiltInDecks] = useState<CatalanDeck[]>([]);
  const [importedDecks, setImportedDecks] = useState<CatalanDeck[]>(() => loadImportedCatalanDecks());
  const [loadError, setLoadError] = useState("");
  const [progress, setProgress] = useState<CatalanProgress>(() => loadStoredCatalanProgress());
  const [selectedDeckNames, setSelectedDeckNames] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [studyMode, setStudyMode] = useState<StudyMode>("Random");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("Gap");
  const [cardCount, setCardCount] = useState(25);
  const [queue, setQueue] = useState<CatalanCard[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [feedback, setFeedback] = useState<CatalanFeedback | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [sessionLog, setSessionLog] = useState<boolean[]>([]);
  const [reshuffleToken, setReshuffleToken] = useState(0);
  const [accentSelection, setAccentSelection] = useState<number[]>([]);
  const [libraryDeckName, setLibraryDeckName] = useState("");
  const [importName, setImportName] = useState("");
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importTone, setImportTone] = useState<"info" | "warn">("info");
  const answerInputRef = useRef<HTMLInputElement | null>(null);

  const allDecks = useMemo(() => [...builtInDecks, ...importedDecks], [builtInDecks, importedDecks]);
  const allDeckNames = useMemo(() => allDecks.map((deck) => deck.name), [allDecks]);
  const selectedCards = useMemo(
    () => allDecks.filter((deck) => selectedDeckNames.includes(deck.name)).flatMap((deck) => deck.cards),
    [allDecks, selectedDeckNames],
  );
  const availableSections = useMemo(
    () => [...new Set(selectedCards.map((card) => card.section))].sort((a, b) => a.localeCompare(b)),
    [selectedCards],
  );
  const currentCard = queue[queueIndex] ?? null;
  const sectionSignature = availableSections.join("\u0000");
  const deckSignature = allDecks.map((deck) => `${deck.name}:${deck.cards.length}`).join("\u0000");
  const selectedDeckSignature = selectedDeckNames.join("\u0000");
  const selectedSectionSignature = selectedSections.join("\u0000");

  useEffect(() => {
    let cancelled = false;

    async function loadBuiltInDecks() {
      try {
        const decks = await loadBuiltInCatalanDecks();
        if (!cancelled) {
          setBuiltInDecks(decks);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load Catalan decks.");
        }
      }
    }

    void loadBuiltInDecks();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (window.localStorage.getItem(PROGRESS_SEEDED_KEY) === "1" || hasProgressEntries(progress)) {
      return;
    }

    let cancelled = false;
    async function seedProgress() {
      try {
        const response = await fetch(publicAsset("catalan/progress.json"));
        if (!response.ok) {
          return;
        }
        const seeded = sanitizeProgress(await response.json());
        if (!cancelled && hasProgressEntries(seeded)) {
          setProgress((current) => (hasProgressEntries(current) ? current : seeded));
        }
      } finally {
        window.localStorage.setItem(PROGRESS_SEEDED_KEY, "1");
      }
    }

    void seedProgress();
    return () => {
      cancelled = true;
    };
  }, [progress]);

  useEffect(() => {
    saveStoredCatalanProgress(progress, false);
  }, [progress]);

  useEffect(() => {
    saveImportedCatalanDecks(importedDecks, false);
  }, [importedDecks]);

  useEffect(() => {
    const reloadProgress = () => setProgress(loadStoredCatalanProgress());
    const reloadImportedDecks = () => setImportedDecks(loadImportedCatalanDecks());
    window.addEventListener(CATALAN_PROGRESS_UPDATED_EVENT, reloadProgress);
    window.addEventListener(CATALAN_DECKS_UPDATED_EVENT, reloadImportedDecks);
    return () => {
      window.removeEventListener(CATALAN_PROGRESS_UPDATED_EVENT, reloadProgress);
      window.removeEventListener(CATALAN_DECKS_UPDATED_EVENT, reloadImportedDecks);
    };
  }, []);

  useEffect(() => {
    setSelectedDeckNames((current) => {
      const available = new Set(allDeckNames);
      const next = current.filter((name) => available.has(name));
      if (next.length > 0) {
        return next;
      }
      return allDeckNames[0] ? [allDeckNames[0]] : [];
    });
  }, [allDeckNames]);

  useEffect(() => {
    setSelectedSections((current) => current.filter((section) => availableSections.includes(section)));
  }, [sectionSignature, availableSections]);

  useEffect(() => {
    setLibraryDeckName((current) => (allDeckNames.includes(current) ? current : allDeckNames[0] || ""));
  }, [allDeckNames]);

  useEffect(() => {
    const nextQueue = buildCatalanSessionRows(selectedCards, progress, studyMode, selectedSections, cardCount);
    setQueue(nextQueue);
    setQueueIndex(0);
    setFeedback(null);
    setAnswerDraft("");
    setAccentSelection([]);
    setSessionLog([]);
  }, [
    selectedDeckSignature,
    selectedSectionSignature,
    studyMode,
    cardCount,
    reshuffleToken,
    deckSignature,
    selectedCards,
  ]);

  useEffect(() => {
    if (active && view === "study" && !feedback) {
      answerInputRef.current?.focus();
    }
  }, [active, view, currentCard?.termId, feedback]);

  const nextCard = () => {
    setQueueIndex((current) => Math.min(current + 1, queue.length));
    setFeedback(null);
    setAnswerDraft("");
    setAccentSelection([]);
  };

  const previousCard = () => {
    setQueueIndex((current) => Math.max(current - 1, 0));
    setFeedback(null);
    setAnswerDraft("");
    setAccentSelection([]);
  };

  const submitAnswer = () => {
    if (!currentCard) {
      return;
    }
    if (feedback) {
      nextCard();
      return;
    }

    const selectedIndices = [...accentSelection].sort((a, b) => a - b);
    const expected = answerMode === "Gap" && currentCard.missing ? currentCard.missing : currentCard.answer;
    const correct = isCatalanAccentCard(currentCard)
      ? expectedCatalanAccentIndices(currentCard).length === selectedIndices.length &&
        expectedCatalanAccentIndices(currentCard).every((index, itemIndex) => index === selectedIndices[itemIndex]) &&
        normalizeCatalanAnswer(answerDraft) === normalizeCatalanAnswer(expectedCatalanAccentInput(currentCard))
      : normalizeCatalanAnswer(answerDraft) === normalizeCatalanAnswer(expected);

    setProgress((current) => updateCatalanProgressWithAttempt(current, currentCard, correct));
    setSessionLog((current) => [...current, correct]);
    setFeedback({ correct, userText: answerDraft, selectedIndices });
  };

  useEffect(() => {
    if (!active || view !== "study") {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        previousCard();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nextCard();
      }
      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        submitAnswer();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, view, currentCard, feedback, answerDraft, accentSelection, queue.length]);

  const metrics = useMemo(() => {
    const attempts = selectedCards.reduce((total, card) => total + statsForCatalanCard(progress, card).seen, 0);
    const correct = selectedCards.reduce((total, card) => total + statsForCatalanCard(progress, card).correct, 0);
    let streak = 0;
    for (let index = sessionLog.length - 1; index >= 0; index -= 1) {
      if (!sessionLog[index]) {
        break;
      }
      streak += 1;
    }
    return {
      words: selectedCards.length,
      accuracy: attempts ? `${Math.round((correct / attempts) * 100)}%` : "-",
      hard: selectedCards.filter((card) => isHard(statsForCatalanCard(progress, card))).length,
      streak,
    };
  }, [progress, selectedCards, sessionLog]);

  const summaries = useMemo(() => allDecks.map((deck) => summarizeDeck(deck, progress)), [allDecks, progress]);
  const libraryDeck = allDecks.find((deck) => deck.name === libraryDeckName) ?? allDecks[0] ?? null;
  const libraryRows = libraryDeck
    ? libraryDeck.cards
        .map((card) => {
          const stats = statsForCatalanCard(progress, card);
          return {
            card,
            stats,
            accuracy: stats.seen ? Math.round((stats.correct / stats.seen) * 100) : 0,
          };
        })
        .sort((a, b) => b.stats.incorrect - a.stats.incorrect || b.stats.seen - a.stats.seen)
    : [];

  const toggleDeck = (deckName: string) => {
    setSelectedDeckNames((current) => {
      const activeDeck = current.includes(deckName);
      if (activeDeck && current.length <= 1) {
        return current;
      }
      return activeDeck ? current.filter((name) => name !== deckName) : [...current, deckName];
    });
    setReshuffleToken((current) => current + 1);
  };

  const toggleSection = (section: string) => {
    setSelectedSections((current) =>
      current.includes(section) ? current.filter((value) => value !== section) : [...current, section],
    );
    setReshuffleToken((current) => current + 1);
  };

  const handleAnswerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitAnswer();
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }
    setImportName((current) => current || file.name.replace(/\.[^.]+$/, ""));
    void file.text().then((text) => setImportText(text));
    event.currentTarget.value = "";
  };

  const importDeck = () => {
    try {
      const deckName = sanitizeDeckName(importName);
      const cards = canonicalizeCatalanCards(importText, deckName);
      const nextDeck: CatalanDeck = { name: deckName, source: "local", cards };
      const nextImportedDecks = [...importedDecks.filter((deck) => deck.name !== deckName), nextDeck];
      setImportedDecks(nextImportedDecks);
      saveImportedCatalanDecks(nextImportedDecks);
      setSelectedDeckNames([deckName]);
      setSelectedSections([]);
      setImportMessage(`Imported ${cards.length} cards into ${deckName}.`);
      setImportTone("info");
      setView("study");
      setReshuffleToken((current) => current + 1);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Could not import CSV.");
      setImportTone("warn");
    }
  };

  const resetDeckProgress = (deckName: string) => {
    setProgress((current) => {
      const next = { ...current };
      delete next[deckName];
      return next;
    });
    setReshuffleToken((current) => current + 1);
  };

  const clearAllProgress = () => {
    if (!window.confirm("Clear all saved Catalan progress on this browser?")) {
      return;
    }
    setProgress({});
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PROGRESS_SEEDED_KEY);
    }
    setReshuffleToken((current) => current + 1);
  };

  const removeImportedDeck = (deckName: string) => {
    const nextImportedDecks = importedDecks.filter((deck) => deck.name !== deckName);
    setImportedDecks(nextImportedDecks);
    saveImportedCatalanDecks(nextImportedDecks);
    setSelectedDeckNames((current) => current.filter((name) => name !== deckName));
    resetDeckProgress(deckName);
  };

  const questionWord = currentCard
    ? answerMode === "Full"
      ? answerDraft.trim() || displayCatalanMaskedWord(currentCard.masked)
      : previewCatalanMaskedWord(currentCard.masked, answerDraft)
    : "";
  const remaining = Math.max(queue.length - queueIndex, 0);
  const progressWidth = queue.length ? `${Math.round((queueIndex / queue.length) * 100)}%` : "0%";

  return (
    <section className={cx("workspace catalan-workspace", !active && "hidden-workspace")}>
      <div className="catalan-topline">
        <div className="catalan-topline__meta">
          <span>
            <strong>{allDecks.length}</strong> decks
          </span>
          <span>
            <strong>{allDecks.reduce((total, deck) => total + deck.cards.length, 0)}</strong> cards
          </span>
        </div>
        <nav className="catalan-tabs" aria-label="Catalan sections">
          {(["study", "library", "import", "prompt"] as CatalanView[]).map((item) => (
            <button
              key={item}
              className={cx("page-action", view === item && "page-action--active")}
              type="button"
              onClick={() => setView(item)}
            >
              {item === "study" ? "Study" : item === "library" ? "Library" : item === "import" ? "Import" : "Prompt"}
            </button>
          ))}
        </nav>
      </div>

      {loadError ? <div className="inline-banner warn">{loadError}</div> : null}

      {view === "study" ? (
        <div className="catalan-study">
          <div className="panel control-panel catalan-controls">
            <div className="field-block">
              <h3 className="section-heading">Decks</h3>
              <div className="chip-cloud">
                {allDecks.map((deck) => (
                  <ToggleChoice
                    key={`${deck.source}-${deck.name}`}
                    active={selectedDeckNames.includes(deck.name)}
                    disabled={selectedDeckNames.includes(deck.name) && selectedDeckNames.length <= 1}
                    onClick={() => toggleDeck(deck.name)}
                  >
                    {deck.name}
                  </ToggleChoice>
                ))}
              </div>
            </div>

            <div className="field-grid compact-grid">
              <div>
                <label className="field">
                  <span>Mode</span>
                  <select value={studyMode} onChange={(event) => setStudyMode(event.target.value as StudyMode)}>
                    <option>Random</option>
                    <option>Weak</option>
                    <option>Fresh</option>
                    <option>Mistakes</option>
                  </select>
                </label>
              </div>
              <div>
                <label className="field">
                  <span>Cards</span>
                  <input
                    min={1}
                    type="number"
                    value={cardCount}
                    onChange={(event) => setCardCount(Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
              </div>
              <div>
                <label className="field">
                  <span>Answer</span>
                  <select value={answerMode} onChange={(event) => setAnswerMode(event.target.value as AnswerMode)}>
                    <option>Gap</option>
                    <option>Full</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="field-block">
              <h3 className="section-heading">Sections</h3>
              <div className="chip-cloud catalan-section-cloud">
                {availableSections.length ? (
                  availableSections.map((section) => (
                    <ToggleChoice key={section} active={selectedSections.includes(section)} onClick={() => toggleSection(section)}>
                      {section}
                    </ToggleChoice>
                  ))
                ) : (
                  <p className="muted-line">No sections available.</p>
                )}
              </div>
            </div>

            <button className="primary-btn" type="button" onClick={() => setReshuffleToken((current) => current + 1)}>
              Reshuffle
            </button>
          </div>

          <div className="panel practice-panel catalan-practice-panel">
            <section className="catalan-metrics" aria-label="Catalan study metrics">
              <article>
                <span>Words</span>
                <strong>{metrics.words}</strong>
              </article>
              <article>
                <span>Accuracy</span>
                <strong>{metrics.accuracy}</strong>
              </article>
              <article>
                <span>Hard words</span>
                <strong>{metrics.hard}</strong>
              </article>
              <article>
                <span>Session streak</span>
                <strong>{metrics.streak}</strong>
              </article>
            </section>

            <div className="catalan-progress-row">
              <span>{remaining} remaining</span>
              <span>
                Left / Right to move
                <span className="catalan-hotkey-divider" />
                Spacebar to check
              </span>
            </div>
            <div className="catalan-progress">
              <span style={{ width: progressWidth }} />
            </div>

            {!currentCard ? (
              <div className="empty-state">
                <h3>{allDecks.length ? "Session complete." : "No Catalan decks loaded."}</h3>
              </div>
            ) : (
              <>
                <section className="catalan-question-card">
                  <div className="question-section">{currentCard.section}</div>
                  <div className="question-prompt">{displayCatalanPrompt(currentCard)}</div>
                  {isCatalanAccentCard(currentCard) ? (
                    <div className="catalan-accent-word">
                      {chars(catalanAccentBaseWord(currentCard)).map((letter, index) => {
                        const selected = accentSelection.includes(index);
                        return (
                          <button
                            key={`${letter}-${index}`}
                            aria-pressed={selected}
                            className={cx("catalan-accent-letter", selected && "selected")}
                            disabled={Boolean(feedback)}
                            type="button"
                            onClick={() => {
                              setAccentSelection((current) =>
                                current.includes(index)
                                  ? current.filter((item) => item !== index)
                                  : [...current, index].sort((a, b) => a - b),
                              );
                              answerInputRef.current?.focus();
                            }}
                          >
                            {letter}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="question-word">{questionWord}</div>
                  )}
                </section>

                <form className="catalan-answer-row" onSubmit={handleAnswerSubmit}>
                  <input
                    ref={answerInputRef}
                    aria-label="Answer"
                    autoComplete="off"
                    disabled={Boolean(feedback)}
                    spellCheck={false}
                    value={answerDraft}
                    onChange={(event) => setAnswerDraft(event.target.value)}
                  />
                  <div className="actions">
                    <button className="ghost-btn" disabled={queueIndex <= 0} type="button" onClick={previousCard}>
                      Previous
                    </button>
                    <button className="primary-btn catalan-check-btn" type="submit">
                      {feedback ? "Next" : "Check"}
                    </button>
                    <button className="ghost-btn" type="button" onClick={nextCard}>
                      {feedback ? "Next" : "Skip"}
                    </button>
                  </div>
                </form>

                {feedback ? (
                  <section className={cx("catalan-feedback", feedback.correct ? "success" : "danger")}>
                    <strong>{feedback.correct ? "Correct" : "Incorrect"}</strong>
                    <div>{currentCard.answer}</div>
                    {isCatalanAccentCard(currentCard) ? null : <div>Gap: {currentCard.missing || "-"}</div>}
                    <div>
                      Expected:{" "}
                      {isCatalanAccentCard(currentCard)
                        ? expectedCatalanAccentInput(currentCard) || "no accent"
                        : answerMode === "Gap" && currentCard.missing
                          ? currentCard.missing
                          : currentCard.answer}
                    </div>
                    {isCatalanAccentCard(currentCard) ? (
                      <div>
                        Clicked:{" "}
                        {feedback.selectedIndices.length
                          ? feedback.selectedIndices.map((index) => chars(catalanAccentBaseWord(currentCard))[index]).join(", ")
                          : "none"}
                      </div>
                    ) : null}
                    <div>You typed: {feedback.userText || "-"}</div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {view === "library" ? (
        <div className="catalan-library">
          <section className="daily-record-overview">
            {[
              {
                label: "Words studied",
                value: `${summaries.reduce((total, item) => total + item.studied, 0)}/${summaries.reduce(
                  (total, item) => total + item.deck.cards.length,
                  0,
                )}`,
                detail: "coverage",
              },
              {
                label: "Total attempts",
                value: summaries.reduce((total, item) => total + item.attempts, 0),
                detail: `${summaries.reduce((total, item) => total + item.correct, 0)} correct / ${summaries.reduce(
                  (total, item) => total + item.incorrect,
                  0,
                )} missed`,
              },
              {
                label: "Accuracy",
                value: summaries.reduce((total, item) => total + item.attempts, 0)
                  ? `${Math.round(
                      (summaries.reduce((total, item) => total + item.correct, 0) /
                        summaries.reduce((total, item) => total + item.attempts, 0)) *
                        100,
                    )}%`
                  : "-",
                detail: "all decks",
              },
              {
                label: "Hard words",
                value: summaries.reduce((total, item) => total + item.hard, 0),
                detail: "marked by mistakes",
              },
            ].map((item) => (
              <article className="library-stat" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </section>

          <DailyStudyChart progress={progress} />

          <section className="catalan-chart">
            <div className="chart-header">
              <h2>Deck progress</h2>
              <span>coverage and accuracy</span>
            </div>
            {summaries.some((item) => item.attempts > 0) ? (
              summaries.map((item) => (
                <div className="chart-row" key={item.deck.name}>
                  <div className="chart-label">
                    <strong>{item.deck.name}</strong>
                    <small>
                      {item.studied}/{item.deck.cards.length} words / {item.attempts} attempts
                    </small>
                  </div>
                  <div className="chart-track" aria-label={`${item.deck.name} coverage ${item.coverage}%`}>
                    <span className="chart-fill" style={{ width: `${item.coverage}%` }} />
                  </div>
                  <div className="chart-meta">{item.attempts ? `${item.accuracy}%` : "-"}</div>
                </div>
              ))
            ) : (
              <div className="chart-empty">No study data yet.</div>
            )}
          </section>

          <section className="catalan-deck-grid">
            {summaries.map((item) => (
              <article className="catalan-deck-card" key={`${item.deck.source}-${item.deck.name}`}>
                <h2>{item.deck.name}</h2>
                <p>{item.deck.cards.length} cards</p>
                <p>{item.sections} sections</p>
                <p>
                  {item.studied}/{item.deck.cards.length} studied
                </p>
                <p>{item.attempts ? `${item.accuracy}%` : "-"} accuracy</p>
                <p>{item.hard} hard words</p>
                <div className="button-row">
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => {
                      setSelectedDeckNames([item.deck.name]);
                      setView("study");
                      setReshuffleToken((current) => current + 1);
                    }}
                  >
                    Study
                  </button>
                  {item.deck.source === "local" ? (
                    <button className="danger-btn" type="button" onClick={() => removeImportedDeck(item.deck.name)}>
                      Remove
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </section>

          <section className="catalan-detail">
            <div className="row-between">
              <label className="field catalan-detail-select">
                <span>Deck detail</span>
                <select value={libraryDeckName} onChange={(event) => setLibraryDeckName(event.target.value)}>
                  {allDecks.map((deck) => (
                    <option key={`${deck.source}-${deck.name}`} value={deck.name}>
                      {deck.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="danger-btn"
                disabled={!libraryDeck}
                type="button"
                onClick={() => libraryDeck && resetDeckProgress(libraryDeck.name)}
              >
                Reset selected deck
              </button>
            </div>

            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Word</th>
                    <th>Missing</th>
                    <th>Seen</th>
                    <th>Correct</th>
                    <th>Incorrect</th>
                    <th>Accuracy</th>
                    <th>Section</th>
                  </tr>
                </thead>
                <tbody>
                  {libraryRows.map(({ card, stats, accuracy }) => (
                    <tr key={`${card.deckName}-${card.termId}`}>
                      <td>{card.answer}</td>
                      <td>{card.missing || "-"}</td>
                      <td>{stats.seen}</td>
                      <td>{stats.correct}</td>
                      <td>{stats.incorrect}</td>
                      <td>{stats.seen ? `${accuracy}%` : "-"}</td>
                      <td>{card.section}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="danger-zone">
              <button className="danger-btn" type="button" onClick={clearAllProgress}>
                Clear all Catalan progress
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {view === "import" ? (
        <div className="catalan-import">
          <div className="field-grid">
            <label className="field">
              <span>Deck name</span>
              <input value={importName} onChange={(event) => setImportName(event.target.value)} />
            </label>
            <label className="field file-upload-btn ghost-btn catalan-file-upload">
              Upload CSV
              <input accept=".csv,text/csv" type="file" onChange={handleFileUpload} />
            </label>
          </div>
          <div className="field-block">
            <label className="field">
              <span>Paste CSV</span>
              <textarea
                className="mono-input catalan-import-textarea"
                spellCheck={false}
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
              />
            </label>
          </div>
          <div className="button-row">
            <button className="primary-btn catalan-import-btn" disabled={!importText.trim()} type="button" onClick={importDeck}>
              Import deck
            </button>
            <a
              className="ghost-btn catalan-download-link"
              download="catalan_gap_template.csv"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`}
            >
              Template CSV
            </a>
          </div>
          {importMessage ? <div className={cx("inline-banner", importTone === "warn" && "warn")}>{importMessage}</div> : null}
        </div>
      ) : null}

      {view === "prompt" ? (
        <div className="catalan-prompt">
          <label className="field">
            <span>Prompt</span>
            <textarea className="mono-input catalan-prompt-template" readOnly value={PROMPT_TEMPLATE} />
          </label>
          <label className="field">
            <span>CSV shape</span>
            <textarea className="mono-input catalan-csv-template" readOnly value={TEMPLATE_CSV} />
          </label>
        </div>
      ) : null}
    </section>
  );
}

function DailyStudyChart({ progress }: { progress: CatalanProgress }) {
  const days = recentDateKeys(14).map((key) => {
    const entry = progress.__daily?.[key];
    const attempts = Number(entry?.attempts) || 0;
    const correct = Number(entry?.correct) || 0;
    return {
      key,
      attempts,
      correct,
      words: dailyWordCount(entry),
      accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
    };
  });
  const maxAttempts = Math.max(1, ...days.map((day) => day.attempts));
  const totals = days.reduce(
    (summary, day) => ({
      attempts: summary.attempts + day.attempts,
      correct: summary.correct + day.correct,
      words: summary.words + day.words,
    }),
    { attempts: 0, correct: 0, words: 0 },
  );
  const accuracy = totals.attempts ? Math.round((totals.correct / totals.attempts) * 100) : 0;

  return (
    <section className="catalan-daily-chart">
      <div className="chart-header">
        <h2>Daily study</h2>
        <span>last 14 days</span>
      </div>
      <div className="catalan-daily-summary">
        <div>
          <strong>{totals.attempts}</strong>
          <span>attempts</span>
        </div>
        <div>
          <strong>{totals.words}</strong>
          <span>words touched</span>
        </div>
        <div>
          <strong>{totals.attempts ? `${accuracy}%` : "-"}</strong>
          <span>accuracy</span>
        </div>
      </div>
      {totals.attempts ? (
        <div className="catalan-daily-bars">
          {days.map((day) => {
            const height = day.attempts ? Math.max(8, Math.round((day.attempts / maxAttempts) * 100)) : 0;
            return (
              <div
                className="catalan-daily-day"
                key={day.key}
                title={`${day.key}: ${day.attempts} attempts, ${day.words} words, ${
                  day.attempts ? `${day.accuracy}% accuracy` : "no accuracy"
                }`}
              >
                <div className="catalan-daily-bar-wrap">
                  <span className="catalan-daily-bar" style={{ height: `${height}%` }} />
                </div>
                <strong>{day.attempts}</strong>
                <small>{formatDayLabel(day.key)}</small>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="chart-empty">No daily data yet. New answers will appear here.</div>
      )}
    </section>
  );
}
