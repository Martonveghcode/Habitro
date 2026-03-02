import type { User } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";

import "./style.css";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { AnnotationCanvas } from "./components/AnnotationCanvas";
import { AuthGate } from "./components/AuthGate";
import { ControlsPanel } from "./components/ControlsPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { FeedbackPanel } from "./components/FeedbackPanel";
import { SentenceWorkspace } from "./components/SentenceWorkspace";
import { generateSentence, gradeAttempt } from "./lib/api";
import {
  getLastErrors,
  readAnalyticsSummary,
  readPracticePreferences,
  saveErrors,
  savePracticePreferences,
} from "./lib/firestore";
import { toSentenceTokens, tokenizeFallback } from "./lib/tokenize";
import { usePracticeStore } from "./store/usePracticeStore";
import type { ErrorDocument, UserAnalyticsSummary } from "./types/firestore";
import type { UserAnalysisPayload } from "./types/syntax";

const normalizeTopics = (topics: string[]) => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  topics.forEach((topic) => {
    const cleaned = topic.trim();
    if (!cleaned) {
      return;
    }
    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    normalized.push(cleaned);
  });
  return normalized;
};

const normalizeAnnotationLabels = (labels: Record<string, string[]>) => {
  const normalizeList = (entries: string[]) => normalizeTopics(entries);
  return {
    wordFunction: normalizeList(labels.wordFunction ?? []),
    groupFunction: normalizeList(labels.groupFunction ?? []),
    clause: normalizeList(labels.clause ?? []),
    sentenceType: normalizeList(labels.sentenceType ?? []),
  };
};

function PracticePage({ user }: { user: User }) {
  const settings = usePracticeStore((state) => state.settings);
  const customFocusTopics = usePracticeStore((state) => state.customFocusTopics);
  const customAnnotationLabels = usePracticeStore((state) => state.customAnnotationLabels);
  const sentenceState = usePracticeStore((state) => state.sentenceState);
  const tokenPosAssignments = usePracticeStore((state) => state.tokenPosAssignments);
  const annotations = usePracticeStore((state) => state.annotations);
  const sentenceTypeBuild = usePracticeStore((state) => state.sentenceTypeBuild);
  const setFocusTopics = usePracticeStore((state) => state.setFocusTopics);
  const setCustomFocusTopics = usePracticeStore((state) => state.setCustomFocusTopics);
  const setCustomAnnotationLabels = usePracticeStore((state) => state.setCustomAnnotationLabels);
  const setSentenceData = usePracticeStore((state) => state.setSentenceData);
  const setGenerating = usePracticeStore((state) => state.setGenerating);
  const setGrading = usePracticeStore((state) => state.setGrading);
  const setGradeResult = usePracticeStore((state) => state.setGradeResult);
  const gradeResult = usePracticeStore((state) => state.gradeResult);
  const setErrorMessage = usePracticeStore((state) => state.setErrorMessage);
  const errorMessage = usePracticeStore((state) => state.errorMessage);
  const [summary, setSummary] = useState<UserAnalyticsSummary | null>(null);
  const [recentErrors, setRecentErrors] = useState<Array<ErrorDocument & { id: string }>>([]);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [isCorrectionSaved, setIsCorrectionSaved] = useState(false);

  const weaknessSummary = useMemo(() => {
    if (!summary || !settings.personalizedMode) {
      return undefined;
    }
    const top = Object.entries(summary.errorsByCode ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code]) => code);

    if (top.length === 0) {
      return undefined;
    }

    return `Codigos de error mas frecuentes: ${top.join(", ")}`;
  }, [settings.personalizedMode, summary]);

  const refreshAnalytics = async () => {
    try {
      const [nextSummary, nextErrors] = await Promise.all([readAnalyticsSummary(user), getLastErrors(user, 20)]);
      setSummary(nextSummary);
      setRecentErrors(nextErrors);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar la analitica.");
    }
  };

  useEffect(() => {
    void refreshAnalytics();
  }, [user.uid]);

  useEffect(() => {
    let isCancelled = false;
    setPreferencesLoaded(false);

    const loadPreferences = async () => {
      try {
        const preferences = await readPracticePreferences(user);
        if (isCancelled) {
          return;
        }
        if (preferences) {
          setCustomFocusTopics(normalizeTopics(preferences.customFocusTopics));
          setFocusTopics(normalizeTopics(preferences.selectedFocusTopics));
          setCustomAnnotationLabels(normalizeAnnotationLabels(preferences.customAnnotationLabels));
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar las preferencias.");
        }
      } finally {
        if (!isCancelled) {
          setPreferencesLoaded(true);
        }
      }
    };

    void loadPreferences();

    return () => {
      isCancelled = true;
    };
  }, [user.uid]);

  useEffect(() => {
    if (!preferencesLoaded) {
      return;
    }

    void savePracticePreferences(user, {
      customFocusTopics: normalizeTopics(customFocusTopics),
      selectedFocusTopics: normalizeTopics(settings.focusTopics),
      customAnnotationLabels: normalizeAnnotationLabels(customAnnotationLabels),
    }).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron guardar las preferencias.");
    });
  }, [customAnnotationLabels, customFocusTopics, preferencesLoaded, settings.focusTopics, user.uid]);

  const handleGenerateSentence = async () => {
    setGenerating(true);
    setErrorMessage(null);
    setIsCorrectionSaved(false);
    try {
      const response = await generateSentence(user, {
        sentenceType: settings.sentenceType,
        difficulty: settings.difficulty,
        focusTopics: settings.focusTopics,
        punctuationPolicy: {
          simplify: settings.simplifyPunctuation,
          excludeMarksFromLabeling: settings.simplifyPunctuation,
        },
        weaknessSummary,
      });

      const rawTokens = response.tokens.length > 0 ? response.tokens : tokenizeFallback(response.sentence);

      setSentenceData({
        sentenceId: `gen_${Date.now()}`,
        sentence: response.sentence,
        tokens: toSentenceTokens(rawTokens),
        targetFeatures: response.targetFeatures,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo generar la oracion.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGrade = async () => {
    if (!sentenceState.sentence || sentenceState.tokens.length === 0) {
      setErrorMessage("Genera una oracion antes de corregir.");
      return;
    }

    setGrading(true);
    setErrorMessage(null);
    setIsCorrectionSaved(false);

    try {
      const analysis: UserAnalysisPayload = {
        sentenceId: sentenceState.sentenceId ?? `manual_${Date.now()}`,
        sentence: sentenceState.sentence,
        sentenceType: settings.sentenceType,
        difficulty: settings.difficulty,
        focusTopics: settings.focusTopics,
        settings: {
          showPosRow: settings.showPosRow,
          simplifyPunctuation: settings.simplifyPunctuation,
          compactLayout: settings.compactLayout,
        },
        tokens: sentenceState.tokens,
        tokenPosAssignments,
        annotations,
        sentenceTypeBuild,
      };

      const grade = await gradeAttempt(user, {
        sentence: sentenceState.sentence,
        tokens: sentenceState.tokens.map((token) => token.text),
        practiceSettings: {
          sentenceType: settings.sentenceType,
          difficulty: settings.difficulty,
          focusTopics: settings.focusTopics,
          simplifyPunctuation: settings.simplifyPunctuation,
        },
        analysis,
      });

      setGradeResult(grade);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo corregir.");
    } finally {
      setGrading(false);
    }
  };

  const handleSaveCorrection = async () => {
    if (!gradeResult || gradeResult.errors.length === 0) {
      setIsCorrectionSaved(true);
      return;
    }

    setIsSavingCorrection(true);
    setErrorMessage(null);
    try {
      await saveErrors(user, settings.sentenceType, settings.difficulty, gradeResult.errors);
      await refreshAnalytics();
      setIsCorrectionSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar la correccion.");
    } finally {
      setIsSavingCorrection(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="hud-header">
        <h1>Sintaxis WebApp</h1>
        <p>
          UID: <code>{user.uid}</code>
        </p>
      </header>

      {errorMessage ? <div className="alert error-text">{errorMessage}</div> : null}

      <main className="layout">
        <div className="left-column">
          <ControlsPanel onGenerateSentence={handleGenerateSentence} />
          {settings.showAnalyticsPanel ? <AnalyticsPanel summary={summary} recentErrors={recentErrors} /> : null}
        </div>
        <div className="main-column">
          <SentenceWorkspace />
          <AnnotationCanvas />
          {settings.showFeedbackPanel ? (
            <FeedbackPanel
              onGrade={handleGrade}
              onSave={handleSaveCorrection}
              isSaving={isSavingCorrection}
              saved={isCorrectionSaved}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthGate>{(user) => <PracticePage user={user} />}</AuthGate>
    </ErrorBoundary>
  );
}
