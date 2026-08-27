import { useMemo } from 'react';
import { filterByBrandAndModelo, type VehicleGroup } from '../../vehicle-catalog/vehicle-catalog';
import type { VehicleCatalogState } from '../../vehicle-catalog/use-vehicle-catalog';
import { Loader } from './loader';

interface SuspensionSummary {
  suspension: string;
  variantCount: number;
  unitCount: number;
}

interface SuspensionsScreenProps {
  brand: string;
  modelo: string;
  vehiclesState: VehicleCatalogState;
  onSelectSuspension: (suspension: string) => void;
}

function summarizeSuspensions(groups: Map<string, VehicleGroup>): SuspensionSummary[] {
  const summaries = new Map<string, SuspensionSummary>();

  for (const group of groups.values()) {
    const suspension = group.susp.trim();
    if (suspension === '') continue;

    const key = suspension.toUpperCase();
    const current = summaries.get(key);
    if (current === undefined) {
      summaries.set(key, {
        suspension,
        variantCount: 1,
        unitCount: group.stockCount,
      });
      continue;
    }
    current.variantCount += 1;
    current.unitCount += group.stockCount;
  }

  return [...summaries.values()].sort((left, right) =>
    left.suspension.localeCompare(right.suspension, 'es-PY'),
  );
}

export function SuspensionsScreen({
  brand,
  modelo,
  vehiclesState,
  onSelectSuspension,
}: SuspensionsScreenProps): React.JSX.Element {
  const suspensions = useMemo(
    () =>
      vehiclesState.status === 'ready'
        ? summarizeSuspensions(filterByBrandAndModelo(vehiclesState.groups, brand, modelo))
        : [],
    [vehiclesState, brand, modelo],
  );

  return (
    <div className="lp-page">
      {vehiclesState.status === 'loading' ? (
        <div className="lp-loader-full" role="status" aria-live="polite">
          <Loader />
          <span className="lp-loader-full-label">Cargando lista de precios...</span>
        </div>
      ) : null}

      {vehiclesState.status === 'error' ? (
        <div className="lp-state-box">
          <span className="lp-state-box-title">Error al cargar</span>
          <p className="lp-state-box-desc">No pudimos obtener el catálogo de vehículos.</p>
        </div>
      ) : null}

      {vehiclesState.status === 'ready' && suspensions.length === 0 ? (
        <div className="lp-state-box">
          <span className="lp-state-box-title">Sin suspensiones disponibles</span>
          <p className="lp-state-box-desc">No se encontraron variantes para este modelo.</p>
        </div>
      ) : null}

      {vehiclesState.status === 'ready' && suspensions.length > 0 ? (
        <>
          <div className="lp-section-title lp-section-title--models">Elegí la suspensión</div>
          <div className="lp-model-list">
            {suspensions.map((summary) => (
              <button
                type="button"
                key={summary.suspension}
                className="lp-model-card"
                onClick={() => onSelectSuspension(summary.suspension)}
              >
                <span className="lp-model-card-info">
                  <span className="lp-model-card-name">{summary.suspension}</span>
                  <span className="lp-model-card-sub">
                    {summary.variantCount} variante{summary.variantCount !== 1 ? 's' : ''}
                  </span>
                </span>
                <span className="lp-model-card-price-col">
                  <span className="lp-unit-count">
                    <span className="lp-unit-count-num">{summary.unitCount}</span>
                    <span className="lp-unit-count-lbl">
                      {summary.unitCount !== 1 ? 'unidades' : 'unidad'}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
