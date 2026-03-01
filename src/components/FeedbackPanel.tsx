import ReactMarkdown from "react-markdown";

import { usePracticeStore } from "../store/usePracticeStore";
import type { ErrorCategory } from "../types/syntax";

interface FeedbackPanelProps {
  onGrade: () => Promise<void>;
}

const categoryLabel: Record<ErrorCategory, string> = {
  pos: "Categoria gramatical",
  function: "Funcion",
  grouping: "Agrupacion",
  sentenceType: "Tipo de oracion",
  punctuation: "Puntuacion",
};

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
              <p className="success-text">Sin errores detectados.</p>
            ) : (
              <ul>
                {gradeResult.errors.map((error, index) => (
                  <li key={`${error.error_code}_${index}`}>
                    <strong>{error.error_code}</strong> [{categoryLabel[error.category]}] ({error.severity}) tramo{" "}
                    {error.spanStart}-{error.spanEnd}
                    {error.expected !== null || error.got !== null ? (
                      <div className="muted">
                        Esperado: {error.expected ?? "-"} | Tu analisis: {error.got ?? "-"}
                      </div>
                    ) : null}
                    {error.explanation ? <div className="muted">{error.explanation}</div> : null}
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
