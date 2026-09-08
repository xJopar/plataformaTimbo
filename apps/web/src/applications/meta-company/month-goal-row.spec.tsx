import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MonthGoalRow, formatMoney, parseMoneyInput } from './month-goal-row';

describe('MonthGoalRow', () => {
  it('muestra importes con miles separados por punto y decimales por coma', () => {
    expect(formatMoney('12220')).toBe('12.220,00');
    expect(parseMoneyInput('12.220,50')).toBe('12220.50');
  });

  it('guarda el importe normalizado después de editarlo', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <MonthGoalRow
        canEdit
        isSaving={false}
        month={{ periodo: '2026-01-01', meta: '12220.00' }}
        onSave={onSave}
      />,
    );

    const input = screen.getByLabelText('Meta de 01/2026 · Ene');
    expect(input).toHaveValue('12.220,00');
    await user.clear(input);
    await user.type(input, '12.220,50');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith('2026-01-01', '12220.50');
  });
});
