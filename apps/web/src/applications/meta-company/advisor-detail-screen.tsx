import { useEffect, useState } from 'react';
import {
  fetchAdvisorMetas,
  fetchAdvisorName,
  saveAdvisorMonthGoal,
  type AdvisorMonthGoal,
} from './meta-company-mock-data';
import { MonthGoalRow } from './month-goal-row';
import { YearFilter } from './year-filter';

interface AdvisorDetailScreenProps {
  advisorId: number;
  year: number;
  canEdit: boolean;
  onNavigateYear: (year: number) => void;
}

export function AdvisorDetailScreen({
  advisorId,
  year,
  canEdit,
  onNavigateYear,
}: AdvisorDetailScreenProps): React.JSX.Element {
  const [advisorName, setAdvisorName] = useState<string>();
  const [months, setMonths] = useState<AdvisorMonthGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingPeriodo, setSavingPeriodo] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void Promise.all([fetchAdvisorName(advisorId), fetchAdvisorMetas(advisorId, year)]).then(
      ([name, metas]) => {
        if (!cancelled) {
          setAdvisorName(name);
          setMonths(metas);
          setIsLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [advisorId, year]);

  const saveMonth = async (periodo: string, value: string): Promise<void> => {
    setSavingPeriodo(periodo);
    const savedMonth = await saveAdvisorMonthGoal(advisorId, periodo, value);
    setMonths((current) =>
      current.map((month) => (month.periodo === periodo ? savedMonth : month)),
    );
    setSavingPeriodo(undefined);
  };

  return (
    <section className="mc-advisor-detail" aria-labelledby="mc-advisor-detail-title">
      <div className="mc-workbench-heading">
        <div>
          <h2 id="mc-advisor-detail-title">{advisorName ?? 'Asesor'}</h2>
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
