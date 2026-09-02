import { useEffect, useState } from 'react';
import { fetchMonthGoals, saveMonthGoal, type MonthGoal } from './meta-company-mock-data';
import type { CatalogItem } from './meta-company-types';
import { MonthGoalRow } from './month-goal-row';
import { YearFilter } from './year-filter';

interface BrandGoalsListScreenProps {
  brands: CatalogItem[];
  year: number;
  onYearChange: (year: number) => void;
  canEdit: boolean;
}

export function BrandGoalsListScreen({
  brands,
  year,
  onYearChange,
  canEdit,
}: BrandGoalsListScreenProps): React.JSX.Element {
  const [monthsByBrand, setMonthsByBrand] = useState<Record<number, MonthGoal[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void Promise.all(
      brands.map(async (brand) => [brand.id, await fetchMonthGoals('brand', brand.id, year)] as const),
    ).then((entries) => {
      if (!cancelled) {
        setMonthsByBrand(Object.fromEntries(entries));
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [brands, year]);

  const saveMonth = async (brandId: number, periodo: string, value: string): Promise<void> => {
    setSavingKey(`${brandId}-${periodo}`);
    const savedMonth = await saveMonthGoal('brand', brandId, periodo, value);
    setMonthsByBrand((current) => ({
      ...current,
      [brandId]: (current[brandId] ?? []).map((month) =>
        month.periodo === periodo ? savedMonth : month,
      ),
    }));
    setSavingKey(undefined);
  };

  return (
    <section className="mc-advisor-goals" aria-labelledby="mc-brand-goals-title">
      <div className="mc-workbench-heading">
        <div>
          <h2 id="mc-brand-goals-title">Metas por marca</h2>
          <p>Desplegá una marca para ver y editar sus 12 meses.</p>
        </div>
        <YearFilter year={year} onChange={onYearChange} />
      </div>

      {isLoading ? <p className="mc-state">Cargando marcas…</p> : null}
      {!isLoading && brands.length === 0 ? (
        <section className="mc-empty">
          <h2>No hay marcas activas</h2>
          <p>Creá una marca desde "Gestionar marcas" para poder cargarle metas acá.</p>
        </section>
      ) : null}

      <ul className="mc-advisor-list">
        {brands.map((brand) => (
          <li key={brand.id}>
            <details className="mc-advisor-accordion">
              <summary className="mc-advisor-summary">
                <span aria-hidden="true" className="mc-advisor-disclosure">
                  ›
                </span>
                {brand.name}
              </summary>
              <div className="mc-advisor-months">
                {(monthsByBrand[brand.id] ?? []).map((month) => (
                  <MonthGoalRow
                    key={month.periodo}
                    month={month}
                    canEdit={canEdit}
                    isSaving={savingKey === `${brand.id}-${month.periodo}`}
                    onSave={(periodo, value) => void saveMonth(brand.id, periodo, value)}
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
