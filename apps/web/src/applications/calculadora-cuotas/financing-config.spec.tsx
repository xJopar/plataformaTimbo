import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FinancingConfig, type FinancingConfigValue } from './financing-config';

const DEFAULT_VALUE: FinancingConfigValue = {
  calculationMode: 'standard',
  downPaymentMode: 'percent',
  downPaymentPercent: 20,
  downPaymentManualUsd: 0,
  termMonths: 36,
  installmentPeriodicity: 'mensual',
  reinforcementsEnabled: false,
  reinforcementPeriodicity: 'semestral',
  reinforcementAmountUsd: 0,
  desiredRegularInstallmentAmountUsd: 0,
};

function renderConfig(
  value: FinancingConfigValue = DEFAULT_VALUE,
  onChange = vi.fn(),
  onCalculate = vi.fn(),
) {
  return render(
    <FinancingConfig
      value={value}
      totalPriceUsd={100_000}
      totalQuantity={2}
      onBack={vi.fn()}
      onChangeMode={vi.fn()}
      onCalculate={onCalculate}
      onChange={onChange}
    />,
  );
}

describe('FinancingConfig', () => {
  it('presenta Condiciones con plazo y periodicidad en el primer bloque', () => {
    renderConfig();
    expect(screen.getByRole('heading', { name: 'Condiciones' })).toBeInTheDocument();
    expect(screen.getByLabelText('Plazo en meses')).toHaveValue('36');
    expect(screen.getByLabelText('Periodicidad')).toHaveValue('mensual');
  });

  it('permite vaciar el plazo sin restablecerlo a uno mientras se escribe', () => {
    const onChange = vi.fn();
    renderConfig(DEFAULT_VALUE, onChange);
    fireEvent.change(screen.getByLabelText('Plazo en meses'), { target: { value: '' } });
    expect(screen.getByLabelText('Plazo en meses')).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sincroniza porcentaje y monto de entrega sin incluir el sufijo en el campo editable', () => {
    const onChange = vi.fn();
    renderConfig(DEFAULT_VALUE, onChange);
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '12.500' } });
    expect(screen.getByLabelText('Monto')).toHaveValue('12.500');
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_VALUE,
      downPaymentMode: 'manual',
      downPaymentManualUsd: 12_500,
      downPaymentPercent: 12.5,
    });
  });

  it('sincroniza el deslizador con el porcentaje y el monto de entrega', () => {
    const onChange = vi.fn();
    renderConfig(DEFAULT_VALUE, onChange);

    fireEvent.change(screen.getByLabelText('Porcentaje de entrega inicial'), {
      target: { value: '25' },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_VALUE,
      downPaymentMode: 'percent',
      downPaymentPercent: 25,
      downPaymentManualUsd: 25_000,
    });
  });

  it('revela los campos de refuerzos al aceptarlos en modalidad normal', () => {
    renderConfig({ ...DEFAULT_VALUE, reinforcementsEnabled: true });
    expect(screen.getByLabelText('Periodicidad de refuerzos')).toBeInTheDocument();
    expect(screen.getByLabelText('Monto de cada refuerzo')).toBeInTheDocument();
  });

  it('activa los refuerzos con el switch moderno', () => {
    const onChange = vi.fn();
    renderConfig(DEFAULT_VALUE, onChange);

    fireEvent.click(screen.getByRole('switch', { name: 'Agregar refuerzos' }));

    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_VALUE, reinforcementsEnabled: true });
  });

  it('muestra cuota objetivo y refuerzos obligatorios en la modalidad correspondiente', () => {
    renderConfig({
      ...DEFAULT_VALUE,
      calculationMode: 'target-installment',
      reinforcementsEnabled: true,
    });
    expect(screen.getByLabelText('Monto de cuota objetivo')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Agregar refuerzos' })).not.toBeInTheDocument();
  });

  it('bloquea el cálculo cuando falta el monto de un refuerzo normal', () => {
    const onCalculate = vi.fn();
    renderConfig({ ...DEFAULT_VALUE, reinforcementsEnabled: true }, vi.fn(), onCalculate);
    fireEvent.click(screen.getByRole('button', { name: 'Calcular plan' }));
    expect(onCalculate).not.toHaveBeenCalled();
    expect(
      screen.getByText('Ingresá el monto de cada refuerzo para continuar.'),
    ).toBeInTheDocument();
  });
});
