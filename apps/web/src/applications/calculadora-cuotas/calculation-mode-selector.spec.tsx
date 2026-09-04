import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CalculationModeSelector } from './calculation-mode-selector';

describe('CalculationModeSelector', () => {
  it('permite elegir cada mitad del selector diagonal', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <CalculationModeSelector
        selectedMode={undefined}
        onSelect={onSelect}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^Normal/ }));
    await user.click(screen.getByRole('button', { name: /^Cuota objetivo/ }));

    expect(onSelect).toHaveBeenNthCalledWith(1, 'standard');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'target-installment');
  });

  it('mantiene una única superficie de selección al cambiar de modalidad', () => {
    const { rerender } = render(
      <CalculationModeSelector
        selectedMode="standard"
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    const selector = screen.getByRole('group', { name: 'Modalidad de cálculo' });
    expect(selector).toHaveAttribute('data-selected-mode', 'standard');
    expect(selector.querySelectorAll('.cc-calculation-mode-surface')).toHaveLength(1);

    rerender(
      <CalculationModeSelector
        selectedMode="target-installment"
        onSelect={vi.fn()}
        onBack={vi.fn()}
        onContinue={vi.fn()}
      />,
    );

    expect(selector).toHaveAttribute('data-selected-mode', 'target-installment');
  });
});
