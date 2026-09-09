import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddedItemsList } from './added-items-list';
import type { CalculatorItem } from './installment-calculator';

const ITEM: CalculatorItem = {
  id: 'catalog:BAIC-55',
  source: 'catalog',
  label: 'BAIC X55 con una descripción extensa para comprobar el corte de la fila',
  detail: 'Stock BAIC-55',
  priceUsd: 27_250,
  quantity: 2,
};

describe('AddedItemsList', () => {
  it('muestra cantidad, precios y acciones específicas por unidad', () => {
    const onIncrementQuantity = vi.fn();
    const onDecrementQuantity = vi.fn();
    const onRequestRemove = vi.fn();

    render(
      <AddedItemsList
        items={[ITEM]}
        onIncrementQuantity={onIncrementQuantity}
        onDecrementQuantity={onDecrementQuantity}
        onRequestRemove={onRequestRemove}
      />,
    );

    expect(screen.getByText('2 unidades')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sumar una unidad/i }));
    fireEvent.click(screen.getByRole('button', { name: /restar una unidad/i }));
    fireEvent.click(screen.getByRole('button', { name: /quitar .* del cálculo/i }));

    expect(onIncrementQuantity).toHaveBeenCalledWith(ITEM.id);
    expect(onDecrementQuantity).toHaveBeenCalledWith(ITEM.id);
    expect(onRequestRemove).toHaveBeenCalledWith(ITEM.id);
  });

  it('deshabilita restar cuando la cantidad es una', () => {
    render(
      <AddedItemsList
        items={[{ ...ITEM, quantity: 1 }]}
        onIncrementQuantity={vi.fn()}
        onDecrementQuantity={vi.fn()}
        onRequestRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /restar una unidad/i })).toBeDisabled();
  });
});
