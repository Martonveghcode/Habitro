import ReactMarkdown from "react-markdown";

import { usePracticeStore } from "../store/usePracticeStore";
import type { ErrorCategory } from "../types/syntax";

interface FeedbackPanelProps {
  onGrade: () => Promise<void>;
  onSave: () => Promise<void>;
  isSaving: boolean;
  saved: boolean;
}

const categoryLabel: Record<ErrorCategory, string> = {
  pos: "Categoria gramatical",
  function: "Funcion",
  grouping: "Agrupacion",
  sentenceType: "Tipo de oracion",
  punctuation: "Puntuacion",
};

export function FeedbackPanel({ onGrade, onSave, isSaving, saved }: FeedbackPanelProps) {
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
            <ReactMarkdown>{gradeResult.correctedAnswerMarkdown || gradeResult.feedbackMarkdown}</ReactMarkdown>
          </div>

          <div className="review-list">
            <h3>Revision por bloques</h3>
            {gradeResult.reviewItems.length === 0 ? (
              <p className="muted">Sin items de revision.</p>
            ) : (
              <ul>
                {gradeResult.reviewItems.map((item, index) => (
                  <li
                    key={`${item.title}_${index}`}
                    className={item.status === "correct" ? "review-item ok" : "review-item bad"}
                  >
                    <strong>{item.title}</strong>
                    {item.spanStart && item.spanEnd ? (
                      <span className="muted">
                        {" "}
                        (tramo {item.spanStart}-{item.spanEnd})
                      </span>
                    ) : null}
                    <div>{item.detail}</div>
                  </li>
                ))}
              </ul>
            )}
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

          <button
            type="button"
            className="primary-btn"
            onClick={onSave}
            disabled={isSaving || saved || gradeResult.errors.length === 0}
          >
            {saved ? "Guardado en base de datos" : isSaving ? "Guardando..." : "Guardar para modo personalizado"}
          </button>
        </>
      ) : null}
    </section>
  );
}
