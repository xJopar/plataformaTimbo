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
});
