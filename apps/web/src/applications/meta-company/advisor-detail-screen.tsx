import { useEffect, useState } from 'react';
import { ApiHttpError } from '../../api/system';
import type { ApplicationComponentProps } from '../application-component';
import type { Advisor } from './meta-company-types';
import { formatMoney, formatMonthLabel, parseMoneyInput } from './month-goal-row';
import { YearFilter } from './year-filter';

type AdvisorGoal = Awaited<
  ReturnType<ApplicationComponentProps['api']['applications']['listMetaCompanyGoals']>
>[number];

interface AdvisorMonth {
  period: string;
  goals: AdvisorGoal[];
}

interface AdvisorDetailScreenProps {
  advisorId: number;
  advisors: Advisor[];
  applicationsApi: ApplicationComponentProps['api']['applications'];
  year: number;
  canEdit: boolean;
  onNavigateYear: (year: number) => void;
}

export function AdvisorDetailScreen({
  advisorId,
  advisors,
  applicationsApi,
  year,
  canEdit,
  onNavigateYear,
}: AdvisorDetailScreenProps): React.JSX.Element {
  const [months, setMonths] = useState<AdvisorMonth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [savingGoalId, setSavingGoalId] = useState<number>();
  const [reloadVersion, setReloadVersion] = useState(0);

  const advisor = advisors.find((item) => item.id === advisorId);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(undefined);

    void applicationsApi
      .listMetaCompanyGoals(String(year))
      .then((goals) => {
        if (!cancelled) {
          setMonths(buildAdvisorMonths(goals, advisorId, year));
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        const requestId = error instanceof ApiHttpError ? error.requestId : undefined;
        console.error('No fue posible cargar las metas del asesor desde la API.', {
          advisorId,
          year,
          requestId,
        });
        if (!cancelled) {
          setLoadError('No pudimos cargar las metas del asesor. Intentá nuevamente.');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [advisorId, applicationsApi, reloadVersion, year]);

  const saveGoal = async (goalId: number, value: string): Promise<void> => {
    setSavingGoalId(goalId);
    setLoadError(undefined);
    try {
      const updatedGoal = await applicationsApi.updateMetaCompanyAdvisorGoal(goalId, value);
      setMonths((current) =>
        current.map((month) => ({
          ...month,
          goals: month.goals.map((goal) =>
            goal.id === goalId ? { ...goal, value: updatedGoal.value } : goal,
          ),
        })),
      );
    } catch (error: unknown) {
      const requestId = error instanceof ApiHttpError ? error.requestId : undefined;
      console.error('No fue posible guardar la meta del asesor desde la API.', {
        goalId,
        requestId,
      });
      setLoadError('No pudimos guardar la meta. Revisá el valor e intentá nuevamente.');
    } finally {
      setSavingGoalId(undefined);
    }
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
          <p>Desplegá cada mes para ver y editar sus metas separadas por marca.</p>
        </div>
        <YearFilter year={year} onChange={onNavigateYear} />
      </div>

      {loadError === undefined ? null : (
        <section className="mc-error" role="alert">
          <p>{loadError}</p>
          <button
            type="button"
            className="mc-text-action"
            onClick={() => setReloadVersion((value) => value + 1)}
          >
            Reintentar carga
          </button>
        </section>
      )}
      {isLoading ? <p className="mc-state">Cargando metas por marca…</p> : null}
      {!isLoading ? (
        <div className="mc-advisor-detail-months">
          {months.map((month) => (
            <details
              key={month.period}
              className="mc-advisor-month"
              open={month.period === `${String(year)}-01-01`}
            >
              <summary className="mc-advisor-month-summary">
                <span>{formatMonthLabel(month.period)}</span>
                <span className="mc-advisor-month-count">
                  {month.goals.length === 1 ? '1 marca' : `${String(month.goals.length)} marcas`}
                </span>
              </summary>
              {month.goals.length === 0 ? (
                <p className="mc-state">No hay metas cargadas para este mes.</p>
              ) : (
                <div className="mc-advisor-month-brands">
                  {month.goals.map((goal) => (
                    <AdvisorBrandGoalRow
                      key={goal.id}
                      goal={goal}
                      canEdit={canEdit}
                      isSaving={savingGoalId === goal.id}
                      onSave={saveGoal}
                    />
                  ))}
                </div>
              )}
            </details>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AdvisorBrandGoalRow({
  goal,
  canEdit,
  isSaving,
  onSave,
}: {
  goal: AdvisorGoal;
  canEdit: boolean;
  isSaving: boolean;
  onSave: (goalId: number, value: string) => Promise<void>;
}): React.JSX.Element {
  const [value, setValue] = useState(() => formatMoney(goal.value));
  const [validationError, setValidationError] = useState<string>();

  useEffect(() => {
    setValue(formatMoney(goal.value));
  }, [goal.value]);

  return (
    <form
      className="mc-month-row mc-advisor-brand-row"
      onSubmit={(event) => {
        event.preventDefault();
        const normalizedValue = parseMoneyInput(value);
        if (normalizedValue === undefined) {
          setValidationError('Ingresá una meta válida, sin valores negativos.');
          return;
        }
        setValidationError(undefined);
        void onSave(goal.id, normalizedValue);
      }}
    >
      <span className="mc-month-label">{goal.brandName}</span>
      {canEdit ? (
        <div className="mc-month-input">
          <input
            name="value"
            value={value}
            inputMode="decimal"
            onBlur={() => {
              const normalizedValue = parseMoneyInput(value);
              if (normalizedValue !== undefined) setValue(formatMoney(normalizedValue));
            }}
            onChange={(event) => setValue(event.target.value)}
            aria-label={`Meta de ${goal.brandName}, ${formatMonthLabel(goal.period)}`}
            aria-describedby={
              validationError === undefined ? undefined : `mc-goal-error-${String(goal.id)}`
            }
            aria-invalid={validationError === undefined ? undefined : true}
          />
          {validationError === undefined ? null : (
            <span id={`mc-goal-error-${String(goal.id)}`} role="alert">
              {validationError}
            </span>
          )}
        </div>
      ) : (
        <output className="mc-month-value">{formatMoney(goal.value)}</output>
      )}
      {canEdit ? (
        <button className="mc-primary-action" disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Guardar'}
        </button>
      ) : null}
    </form>
  );
}

function buildAdvisorMonths(goals: AdvisorGoal[], advisorId: number, year: number): AdvisorMonth[] {
  const goalsByPeriod = new Map<string, AdvisorGoal[]>();
  for (const goal of goals) {
    if (goal.goalType !== 'Vendedor' || goal.advisorId !== advisorId) continue;
    const periodGoals = goalsByPeriod.get(goal.period) ?? [];
    periodGoals.push(goal);
    goalsByPeriod.set(goal.period, periodGoals);
  }

  return Array.from({ length: 12 }, (_, index) => {
    const period = `${String(year)}-${String(index + 1).padStart(2, '0')}-01`;
    return {
      period,
      goals: (goalsByPeriod.get(period) ?? []).sort((left, right) =>
        left.brandName.localeCompare(right.brandName, 'es'),
      ),
    };
  });
}
