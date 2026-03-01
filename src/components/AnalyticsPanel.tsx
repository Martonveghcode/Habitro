import type { ErrorDocument, UserAnalyticsSummary } from "../types/firestore";

interface AnalyticsPanelProps {
  summary: UserAnalyticsSummary | null;
  recentErrors: Array<ErrorDocument & { id: string }>;
}

export function AnalyticsPanel({ summary, recentErrors }: AnalyticsPanelProps) {
  const topCodes = summary
    ? Object.entries(summary.errorsByCode)
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
              <strong>{summary.errorsByCategory.function}</strong>
            </article>
            <article>
              <span>Grouping</span>
              <strong>{summary.errorsByCategory.grouping}</strong>
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
                {error.error_code} [{error.category}] d{error.difficulty} span {error.spanStart}-{error.spanEnd}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
