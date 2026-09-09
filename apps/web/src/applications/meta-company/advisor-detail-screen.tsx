import { useEffect, useState } from 'react';
import { fetchMonthGoals, saveMonthGoal, type MonthGoal } from './meta-company-mock-data';
import type { Advisor } from './meta-company-types';
import { MonthGoalRow } from './month-goal-row';
import { YearFilter } from './year-filter';

interface AdvisorDetailScreenProps {
  advisorId: number;
  advisors: Advisor[];
  year: number;
  canEdit: boolean;
  onNavigateYear: (year: number) => void;
}

export function AdvisorDetailScreen({
  advisorId,
  advisors,
  year,
  canEdit,
  onNavigateYear,
}: AdvisorDetailScreenProps): React.JSX.Element {
  const [months, setMonths] = useState<MonthGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingPeriodo, setSavingPeriodo] = useState<string>();

  const advisor = advisors.find((item) => item.id === advisorId);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void fetchMonthGoals('advisor', advisorId, year).then((metas) => {
      if (!cancelled) {
        setMonths(metas);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [advisorId, year]);

  const saveMonth = async (periodo: string, value: string): Promise<void> => {
    setSavingPeriodo(periodo);
    const savedMonth = await saveMonthGoal('advisor', advisorId, periodo, value);
    setMonths((current) =>
      current.map((month) => (month.periodo === periodo ? savedMonth : month)),
    );
    setSavingPeriodo(undefined);
  };

  if (advisor === undefined) {
    return (
      <section className="mc-empty">
        <h2>Asesor no encontrado</h2>
        <p>Puede que haya sido desactivado. Volvé a la lista de asesores e intentá de nuevo.</p>
      </section>
    );
  }

  return (
    <section className="mc-advisor-detail" aria-labelledby="mc-advisor-detail-title">
      <div className="mc-workbench-heading">
        <div>
          <h2 id="mc-advisor-detail-title">{advisor.displayName}</h2>
          <p>Recorré los años del asesor y editá sus metas mensuales.</p>
        </div>
        <YearFilter year={year} onChange={onNavigateYear} />
      </div>

      {isLoading ? (
        <p className="mc-state">Cargando metas…</p>
      ) : (
        <div className="mc-advisor-months mc-advisor-detail-months">
          {months.map((month) => (
            <MonthGoalRow
              key={month.periodo}
              month={month}
              canEdit={canEdit}
              isSaving={savingPeriodo === month.periodo}
              onSave={(periodo, value) => void saveMonth(periodo, value)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
