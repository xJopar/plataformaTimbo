import { formatPrice } from '../../vehicle-catalog/vehicle-catalog';
import type { CalculatorItem } from './installment-calculator';

interface AddedItemsListProps {
  items: CalculatorItem[];
  onRequestRemove: (itemId: string) => void;
}

export function AddedItemsList({ items, onRequestRemove }: AddedItemsListProps): React.JSX.Element {
  return (
    <section className="cc-panel" aria-labelledby="cc-added-title">
      <div className="cc-panel-heading">
        <h2 id="cc-added-title" className="cc-panel-title">
          Unidades agregadas
        </h2>
        <span className="cc-added-count">
          {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="cc-added-empty">
          Todavía no agregaste nada. Elegí una unidad de Lista de Precios o cargá un precio manual
          arriba para empezar el cálculo.
        </p>
      ) : (
        <ul className="cc-added-list">
          {items.map((item) => (
            <li key={item.id} className="cc-added-row">
              <div className="cc-added-row-info">
                <span className="cc-added-row-label">{item.label}</span>
                <span className="cc-added-row-meta">
                  {item.source === 'catalog' ? 'Lista de Precios' : 'Precio manual'}
                  {item.detail === undefined ? '' : ` · ${item.detail}`}
                </span>
              </div>
              <span className="cc-added-row-price">{formatPrice(item.priceUsd)}</span>
              <button
                type="button"
                className="cc-remove-btn"
                aria-label={`Quitar ${item.label}`}
                onClick={() => onRequestRemove(item.id)}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
