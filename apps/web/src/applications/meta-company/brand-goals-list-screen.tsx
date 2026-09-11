import { useEffect, useState } from 'react';
import { ApiHttpError } from '../../api/system';
import type { ApplicationComponentProps } from '../application-component';
import type { CatalogItem } from './meta-company-types';
import { formatMoney, formatMonthLabel, parseMoneyInput } from './month-goal-row';
import { YearFilter } from './year-filter';

type BrandGoal = Awaited<
  ReturnType<ApplicationComponentProps['api']['applications']['listMetaCompanyGoals']>
>[number];

interface BrandMonth {
  period: string;
  goals: BrandGoal[];
}

interface BrandGoalsListScreenProps {
  brands: CatalogItem[];
  applicationsApi: ApplicationComponentProps['api']['applications'];
  year: number;
  onYearChange: (year: number) => void;
  canEdit: boolean;
}

export function BrandGoalsListScreen({
  brands,
  applicationsApi,
  year,
  onYearChange,
  canEdit,
}: BrandGoalsListScreenProps): React.JSX.Element {
  const [goals, setGoals] = useState<BrandGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [savingGoalId, setSavingGoalId] = useState<number>();
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(undefined);

    void applicationsApi
      .listMetaCompanyGoals(String(year))
      .then((loadedGoals) => {
        if (!cancelled) {
          setGoals(loadedGoals);
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        const requestId = error instanceof ApiHttpError ? error.requestId : undefined;
        console.error('No fue posible cargar las metas por marca desde la API.', {
          year,
          requestId,
        });
        if (!cancelled) {
          setLoadError('No pudimos cargar las metas por marca. Intentá nuevamente.');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationsApi, reloadVersion, year]);

  const saveGoal = async (goalId: number, value: string): Promise<void> => {
    setSavingGoalId(goalId);
    setLoadError(undefined);
    try {
      const updatedGoal = await applicationsApi.updateMetaCompanyBrandGoal(goalId, value);
      setGoals((current) =>
        current.map((goal) => (goal.id === goalId ? { ...goal, value: updatedGoal.value } : goal)),
      );
    } catch (error: unknown) {
      const requestId = error instanceof ApiHttpError ? error.requestId : undefined;
      console.error('No fue posible guardar la meta por marca desde la API.', {
        goalId,
        requestId,
      });
      setLoadError('No pudimos guardar la meta. Revisá el valor e intentá nuevamente.');
    } finally {
      setSavingGoalId(undefined);
    }
  };

  return (
    <section className="mc-advisor-goals" aria-labelledby="mc-brand-goals-title">
      <div className="mc-workbench-heading">
        <div>
          <h2 id="mc-brand-goals-title">Metas por marca</h2>
          <p>Desplegá una marca para consultar y editar sus metas por negocio.</p>
        </div>
        <YearFilter year={year} onChange={onYearChange} />
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
      {!isLoading && brands.length === 0 ? (
        <section className="mc-empty">
          <h2>No hay marcas activas</h2>
          <p>Creá una marca desde "Gestionar marcas" para poder cargarle metas acá.</p>
        </section>
      ) : null}

      {!isLoading && brands.length > 0 ? (
        <ul className="mc-advisor-list">
          {brands.map((brand) => (
            <li key={brand.id}>
              <details className="mc-advisor-accordion">
                <summary className="mc-advisor-summary">{brand.name}</summary>
                <div className="mc-advisor-detail-months">
                  {buildBrandMonths(goals, brand.id, year).map((month) => (
                    <details key={month.period} className="mc-advisor-month">
                      <summary className="mc-advisor-month-summary">
                        <span>{formatMonthLabel(month.period)}</span>
                        <span className="mc-advisor-month-count">
                          {month.goals.length === 1
                            ? '1 negocio'
                            : `${String(month.goals.length)} negocios`}
                        </span>
                      </summary>
                      {month.goals.length === 0 ? (
                        <p className="mc-state">No hay metas cargadas para este mes.</p>
                      ) : (
                        <div className="mc-advisor-month-brands">
                          {month.goals.map((goal) => (
                            <BrandGoalRow
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
              </details>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function BrandGoalRow({
  goal,
  canEdit,
  isSaving,
  onSave,
}: {
  goal: BrandGoal;
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
      <span className="mc-month-label">{goal.businessName}</span>
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
            aria-label={`Meta de ${goal.businessName}, ${formatMonthLabel(goal.period)}`}
            aria-describedby={
              validationError === undefined ? undefined : `mc-brand-goal-error-${String(goal.id)}`
            }
            aria-invalid={validationError === undefined ? undefined : true}
          />
          {validationError === undefined ? null : (
            <span id={`mc-brand-goal-error-${String(goal.id)}`} role="alert">
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

function buildBrandMonths(goals: BrandGoal[], brandId: number, year: number): BrandMonth[] {
  const goalsByPeriod = new Map<string, BrandGoal[]>();
  for (const goal of goals) {
    if (goal.goalType !== 'Marca' || goal.brandId !== brandId) continue;
    const periodGoals = goalsByPeriod.get(goal.period) ?? [];
    periodGoals.push(goal);
    goalsByPeriod.set(goal.period, periodGoals);
  }

  return Array.from({ length: 12 }, (_, index) => {
    const period = `${String(year)}-${String(index + 1).padStart(2, '0')}-01`;
    return {
      period,
      goals: (goalsByPeriod.get(period) ?? []).sort((left, right) =>
        left.businessName.localeCompare(right.businessName, 'es'),
      ),
    };
  });
}
