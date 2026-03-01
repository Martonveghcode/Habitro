import type { ErrorDocument, UserAnalyticsSummary } from "../types/firestore";

interface AnalyticsPanelProps {
  summary: UserAnalyticsSummary | null;
  recentErrors: Array<ErrorDocument & { id: string }>;
}

const categoryLabel: Record<ErrorDocument["category"], string> = {
  pos: "Categoria gramatical",
  function: "Funcion",
  grouping: "Agrupacion",
  sentenceType: "Tipo de oracion",
  punctuation: "Puntuacion",
};

export function AnalyticsPanel({ summary, recentErrors }: AnalyticsPanelProps) {
  const errorsByCode = summary?.errorsByCode ?? {};
  const errorsByCategory = summary?.errorsByCategory ?? {
    pos: 0,
    function: 0,
    grouping: 0,
    sentenceType: 0,
    punctuation: 0,
  };

  const topCodes = summary
    ? Object.entries(errorsByCode)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];

  return (
    <section className="panel analytics-panel">
      <header className="panel-header">
        <h2>Analitica personal</h2>
      </header>

      {!summary ? (
        <p className="muted">Aun no hay resumen para este usuario.</p>
      ) : (
        <>
          <div className="summary-grid">
            <article>
              <span>Total errores</span>
              <strong>{summary.totalErrors}</strong>
            </article>
            <article>
              <span>Ultimos 30 dias</span>
              <strong>{summary.last30dCount}</strong>
            </article>
            <article>
              <span>Funcion</span>
              <strong>{errorsByCategory.function}</strong>
            </article>
            <article>
              <span>Agrupacion</span>
              <strong>{errorsByCategory.grouping}</strong>
            </article>
          </div>

          <div className="top-codes">
            <h3>Codigos frecuentes</h3>
            {topCodes.length === 0 ? (
              <p className="muted">Sin codigos aun.</p>
            ) : (
              <ul>
                {topCodes.map(([code, count]) => (
                  <li key={code}>
                    {code}: {count}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="recent-errors">
        <h3>Ultimos 20 errores</h3>
        {recentErrors.length === 0 ? (
          <p className="muted">No hay errores guardados.</p>
        ) : (
          <ul>
            {recentErrors.map((error) => (
              <li key={error.id}>
                {error.error_code} [{categoryLabel[error.category]}] d{error.difficulty} tramo {error.spanStart}-
                {error.spanEnd}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
