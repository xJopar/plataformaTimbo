import { useEffect, useState } from 'react';
import {
  fetchAdvisorsAnnualSummary,
  saveAdvisorMonthGoal,
  type AdvisorAnnualSummary,
} from './meta-company-mock-data';
import { MonthGoalRow } from './month-goal-row';
import { YearFilter } from './year-filter';

interface AdvisorGoalsListScreenProps {
  year: number;
  onYearChange: (year: number) => void;
  canEdit: boolean;
  onSelectAdvisor: (advisorId: number) => void;
}

export function AdvisorGoalsListScreen({
  year,
  onYearChange,
  canEdit,
  onSelectAdvisor,
}: AdvisorGoalsListScreenProps): React.JSX.Element {
  const [summaries, setSummaries] = useState<AdvisorAnnualSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void fetchAdvisorsAnnualSummary(year).then((result) => {
      if (!cancelled) {
        setSummaries(result);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const saveMonth = async (advisorId: number, periodo: string, value: string): Promise<void> => {
    setSavingKey(`${advisorId}-${periodo}`);
    const savedMonth = await saveAdvisorMonthGoal(advisorId, periodo, value);
    setSummaries((current) =>
      current.map((summary) =>
        summary.id_asesor === advisorId
          ? {
              ...summary,
              meses: summary.meses.map((month) =>
                month.periodo === periodo ? savedMonth : month,
              ),
            }
          : summary,
      ),
    );
    setSavingKey(undefined);
  };

  return (
    <section className="mc-advisor-goals" aria-labelledby="mc-advisor-goals-title">
      <div className="mc-workbench-heading">
        <div>
          <h2 id="mc-advisor-goals-title">Metas por asesor</h2>
          <p>Desplegá un asesor para ver sus 12 meses, o entrá a su detalle para recorrer otros años.</p>
        </div>
        <YearFilter year={year} onChange={onYearChange} />
      </div>

      {isLoading ? <p className="mc-state">Cargando asesores…</p> : null}
      {!isLoading && summaries.length === 0 ? (
        <section className="mc-empty">
          <h2>No hay asesores para mostrar</h2>
          <p>Probá con otro año.</p>
        </section>
      ) : null}

      <ul className="mc-advisor-list">
        {summaries.map((summary) => (
          <li key={summary.id_asesor}>
            <details className="mc-advisor-accordion">
              <summary
                className="mc-advisor-summary"
                aria-label={`Ver los 12 meses de ${summary.asesor}`}
              >
                <span aria-hidden="true" className="mc-advisor-disclosure">
                  ›
                </span>
                <button
                  type="button"
                  className="mc-text-action"
                  aria-label={`Ver detalle de ${summary.asesor}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectAdvisor(summary.id_asesor);
                  }}
                >
                  {summary.asesor}
                </button>
              </summary>
              <div className="mc-advisor-months">
                {summary.meses.map((month) => (
                  <MonthGoalRow
                    key={month.periodo}
                    month={month}
                    canEdit={canEdit}
                    isSaving={savingKey === `${summary.id_asesor}-${month.periodo}`}
                    onSave={(periodo, value) => void saveMonth(summary.id_asesor, periodo, value)}
                  />
                ))}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
