import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { useMemo, useState } from 'react';
import { AppIcon } from '../../ui/app-icon';
import {
  filterByBrand,
  filterByLocation,
  filterByVehicleLocationSegment,
  groupByMarcaModelo,
  type VehicleGroup,
} from '../../vehicle-catalog/vehicle-catalog';
import { PlatformLoadingIndicator } from '../../layout/platform-loading-indicator';
import type { VehicleCatalogState } from '../../vehicle-catalog/use-vehicle-catalog';
import { LocationSegmentation } from './location-segmentation';
import type { VariantFilterState } from './variants-screen';

interface BrandScreenProps {
  brand: string;
  vehiclesState: VehicleCatalogState;
  filterState: VariantFilterState;
  onFilterStateChange: (nextState: VariantFilterState) => void;
  onSelectModel: (modelo: string) => void;
  onSelectSubBrand: (subBrand: string) => void;
}

function ModelCards({
  brandGroups,
  onSelectModel,
}: {
  brandGroups: Map<string, VehicleGroup>;
  onSelectModel: (modelo: string) => void;
}): React.JSX.Element {
  const modelSummaries = useMemo(() => groupByMarcaModelo(brandGroups), [brandGroups]);

  return (
    <>
      <div className="lp-section-title lp-section-title--models">
        {modelSummaries.size} modelo{modelSummaries.size !== 1 ? 's' : ''}
      </div>

      <div className="lp-model-list">
        {[...modelSummaries.values()].map((summary) => {
          const anioLabel =
            summary.anios.length === 0
              ? null
              : summary.anios.length === 1
                ? summary.anios[0]
                : `${summary.anios[0]}-${summary.anios[summary.anios.length - 1]}`;

          const sub = [
            summary.variantCount === 1 ? '1 variante' : `${summary.variantCount} variantes`,
            anioLabel,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <button
              type="button"
              key={summary.key}
              className="lp-model-card"
              onClick={() => onSelectModel(summary.modelo)}
            >
              <span className="lp-model-card-info">
                <span className="lp-model-card-name">{summary.modelo}</span>
                {sub ? <span className="lp-model-card-sub">{sub}</span> : null}
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
          );
        })}
      </div>
    </>
  );
}

function ModelSearch({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (search: string) => void;
}): React.JSX.Element {
  return (
    <div className="lp-toolbar">
      <div className="lp-search-bar">
        <AppIcon icon={Search01Icon} size={16} />
        <input
          type="search"
          placeholder="Buscar modelo..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Buscar"
        />
        {search ? (
          <button
            className="lp-search-bar-clear"
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Limpiar"
          >
            <AppIcon icon={Cancel01Icon} size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function OtrosSubBrands({
  brandGroups,
  onSelectSubBrand,
}: {
  brandGroups: Map<string, VehicleGroup>;
  onSelectSubBrand: (subBrand: string) => void;
}): React.JSX.Element {
  const subBrands = useMemo(() => {
    const map = new Map<string, { marca: string; modelCount: number; unitCount: number }>();
    for (const group of brandGroups.values()) {
      const upperMarca = group.marca.trim().toUpperCase();
      let entry = map.get(upperMarca);
      if (entry === undefined) {
        entry = { marca: group.marca, modelCount: 0, unitCount: 0 };
        map.set(upperMarca, entry);
      }
      entry.modelCount += 1;
      entry.unitCount += group.stockCount;
    }
    return [...map.values()].sort((a, b) => a.marca.localeCompare(b.marca));
  }, [brandGroups]);

  return (
    <>
      <div className="lp-section-title">
        {subBrands.length} marca{subBrands.length !== 1 ? 's' : ''}
      </div>
      <div className="lp-brand-grid">
        {subBrands.map((subBrand) => (
          <button
            type="button"
            key={subBrand.marca}
            className="lp-brand-card"
            onClick={() => onSelectSubBrand(subBrand.marca)}
          >
            <span className="lp-brand-card-name">{subBrand.marca}</span>
            <span className="lp-brand-card-meta">
              {subBrand.modelCount} modelo{subBrand.modelCount !== 1 ? 's' : ''}
            </span>
            <span className="lp-brand-card-count">
              <span className="lp-brand-card-count-badge">
                {subBrand.unitCount} {subBrand.unitCount !== 1 ? 'unidades' : 'unidad'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

export function BrandScreen({
  brand,
  vehiclesState,
  filterState,
  onFilterStateChange,
  onSelectModel,
  onSelectSubBrand,
}: BrandScreenProps): React.JSX.Element {
  const isOtros = brand.toUpperCase() === 'OTROS';
  const [modelSearch, setModelSearch] = useState('');
  const brandGroups = useMemo(
    () =>
      vehiclesState.status === 'ready'
        ? filterByBrand(vehiclesState.groups, brand)
        : new Map<string, VehicleGroup>(),
    [vehiclesState, brand],
  );
  const searchedBrandGroups = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    if (query === '') return brandGroups;
    return new Map(
      [...brandGroups].filter(([, group]) => group.modelo.toLowerCase().includes(query)),
    );
  }, [brandGroups, modelSearch]);
  const selectedSegmentGroups = useMemo(
    () =>
      filterState.locationSegment === undefined
        ? searchedBrandGroups
        : filterByVehicleLocationSegment(searchedBrandGroups, filterState.locationSegment),
    [searchedBrandGroups, filterState.locationSegment],
  );
  const visibleBrandGroups = useMemo(
    () =>
      filterState.location === ''
        ? selectedSegmentGroups
        : filterByLocation(selectedSegmentGroups, filterState.location),
    [selectedSegmentGroups, filterState.location],
  );

  const handleLocationSegmentChange = (segment: VariantFilterState['locationSegment']): void => {
    if (segment === undefined) return;
    const nextSegment = filterState.locationSegment === segment ? undefined : segment;
    onFilterStateChange({ ...filterState, locationSegment: nextSegment, location: '' });
  };

  const handleLocationChange = (location: string): void => {
    onFilterStateChange({
      ...filterState,
      location: filterState.location === location ? '' : location,
    });
  };

  return (
    <div className="lp-page">
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

      {vehiclesState.status === 'ready' && brandGroups.size === 0 ? (
        <div className="lp-state-box">
          <span className="lp-state-box-title">Sin datos</span>
          <p className="lp-state-box-desc">No se encontraron unidades para esta marca.</p>
        </div>
      ) : null}

      {vehiclesState.status === 'ready' && brandGroups.size > 0 ? (
        isOtros ? (
          <OtrosSubBrands brandGroups={brandGroups} onSelectSubBrand={onSelectSubBrand} />
        ) : (
          <>
            <ModelSearch search={modelSearch} onSearchChange={setModelSearch} />
            <LocationSegmentation
              groups={searchedBrandGroups}
              locationSegment={filterState.locationSegment}
              location={filterState.location}
              onLocationSegmentChange={handleLocationSegmentChange}
              onLocationChange={handleLocationChange}
            />
            <ModelCards brandGroups={visibleBrandGroups} onSelectModel={onSelectModel} />
            {visibleBrandGroups.size === 0 ? (
              <div className="lp-state-box">
                <span className="lp-state-box-title">Sin resultados</span>
                <p className="lp-state-box-desc">
                  Probá con otra ubicación o limpiá la segmentación.
                </p>
              </div>
            ) : null}
          </>
        )
      ) : null}
    </div>
  );
}
