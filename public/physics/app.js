const STORAGE_KEY = "fq-revision-progress-v1";

const els = {
  sessionSummary: document.getElementById("sessionSummary"),
  reshuffleBtn: document.getElementById("reshuffleBtn"),
  clearBtn: document.getElementById("clearBtn"),
  allChaptersBtn: document.getElementById("allChaptersBtn"),
  allSectionsBtn: document.getElementById("allSectionsBtn"),
  chapterFilters: document.getElementById("chapterFilters"),
  sectionFilters: document.getElementById("sectionFilters"),
  orderControls: document.getElementById("orderControls"),
  difficultyFilter: document.getElementById("difficultyFilter"),
  exerciseTitle: document.getElementById("exerciseTitle"),
  exerciseMeta: document.getElementById("exerciseMeta"),
  queueCounter: document.getElementById("queueCounter"),
  exerciseImage: document.getElementById("exerciseImage"),
  emptyState: document.getElementById("emptyState"),
  answerPanel: document.getElementById("answerPanel"),
  answerBtn: document.getElementById("answerBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  rating: document.querySelector(".rating"),
};

let data = null;
let queue = [];
let currentIndex = 0;
let answerVisible = false;

let state = {
  chapters: [],
  sections: [],
  order: "random",
  difficulty: "all",
  ratings: {},
};

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && typeof stored === "object") {
      state = { ...state, ...stored, ratings: stored.ratings || {} };
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function allSectionIds() {
  return data.chapters.flatMap((chapter) =>
    chapter.sections.map((section) => section.id),
  );
}

function allChapterIds() {
  return data.chapters.map((chapter) => chapter.id);
}

function ensureDefaults() {
  const chapters = new Set(allChapterIds());
  const sections = new Set(allSectionIds());
  state.chapters = state.chapters.filter((id) => chapters.has(id));
  state.sections = state.sections.filter((id) => sections.has(id));

  if (!state.chapters.length) state.chapters = allChapterIds();
  if (!state.sections.length) state.sections = allSectionIds();
  if (!["random", "balanced", "ordered"].includes(state.order)) {
    state.order = "random";
  }
  if (!["all", "hard", "normal", "easy", "unrated"].includes(state.difficulty)) {
    state.difficulty = "all";
  }
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildBalancedQueue(items) {
  const groups = new Map();
  items.forEach((exercise) => {
    if (!groups.has(exercise.chapterId)) groups.set(exercise.chapterId, []);
    groups.get(exercise.chapterId).push(exercise);
  });

  groups.forEach((chapterItems, chapterId) => {
    groups.set(chapterId, shuffle(chapterItems));
  });

  function canFinishWithoutAdjacentRepeat(pickedChapterId) {
    const counts = [...groups.entries()]
      .map(([chapterId, chapterItems]) =>
        chapterItems.length - (chapterId === pickedChapterId ? 1 : 0),
      )
      .filter(Boolean);
    if (!counts.length) return true;
    const total = counts.reduce((sum, count) => sum + count, 0);
    const highest = Math.max(...counts);
    return highest <= total - highest + 1;
  }

  const mixed = [];
  let lastChapterId = null;

  while ([...groups.values()].some((chapterItems) => chapterItems.length)) {
    const candidates = [...groups.entries()].filter(
      ([chapterId, chapterItems]) =>
        chapterItems.length && chapterId !== lastChapterId,
    );
    const fallbackCandidates = [...groups.entries()].filter(
      ([, chapterItems]) => chapterItems.length,
    );
    const baseCandidates = candidates.length ? candidates : fallbackCandidates;
    const safeCandidates = baseCandidates.filter(([chapterId]) =>
      canFinishWithoutAdjacentRepeat(chapterId),
    );
    const usableCandidates = safeCandidates.length ? safeCandidates : baseCandidates;
    const [chapterId, chapterItems] = shuffle(usableCandidates)[0];

    mixed.push(chapterItems.pop());
    lastChapterId = chapterId;
    if (!chapterItems.length) groups.delete(chapterId);
  }

  return mixed;
}

function buildQueue(items) {
  if (state.order === "random") return shuffle(items);
  if (state.order === "balanced") return buildBalancedQueue(items);
  return items;
}

function exerciseRating(id) {
  return state.ratings[id] || "unrated";
}

function matchesDifficulty(exercise) {
  if (state.difficulty === "all") return true;
  return exerciseRating(exercise.id) === state.difficulty;
}

function filteredExercises() {
  const chapters = new Set(state.chapters);
  const sections = new Set(state.sections);
  return data.exercises.filter(
    (exercise) =>
      chapters.has(exercise.chapterId) &&
      sections.has(exercise.sectionId) &&
      matchesDifficulty(exercise),
  );
}

function rebuildQueue(preferredId = null) {
  const items = filteredExercises();
  queue = buildQueue(items);
  const preferredIndex = preferredId
    ? queue.findIndex((exercise) => exercise.id === preferredId)
    : -1;

  if (preferredIndex >= 0) {
    currentIndex = preferredIndex;
  } else {
    currentIndex = Math.min(currentIndex, Math.max(0, queue.length - 1));
  }

  answerVisible = false;
  renderStudy();
  renderSummary();
}

function currentExercise() {
  return queue[currentIndex] || null;
}

function setSelected(collection, id, checked) {
  const values = new Set(collection);
  if (checked) values.add(id);
  else values.delete(id);
  return [...values];
}

function chapterById(id) {
  return data.chapters.find((chapter) => chapter.id === id);
}

function ensureOrderButtons() {
  if (els.orderControls.querySelector('[data-order="balanced"]')) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.order = "balanced";
  button.textContent = "Tema mix";
  const orderedButton = els.orderControls.querySelector('[data-order="ordered"]');
  els.orderControls.insertBefore(button, orderedButton);
}

function renderControls() {
  ensureOrderButtons();
  const selectedChapters = new Set(state.chapters);
  const selectedSections = new Set(state.sections);

  els.chapterFilters.replaceChildren(
    ...data.chapters.map((chapter) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      const text = document.createElement("span");
      const count = document.createElement("small");

      label.className = "checkItem";
      input.type = "checkbox";
      input.value = chapter.id;
      input.checked = selectedChapters.has(chapter.id);
      text.className = "checkText";
      text.append(`${chapter.label}: ${chapter.title}`);
      count.textContent = `${chapter.count} exercises`;
      text.append(count);
      label.append(input, text);
      return label;
    }),
  );

  const visibleSections = data.chapters
    .filter((chapter) => selectedChapters.has(chapter.id))
    .flatMap((chapter) =>
      chapter.sections.map((section) => ({
        ...section,
        chapterLabel: chapter.label,
      })),
    );

  els.sectionFilters.replaceChildren(
    ...visibleSections.map((section) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      const text = document.createElement("span");
      const count = document.createElement("small");

      label.className = "checkItem";
      input.type = "checkbox";
      input.value = section.id;
      input.checked = selectedSections.has(section.id);
      text.className = "checkText";
      text.append(`${section.id} ${section.title}`);
      count.textContent = `${section.chapterLabel} - ${section.count} exercises`;
      text.append(count);
      label.append(input, text);
      return label;
    }),
  );

  els.orderControls.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.order === state.order);
  });

  els.difficultyFilter.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.difficulty);
  });
}

function renderSummary() {
  const ratings = Object.values(state.ratings);
  const hard = ratings.filter((value) => value === "hard").length;
  const normal = ratings.filter((value) => value === "normal").length;
  const easy = ratings.filter((value) => value === "easy").length;
  const rated = hard + normal + easy;
  els.sessionSummary.textContent = `${data.total} exercises - ${queue.length} in this set - ${rated} rated - ${hard} hard - ${normal} normal - ${easy} easy`;
}

function renderStudy() {
  const exercise = currentExercise();
  const hasExercise = Boolean(exercise);

  els.emptyState.hidden = hasExercise;
  els.exerciseImage.hidden = !hasExercise;
  els.answerBtn.disabled = !hasExercise;
  els.prevBtn.disabled = !hasExercise;
  els.nextBtn.disabled = !hasExercise;
  els.rating.querySelectorAll("button").forEach((button) => {
    button.disabled = !hasExercise;
    button.classList.remove("active");
  });

  if (!exercise) {
    els.exerciseTitle.textContent = "No exercises";
    els.exerciseMeta.textContent = "";
    els.queueCounter.textContent = "0 / 0";
    els.answerPanel.hidden = true;
    return;
  }

  const chapter = chapterById(exercise.chapterId);
  const rating = exerciseRating(exercise.id);
  els.exerciseTitle.textContent = exercise.title;
  els.exerciseMeta.textContent = `${chapter.title} - ${exercise.sectionId} ${exercise.sectionTitle} - page ${exercise.page}`;
  els.queueCounter.textContent = `${currentIndex + 1} / ${queue.length}`;
  els.exerciseImage.src = `${exercise.image}?v=${encodeURIComponent(data.generatedAt || data.total)}`;
  els.exerciseImage.alt = exercise.title;

  els.answerPanel.textContent = exercise.solution || "No printed solution in the PDF.";
  els.answerPanel.hidden = !answerVisible;
  els.answerBtn.textContent = answerVisible ? "Hide answer" : "Show answer";

  const activeRating = els.rating.querySelector(`[data-rate="${rating}"]`);
  if (activeRating) activeRating.classList.add("active");
}

function move(delta) {
  if (!queue.length) return;
  currentIndex = (currentIndex + delta + queue.length) % queue.length;
  answerVisible = false;
  renderStudy();
}

function rateCurrent(value) {
  const exercise = currentExercise();
  if (!exercise) return;
  state.ratings[exercise.id] = value;
  saveState();
  renderStudy();
  renderSummary();
}

function bindEvents() {
  els.chapterFilters.addEventListener("change", (event) => {
    if (event.target.tagName !== "INPUT") return;
    state.chapters = setSelected(
      state.chapters,
      event.target.value,
      event.target.checked,
    );
    if (!state.chapters.length) state.chapters = allChapterIds();
    saveState();
    renderControls();
    currentIndex = 0;
    rebuildQueue();
  });

  els.sectionFilters.addEventListener("change", (event) => {
    if (event.target.tagName !== "INPUT") return;
    state.sections = setSelected(
      state.sections,
      event.target.value,
      event.target.checked,
    );
    if (!state.sections.length) state.sections = allSectionIds();
    saveState();
    renderControls();
    currentIndex = 0;
    rebuildQueue();
  });

  els.allChaptersBtn.addEventListener("click", () => {
    state.chapters = allChapterIds();
    saveState();
    renderControls();
    currentIndex = 0;
    rebuildQueue();
  });

  els.allSectionsBtn.addEventListener("click", () => {
    state.sections = allSectionIds();
    saveState();
    renderControls();
    currentIndex = 0;
    rebuildQueue();
  });

  els.orderControls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-order]");
    if (!button) return;
    const nextOrder = button.dataset.order;
    const preferredId = nextOrder === "ordered" ? currentExercise()?.id : null;
    state.order = nextOrder;
    saveState();
    renderControls();
    if (!preferredId) currentIndex = 0;
    rebuildQueue(preferredId);
  });

  els.difficultyFilter.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    state.difficulty = button.dataset.filter;
    saveState();
    renderControls();
    currentIndex = 0;
    rebuildQueue();
  });

  els.reshuffleBtn.addEventListener("click", () => {
    const preferredId = state.order === "ordered" ? currentExercise()?.id : null;
    rebuildQueue(preferredId);
  });

  els.clearBtn.addEventListener("click", () => {
    if (!window.confirm("Clear saved ratings for these exercises?")) return;
    state.ratings = {};
    saveState();
    rebuildQueue(currentExercise()?.id);
  });

  els.prevBtn.addEventListener("click", () => move(-1));
  els.nextBtn.addEventListener("click", () => move(1));
  els.answerBtn.addEventListener("click", () => {
    answerVisible = !answerVisible;
    renderStudy();
  });

  els.rating.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-rate]");
    if (!button) return;
    rateCurrent(button.dataset.rate);
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.tagName === "INPUT") return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "1") {
      rateCurrent("easy");
    } else if (event.key === "2") {
      rateCurrent("normal");
    } else if (event.key === "3") {
      rateCurrent("hard");
    } else if (event.key.toLowerCase() === "a") {
      answerVisible = !answerVisible;
      renderStudy();
    }
  });
}

async function init() {
  const response = await fetch("data/exercises.json");
  data = await response.json();
  loadState();
  ensureDefaults();
  bindEvents();
  renderControls();
  rebuildQueue();
}

init().catch((error) => {
  console.error(error);
  els.sessionSummary.textContent = "Could not load exercises.";
  els.exerciseTitle.textContent = "Load failed";
  els.exerciseMeta.textContent = "Start this through a local web server so the JSON file can be fetched.";
});
