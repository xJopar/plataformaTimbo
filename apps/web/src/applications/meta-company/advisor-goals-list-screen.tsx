import { useEffect, useState } from 'react';
import { fetchMonthGoals, saveMonthGoal, type MonthGoal } from './meta-company-mock-data';
import type { Advisor } from './meta-company-types';
import { MonthGoalRow } from './month-goal-row';
import { YearFilter } from './year-filter';

interface AdvisorGoalsListScreenProps {
  advisors: Advisor[];
  year: number;
  onYearChange: (year: number) => void;
  canEdit: boolean;
  onSelectAdvisor: (advisorId: number) => void;
}

export function AdvisorGoalsListScreen({
  advisors,
  year,
  onYearChange,
  canEdit,
  onSelectAdvisor,
}: AdvisorGoalsListScreenProps): React.JSX.Element {
  const [monthsByAdvisor, setMonthsByAdvisor] = useState<Record<number, MonthGoal[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void Promise.all(
      advisors.map(async (advisor) => [advisor.id, await fetchMonthGoals('advisor', advisor.id, year)] as const),
    ).then((entries) => {
      if (!cancelled) {
        setMonthsByAdvisor(Object.fromEntries(entries));
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [advisors, year]);

  const saveMonth = async (advisorId: number, periodo: string, value: string): Promise<void> => {
    setSavingKey(`${advisorId}-${periodo}`);
    const savedMonth = await saveMonthGoal('advisor', advisorId, periodo, value);
    setMonthsByAdvisor((current) => ({
      ...current,
      [advisorId]: (current[advisorId] ?? []).map((month) =>
        month.periodo === periodo ? savedMonth : month,
      ),
    }));
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
      {!isLoading && advisors.length === 0 ? (
        <section className="mc-empty">
          <h2>No hay asesores activos</h2>
          <p>Creá un asesor desde "Gestionar asesores" para poder cargarle metas acá.</p>
        </section>
      ) : null}

      <ul className="mc-advisor-list">
        {advisors.map((advisor) => (
          <li key={advisor.id}>
            <details className="mc-advisor-accordion">
              <summary
                className="mc-advisor-summary"
                aria-label={`Ver los 12 meses de ${advisor.displayName}`}
              >
                <span aria-hidden="true" className="mc-advisor-disclosure">
                  ›
                </span>
                <button
                  type="button"
                  className="mc-text-action"
                  aria-label={`Ver detalle de ${advisor.displayName}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectAdvisor(advisor.id);
                  }}
                >
                  {advisor.displayName}
                </button>
              </summary>
              <div className="mc-advisor-months">
                {(monthsByAdvisor[advisor.id] ?? []).map((month) => (
                  <MonthGoalRow
                    key={month.periodo}
                    month={month}
                    canEdit={canEdit}
                    isSaving={savingKey === `${advisor.id}-${month.periodo}`}
                    onSave={(periodo, value) => void saveMonth(advisor.id, periodo, value)}
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
