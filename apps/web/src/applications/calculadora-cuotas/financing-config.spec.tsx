import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FinancingConfig, type FinancingConfigValue } from './financing-config';

const DEFAULT_VALUE: FinancingConfigValue = {
  downPaymentMode: 'percent',
  downPaymentPercent: 20,
  downPaymentManualUsd: 0,
  termMonths: 36,
  installmentPeriodicity: 'mensual',
  reinforcementsEnabled: false,
  reinforcementPeriodicity: 'semestral',
  desiredRegularInstallmentAmountUsd: 0,
};

function renderConfig(
  value: FinancingConfigValue = DEFAULT_VALUE,
  totalPriceUsd = 100_000,
  onChange = vi.fn(),
) {
  return render(
    <FinancingConfig
      value={value}
      totalPriceUsd={totalPriceUsd}
      totalQuantity={2}
      onBack={vi.fn()}
      onCalculate={vi.fn()}
      onChange={onChange}
    />,
  );
}

describe('FinancingConfig', () => {
  it('muestra el slider, el importe y el resumen con formato es-PY', () => {
    renderConfig(DEFAULT_VALUE, 1_234_567.89);

    expect(screen.getByRole('slider', { name: /porcentaje de entrega inicial/i })).toHaveValue(
      '20.00',
    );
    expect(screen.getByLabelText(/monto de entrega/i)).toHaveValue('246.913,58 USD');
    expect(screen.getByText('987.654,31 USD')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('sincroniza el importe cuando cambia el slider y conserva el origen porcentual', () => {
    const onChange = vi.fn();
    renderConfig(DEFAULT_VALUE, 100_000, onChange);

    fireEvent.change(screen.getByRole('slider', { name: /porcentaje de entrega inicial/i }), {
      target: { value: '25.5' },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_VALUE,
      downPaymentMode: 'percent',
      downPaymentPercent: 25.5,
      downPaymentManualUsd: 25_500,
    });
  });

  it('acepta centavos y agrupadores paraguayos, sincronizando el porcentaje manual', () => {
    const onChange = vi.fn();
    renderConfig(DEFAULT_VALUE, 100_000, onChange);

    fireEvent.change(screen.getByLabelText(/monto de entrega/i), {
      target: { value: '1.234,56 USD' },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_VALUE,
      downPaymentMode: 'manual',
      downPaymentManualUsd: 1234.56,
      downPaymentPercent: 1.23456,
    });
  });

  it('limita la entrega a cero y al precio total frente a valores inválidos', () => {
    const onChange = vi.fn();
    const { rerender } = renderConfig(DEFAULT_VALUE, 100_000, onChange);

    fireEvent.change(screen.getByLabelText(/monto de entrega/i), {
      target: { value: '250.000,01' },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_VALUE,
      downPaymentMode: 'manual',
      downPaymentManualUsd: 100_000,
      downPaymentPercent: 100,
    });

    rerender(
      <FinancingConfig
        value={{ ...DEFAULT_VALUE, downPaymentMode: 'manual', downPaymentManualUsd: 100_000 }}
        totalPriceUsd={100_000}
        totalQuantity={2}
        onBack={vi.fn()}
        onCalculate={vi.fn()}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/monto de entrega/i), {
      target: { value: 'sin importe' },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_VALUE,
      downPaymentMode: 'manual',
      downPaymentManualUsd: 0,
      downPaymentPercent: 0,
    });
  });

  it('conserva el último origen al actualizar el precio total', () => {
    const { rerender } = renderConfig(DEFAULT_VALUE, 100_000);

    rerender(
      <FinancingConfig
        value={DEFAULT_VALUE}
        totalPriceUsd={200_000}
        totalQuantity={2}
        onBack={vi.fn()}
        onCalculate={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/monto de entrega/i)).toHaveValue('40.000,00 USD');

    rerender(
      <FinancingConfig
        value={{
          ...DEFAULT_VALUE,
          downPaymentMode: 'manual',
          downPaymentPercent: 20,
          downPaymentManualUsd: 20_000,
        }}
        totalPriceUsd={200_000}
        totalQuantity={2}
        onBack={vi.fn()}
        onCalculate={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/monto de entrega/i)).toHaveValue('20.000,00 USD');
  });
});
