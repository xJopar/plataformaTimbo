import { formatPrice } from '../../vehicle-catalog/vehicle-catalog';
import type { CalculatorItem } from './installment-calculator';

interface AddedItemsListProps {
  items: CalculatorItem[];
  onIncrementQuantity: (itemId: string) => void;
  onDecrementQuantity: (itemId: string) => void;
  onRequestRemove: (itemId: string) => void;
}

interface AddedItemRowProps {
  item: CalculatorItem;
  onIncrementQuantity: (itemId: string) => void;
  onDecrementQuantity: (itemId: string) => void;
  onRequestRemove: (itemId: string) => void;
}

function AddedItemRow({
  item,
  onIncrementQuantity,
  onDecrementQuantity,
  onRequestRemove,
}: AddedItemRowProps): React.JSX.Element {
  const lineSubtotal = item.priceUsd * item.quantity;

  return (
    <li className="cc-added-row">
      <div className="cc-added-row-info">
        <span className="cc-added-row-label">{item.label}</span>
      </div>
      <div className="cc-added-row-total">
        <span>Total</span>
        <strong>{formatPrice(lineSubtotal)}</strong>
      </div>
      <div className="cc-quantity-control" aria-label={`Cantidad de ${item.label}`}>
        <button
          type="button"
          className="cc-quantity-button"
          aria-label={`Restar una unidad de ${item.label}`}
          disabled={item.quantity === 1}
          onClick={() => onDecrementQuantity(item.id)}
        >
          −
        </button>
        <output className="cc-quantity-value" aria-label={`${item.quantity} unidades`}>
          {item.quantity}
        </output>
        <button
          type="button"
          className="cc-quantity-button"
          aria-label={`Sumar una unidad de ${item.label}`}
          onClick={() => onIncrementQuantity(item.id)}
        >
          +
        </button>
      </div>
      <button
        type="button"
        className="cc-remove-btn"
        aria-label={`Quitar ${item.label} del cálculo`}
        onClick={() => onRequestRemove(item.id)}
      >
        Quitar
      </button>
    </li>
  );
}

export function AddedItemsList({
  items,
  onIncrementQuantity,
  onDecrementQuantity,
  onRequestRemove,
}: AddedItemsListProps): React.JSX.Element {
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <section className="cc-section" aria-label="Unidades">
      {items.length === 0 ? (
        <p className="cc-added-empty">Agregá una unidad para comenzar el cálculo.</p>
      ) : (
        <>
          <div className="cc-section-heading">
            <h2 className="cc-section-title">Unidades agregadas</h2>
            <span className="cc-added-count">
              {totalQuantity} {totalQuantity === 1 ? 'unidad' : 'unidades'}
            </span>
          </div>
          <ul className="cc-added-list">
            {items.map((item) => (
              <AddedItemRow
                key={item.id}
                item={item}
                onIncrementQuantity={onIncrementQuantity}
                onDecrementQuantity={onDecrementQuantity}
                onRequestRemove={onRequestRemove}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
