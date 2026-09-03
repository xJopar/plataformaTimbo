import { formatPrice } from '../../vehicle-catalog/vehicle-catalog';
import type { CalculatorItem } from './installment-calculator';

interface AddedItemsListProps {
  items: CalculatorItem[];
  onRequestRemove: (itemId: string) => void;
}

export function AddedItemsList({ items, onRequestRemove }: AddedItemsListProps): React.JSX.Element {
  return (
    <section className="cc-section" aria-label="Unidades">
      {items.length === 0 ? (
        <p className="cc-added-empty">
          Agregá una unidad para continuar.
        </p>
      ) : (
        <>
          <div className="cc-section-heading">
            <h2 className="cc-section-title">Unidades</h2>
            <span className="cc-added-count">
              {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
            </span>
          </div>
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
                  aria-label={`Eliminar ${item.label}`}
                  onClick={() => onRequestRemove(item.id)}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
