import type { User } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";

import "./style.css";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { AnnotationCanvas } from "./components/AnnotationCanvas";
import { AuthGate } from "./components/AuthGate";
import { ControlsPanel } from "./components/ControlsPanel";
import { FeedbackPanel } from "./components/FeedbackPanel";
import { SentenceWorkspace } from "./components/SentenceWorkspace";
import { generateSentence, gradeAttempt } from "./lib/api";
import { getLastErrors, readAnalyticsSummary, saveErrors } from "./lib/firestore";
import { toSentenceTokens, tokenizeFallback } from "./lib/tokenize";
import { usePracticeStore } from "./store/usePracticeStore";
import type { ErrorDocument, UserAnalyticsSummary } from "./types/firestore";
import type { UserAnalysisPayload } from "./types/syntax";

function PracticePage({ user }: { user: User }) {
  const settings = usePracticeStore((state) => state.settings);
  const sentenceState = usePracticeStore((state) => state.sentenceState);
  const tokenPosAssignments = usePracticeStore((state) => state.tokenPosAssignments);
  const annotations = usePracticeStore((state) => state.annotations);
  const sentenceTypeBuild = usePracticeStore((state) => state.sentenceTypeBuild);
  const setSentenceData = usePracticeStore((state) => state.setSentenceData);
  const setGenerating = usePracticeStore((state) => state.setGenerating);
  const setGrading = usePracticeStore((state) => state.setGrading);
  const setGradeResult = usePracticeStore((state) => state.setGradeResult);
  const setErrorMessage = usePracticeStore((state) => state.setErrorMessage);
  const errorMessage = usePracticeStore((state) => state.errorMessage);
  const [summary, setSummary] = useState<UserAnalyticsSummary | null>(null);
  const [recentErrors, setRecentErrors] = useState<Array<ErrorDocument & { id: string }>>([]);

  const weaknessSummary = useMemo(() => {
    if (!summary || !settings.personalizedMode) {
      return undefined;
    }
    const top = Object.entries(summary.errorsByCode)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code]) => code);

    if (top.length === 0) {
      return undefined;
    }

    return `Top weak error codes: ${top.join(", ")}`;
  }, [settings.personalizedMode, summary]);

  const refreshAnalytics = async () => {
    const [nextSummary, nextErrors] = await Promise.all([readAnalyticsSummary(user), getLastErrors(user, 20)]);
    setSummary(nextSummary);
    setRecentErrors(nextErrors);
  };

  useEffect(() => {
    void refreshAnalytics();
  }, []);

  const handleGenerateSentence = async () => {
    setGenerating(true);
    setErrorMessage(null);
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

      if (grade.errors.length > 0) {
        await saveErrors(user, settings.sentenceType, settings.difficulty, grade.errors);
      }

      await refreshAnalytics();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo corregir.");
    } finally {
      setGrading(false);
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
          <AnalyticsPanel summary={summary} recentErrors={recentErrors} />
        </div>
        <div className="main-column">
          <SentenceWorkspace />
          <AnnotationCanvas />
          <FeedbackPanel onGrade={handleGrade} />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return <AuthGate>{(user) => <PracticePage user={user} />}</AuthGate>;
}
