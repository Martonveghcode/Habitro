import ReactMarkdown from "react-markdown";

import { usePracticeStore } from "../store/usePracticeStore";

interface FeedbackPanelProps {
  onGrade: () => Promise<void>;
}

export function FeedbackPanel({ onGrade }: FeedbackPanelProps) {
  const gradeResult = usePracticeStore((state) => state.gradeResult);
  const isGrading = usePracticeStore((state) => state.isGrading);

  return (
    <section className="panel feedback-panel">
      <header className="panel-header">
        <h2>Correccion</h2>
      </header>

      <button type="button" className="primary-btn" onClick={onGrade} disabled={isGrading}>
        {isGrading ? "Corrigiendo..." : "Corregir"}
      </button>

      {!gradeResult ? <p className="muted">Sin correccion aun.</p> : null}
      {gradeResult ? (
        <>
          <div className="feedback-markdown">
            <ReactMarkdown>{gradeResult.feedbackMarkdown}</ReactMarkdown>
          </div>
          <div className="error-list">
            <h3>Errores detectados</h3>
            {gradeResult.errors.length === 0 ? (
              <p className="success-text">Sin errores.</p>
            ) : (
              <ul>
                {gradeResult.errors.map((error, index) => (
                  <li key={`${error.error_code}_${index}`}>
                    <strong>{error.error_code}</strong> [{error.category}] ({error.severity}) span{" "}
                    {error.spanStart}-{error.spanEnd}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
