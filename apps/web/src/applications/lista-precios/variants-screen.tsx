import { Cancel01Icon, FilterIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { useMemo, useState } from 'react';
import { AppIcon } from '../../ui/app-icon';
import {
  applyFilters,
  filterByBrandAndModelo,
  filterBySuspension,
  filterByLocation,
  filterByVehicleLocationSegment,
  formatPrice,
  getFilterOptions,
  type VehicleFilters,
  type VehicleGroup,
  type VehicleLocationSegment,
} from '../../vehicle-catalog/vehicle-catalog';
import { FilterDrawer, type ListaPreciosFilterOptions } from './filter-drawer';
import { LocationSegmentation } from './location-segmentation';
import { PlatformLoadingIndicator } from '../../layout/platform-loading-indicator';
import type { VehicleCatalogState } from '../../vehicle-catalog/use-vehicle-catalog';

export const EMPTY_VARIANT_FILTERS: VehicleFilters = {
  config: '',
  susp: '',
  tipoMotor: '',
  tipoCaja: '',
  color: '',
  ubicacion: '',
  aire: '',
  anioFab: '',
};

export interface VariantFilterState {
  search: string;
  filters: VehicleFilters;
  locationSegment: VehicleLocationSegment | undefined;
  location: string;
}

export const EMPTY_VARIANT_FILTER_STATE: VariantFilterState = {
  search: '',
  filters: EMPTY_VARIANT_FILTERS,
  locationSegment: undefined,
  location: '',
};

interface VariantsScreenProps {
  brand: string;
  modelo: string;
  suspension?: string;
  vehiclesState: VehicleCatalogState;
  onSelectVariant: (modelKey: string) => void;
  filterState: VariantFilterState;
  onFilterStateChange: (nextState: VariantFilterState) => void;
}

export function VariantsScreen({
  brand,
  modelo,
  suspension,
  vehiclesState,
  onSelectVariant,
  filterState,
  onFilterStateChange,
}: VariantsScreenProps): React.JSX.Element {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const variantGroups = useMemo(
    () =>
      vehiclesState.status !== 'ready'
        ? new Map<string, VehicleGroup>()
        : suspension === undefined
          ? filterByBrandAndModelo(vehiclesState.groups, brand, modelo)
          : filterBySuspension(
              filterByBrandAndModelo(vehiclesState.groups, brand, modelo),
              suspension,
            ),
    [vehiclesState, brand, modelo, suspension],
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

  const filteredGroups = useMemo(
    () => applyFilters(variantGroups, filterState.search, filterState.filters),
    [variantGroups, filterState.search, filterState.filters],
  );

  const segmentedGroups = useMemo(
    () =>
      filterState.locationSegment === undefined
        ? filteredGroups
        : filterByVehicleLocationSegment(filteredGroups, filterState.locationSegment),
    [filteredGroups, filterState.locationSegment],
  );

  const visibleGroups = useMemo(
    () =>
      filterState.location === ''
        ? segmentedGroups
        : filterByLocation(segmentedGroups, filterState.location),
    [segmentedGroups, filterState.location],
  );

  const disabledOptions = useMemo(() => {
    const result = {} as Record<keyof VehicleFilters, Record<string, boolean>>;
    for (const field of Object.keys(filterOptions) as (keyof VehicleFilters)[]) {
      const fieldResult: Record<string, boolean> = {};
      for (const option of filterOptions[field]) {
        if (filterState.filters[field] === option) {
          fieldResult[option] = false;
          continue;
        }
        const testFilters = { ...filterState.filters, [field]: option };
        fieldResult[option] =
          applyFilters(variantGroups, filterState.search, testFilters).size === 0;
      }
      result[field] = fieldResult;
    }
    return result;
  }, [variantGroups, filterState.filters, filterState.search, filterOptions]);

  const activeFilterCount = Object.values(filterState.filters).filter(Boolean).length;
  const handleFilterChange = (field: keyof VehicleFilters, value: string): void => {
    onFilterStateChange({
      ...filterState,
      filters: { ...filterState.filters, [field]: value },
    });
  };

  const handleLocationSegmentChange = (segment: VehicleLocationSegment): void => {
    const nextSegment = filterState.locationSegment === segment ? undefined : segment;
    onFilterStateChange({
      ...filterState,
      locationSegment: nextSegment,
      location: '',
    });
  };

  const handleLocationChange = (location: string): void => {
    onFilterStateChange({
      ...filterState,
      location: filterState.location === location ? '' : location,
    });
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
              value={filterState.search}
              onChange={(event) =>
                onFilterStateChange({ ...filterState, search: event.target.value })
              }
              aria-label="Buscar"
            />
            {filterState.search ? (
              <button
                className="lp-search-bar-clear"
                type="button"
                onClick={() => onFilterStateChange({ ...filterState, search: '' })}
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
          <LocationSegmentation
            groups={filteredGroups}
            locationSegment={filterState.locationSegment}
            location={filterState.location}
            onLocationSegmentChange={handleLocationSegmentChange}
            onLocationChange={handleLocationChange}
          />
        ) : null}

        {vehiclesState.status === 'ready' ? (
          <div className="lp-section-title lp-section-title--models">
            {visibleGroups.size} variante{visibleGroups.size !== 1 ? 's' : ''}
          </div>
        ) : null}

        {vehiclesState.status === 'loading' ? (
          <div className="lp-loader-full" role="status" aria-live="polite">
            <PlatformLoadingIndicator label="Cargando lista de precios" />
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
        filters={filterState.filters}
        onChange={handleFilterChange}
        onClear={() =>
          onFilterStateChange({
            ...filterState,
            filters: EMPTY_VARIANT_FILTERS,
          })
        }
        options={filterOptions}
        disabledOptions={disabledOptions}
      />
    </>
  );
}
