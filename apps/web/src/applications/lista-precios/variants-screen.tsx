import { Cancel01Icon, FilterIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { useMemo, useState } from 'react';
import { AppIcon } from '../../ui/app-icon';
import {
  applyFilters,
  filterByBrandAndModelo,
  formatPrice,
  getFilterOptions,
  type VehicleFilters,
  type VehicleGroup,
} from '../../vehicle-catalog/vehicle-catalog';
import { FilterDrawer, type ListaPreciosFilterOptions } from './filter-drawer';
import { Loader } from './loader';
import type { VehicleCatalogState } from '../../vehicle-catalog/use-vehicle-catalog';

const EMPTY_FILTERS: VehicleFilters = {
  config: '',
  susp: '',
  tipoMotor: '',
  tipoCaja: '',
  color: '',
  ubicacion: '',
  aire: '',
  anioFab: '',
};

interface VariantsScreenProps {
  brand: string;
  modelo: string;
  vehiclesState: VehicleCatalogState;
  onSelectVariant: (modelKey: string) => void;
}

export function VariantsScreen({
  brand,
  modelo,
  vehiclesState,
  onSelectVariant,
}: VariantsScreenProps): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<VehicleFilters>(EMPTY_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const variantGroups = useMemo(
    () =>
      vehiclesState.status === 'ready'
        ? filterByBrandAndModelo(vehiclesState.groups, brand, modelo)
        : new Map<string, VehicleGroup>(),
    [vehiclesState, brand, modelo],
  );

  const filterOptions: ListaPreciosFilterOptions = useMemo(
    () => ({
      config: getFilterOptions(variantGroups, 'config'),
      susp: getFilterOptions(variantGroups, 'susp'),
      tipoMotor: getFilterOptions(variantGroups, 'tipoMotor'),
      tipoCaja: getFilterOptions(variantGroups, 'tipoCaja'),
      color: getFilterOptions(variantGroups, 'color'),
      ubicacion: getFilterOptions(variantGroups, 'ubicacion'),
      aire: getFilterOptions(variantGroups, 'aire'),
      anioFab: [...new Set([...variantGroups.values()].flatMap((group) => group.anios))].sort(),
    }),
    [variantGroups],
  );

  const visibleGroups = useMemo(
    () => applyFilters(variantGroups, search, filters),
    [variantGroups, search, filters],
  );

  const disabledOptions = useMemo(() => {
    const result = {} as Record<keyof VehicleFilters, Record<string, boolean>>;
    for (const field of Object.keys(filterOptions) as (keyof VehicleFilters)[]) {
      const fieldResult: Record<string, boolean> = {};
      for (const option of filterOptions[field]) {
        if (filters[field] === option) {
          fieldResult[option] = false;
          continue;
        }
        const testFilters = { ...filters, [field]: option };
        fieldResult[option] = applyFilters(variantGroups, search, testFilters).size === 0;
      }
      result[field] = fieldResult;
    }
    return result;
  }, [variantGroups, filters, search, filterOptions]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleFilterChange = (field: keyof VehicleFilters, value: string): void => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  return (
    <>
      <div className="lp-page">
        <div className="lp-toolbar">
          <div className="lp-search-bar">
            <AppIcon icon={Search01Icon} size={16} />
            <input
              type="search"
              placeholder="Buscar configuración, motor..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar"
            />
            {search ? (
              <button
                className="lp-search-bar-clear"
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
              >
                <AppIcon icon={Cancel01Icon} size={14} />
              </button>
            ) : null}
          </div>

          <button
            className={`lp-filter-btn${activeFilterCount > 0 ? ' lp-filter-btn--active' : ''}`}
            type="button"
            onClick={() => setDrawerOpen(true)}
          >
            <AppIcon icon={FilterIcon} size={13} />
            Filtrar{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        {vehiclesState.status === 'ready' ? (
          <div className="lp-section-title lp-section-title--models">
            {visibleGroups.size} variante{visibleGroups.size !== 1 ? 's' : ''}
          </div>
        ) : null}

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

        {vehiclesState.status === 'ready' && visibleGroups.size === 0 ? (
          <div className="lp-state-box">
            <span className="lp-state-box-title">Sin resultados</span>
            <p className="lp-state-box-desc">Probá con otros términos o limpiá los filtros.</p>
          </div>
        ) : null}

        {vehiclesState.status === 'ready' ? (
          <div className="lp-model-list">
            {[...visibleGroups.values()].map((group) => {
              const samePrice = group.precioMin === group.precioMax;
              const priceLabel =
                group.precioMin === null
                  ? 'A consultar'
                  : samePrice
                    ? formatPrice(group.precioMin)
                    : `Desde ${formatPrice(group.precioMin)}`;

              const anioLabel =
                group.anios.length === 1
                  ? group.anios[0]
                  : `${group.anios[0]}-${group.anios[group.anios.length - 1]}`;

              const sub = [group.tipo, anioLabel].filter(Boolean).join(' · ');

              return (
                <button
                  type="button"
                  key={group.key}
                  className="lp-model-card"
                  onClick={() => onSelectVariant(group.key)}
                >
                  <span className="lp-model-card-info">
                    <span className="lp-model-card-name">{group.name}</span>
                    {sub ? <span className="lp-model-card-sub">{sub}</span> : null}
                  </span>
                  <span className="lp-model-card-price-col">
                    <span className="lp-model-card-price">{priceLabel}</span>
                    <span className="lp-unit-count">
                      <span className="lp-unit-count-num">{group.stockCount}</span>
                      <span className="lp-unit-count-lbl">
                        {group.stockCount !== 1 ? 'unidades' : 'unidad'}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        onChange={handleFilterChange}
        onClear={() => setFilters(EMPTY_FILTERS)}
        options={filterOptions}
        disabledOptions={disabledOptions}
      />
    </>
  );
}
