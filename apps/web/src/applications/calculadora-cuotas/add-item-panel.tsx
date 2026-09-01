import { Search01Icon } from '@hugeicons/core-free-icons';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { VehicleResponse } from '../../api';
import { AppIcon } from '../../ui/app-icon';
import { formatPrice, parsePrice, type VehicleGroup } from '../../vehicle-catalog/vehicle-catalog';
import type { VehicleCatalogState } from '../../vehicle-catalog/use-vehicle-catalog';
import type { CalculatorItem } from './installment-calculator';

const MAX_CATALOG_RESULTS = 8;

interface CatalogMatch {
  unit: VehicleResponse;
  group: VehicleGroup;
}

function searchCatalog(vehiclesState: VehicleCatalogState, query: string): CatalogMatch[] {
  if (vehiclesState.status !== 'ready') return [];
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === '') return [];

  const matches: CatalogMatch[] = [];
  for (const group of vehiclesState.groups.values()) {
    for (const unit of group.units) {
      const haystack = `${group.marca} ${group.modelo} ${group.config} ${unit.stock}`.toLowerCase();
      if (haystack.includes(normalizedQuery)) {
        matches.push({ unit, group });
        if (matches.length >= MAX_CATALOG_RESULTS) return matches;
      }
    }
  }
  return matches;
}

function catalogItemFromMatch(match: CatalogMatch): CalculatorItem | undefined {
  const priceUsd = parsePrice(match.unit.precioLista);
  if (priceUsd === null) return undefined;
  return {
    id: `catalog:${match.unit.stock}`,
    source: 'catalog',
    label: match.group.name,
    detail: `Stock ${match.unit.stock}`,
    priceUsd,
  };
}

interface AddItemPanelProps {
  vehiclesState: VehicleCatalogState;
  existingItemIds: ReadonlySet<string>;
  onAddItem: (item: CalculatorItem) => void;
}

export function AddItemPanel({
  vehiclesState,
  existingItemIds,
  onAddItem,
}: AddItemPanelProps): React.JSX.Element {
  const [mode, setMode] = useState<'manual' | 'catalog'>('catalog');
  const [manualLabel, setManualLabel] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualError, setManualError] = useState<string | undefined>(undefined);
  const [catalogQuery, setCatalogQuery] = useState('');
  const catalogSearchInputRef = useRef<HTMLInputElement>(null);

  const catalogMatches = useMemo(
    () => searchCatalog(vehiclesState, catalogQuery),
    [vehiclesState, catalogQuery],
  );

  function submitManualEntry(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmedLabel = manualLabel.trim();
    const price = Number(manualPrice.replace(',', '.'));

    if (trimmedLabel === '') {
      setManualError('Ingresá una descripción para identificar este monto en la lista.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setManualError('Ingresá un precio en dólares mayor a cero.');
      return;
    }

    setManualError(undefined);
    onAddItem({
      id: `manual:${crypto.randomUUID()}`,
      source: 'manual',
      label: trimmedLabel,
      priceUsd: price,
    });
    setManualLabel('');
    setManualPrice('');
  }

  function addCatalogMatch(match: CatalogMatch): void {
    const item = catalogItemFromMatch(match);
    if (item === undefined) return;
    onAddItem(item);
    // El botón recién tocado queda disabled en el próximo render ("Agregada"); en mobile eso le
    // puede robar el foco a document.body y cerrar el teclado de golpe, dando la sensación de que
    // se perdió la búsqueda. Devolver el foco al buscador mantiene resultados y teclado a mano
    // para seguir agregando unidades sin re-escribir la búsqueda.
    catalogSearchInputRef.current?.focus();
  }

  return (
    <section className="cc-section" aria-labelledby="cc-add-title">
      <h2 id="cc-add-title" className="cc-section-title">
        Agregar unidad
      </h2>

      <div className="cc-mode-switch" role="radiogroup" aria-label="Origen del monto a agregar">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'catalog'}
          className={`cc-mode-btn${mode === 'catalog' ? ' cc-mode-btn--active' : ''}`}
          onClick={() => setMode('catalog')}
        >
          Desde lista
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'manual'}
          className={`cc-mode-btn${mode === 'manual' ? ' cc-mode-btn--active' : ''}`}
          onClick={() => setMode('manual')}
        >
          Precio manual
        </button>
      </div>

      {mode === 'catalog' ? (
        <div className="cc-catalog-picker">
          <div className="cc-search-bar">
            <AppIcon icon={Search01Icon} size={18} />
            <input
              ref={catalogSearchInputRef}
              type="search"
              placeholder="Buscar por marca, modelo o stock"
              aria-label="Buscar unidad en Lista de Precios"
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
            />
          </div>

          {vehiclesState.status === 'loading' ? (
            <div className="cc-catalog-loading" role="status">
              <span className="session-boot-indicator" aria-hidden="true" />
              <span>Cargando catálogo de Lista de Precios…</span>
            </div>
          ) : null}

          {vehiclesState.status === 'error' ? (
            <p role="alert">No pudimos cargar el catálogo de Lista de Precios.</p>
          ) : null}

          {vehiclesState.status === 'ready' && catalogQuery.trim() !== '' ? (
            catalogMatches.length === 0 ? (
              <p className="cc-catalog-empty">Sin resultados para «{catalogQuery.trim()}».</p>
            ) : (
              <ul className="cc-catalog-results" aria-label="Resultados de la búsqueda">
                {catalogMatches.map((match) => {
                  const priceUsd = parsePrice(match.unit.precioLista);
                  const alreadyAdded = existingItemIds.has(`catalog:${match.unit.stock}`);
                  return (
                    <li key={match.unit.stock} className="cc-catalog-result">
                      <div className="cc-catalog-result-info">
                        <span className="cc-catalog-result-name">{match.group.name}</span>
                        <span className="cc-catalog-result-meta">
                          Stock {match.unit.stock} · {formatPrice(priceUsd)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="cc-add-btn"
                        disabled={priceUsd === null || alreadyAdded}
                        onClick={() => addCatalogMatch(match)}
                      >
                        {alreadyAdded ? 'Agregada' : 'Agregar'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}

          {vehiclesState.status === 'ready' && catalogQuery.trim() === '' ? (
            <p className="cc-catalog-hint">Escribí para buscar una unidad del catálogo.</p>
          ) : null}
        </div>
      ) : (
        <form className="cc-manual-form" onSubmit={submitManualEntry}>
          <label htmlFor="cc-manual-label">Descripción</label>
          <input
            id="cc-manual-label"
            type="text"
            placeholder="Ej.: Camión importado a pedido"
            value={manualLabel}
            onChange={(event) => setManualLabel(event.target.value)}
          />

          <label htmlFor="cc-manual-price">Precio (USD)</label>
          <input
            id="cc-manual-price"
            type="text"
            inputMode="decimal"
            placeholder="Ej.: 85000"
            value={manualPrice}
            onChange={(event) => setManualPrice(event.target.value)}
          />

          {manualError === undefined ? null : <p role="alert">{manualError}</p>}

          <button type="submit" className="action-button cc-manual-submit">
            Agregar
          </button>
        </form>
      )}
    </section>
  );
}
