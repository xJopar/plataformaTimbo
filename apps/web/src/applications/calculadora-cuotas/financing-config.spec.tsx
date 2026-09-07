import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FinancingConfig, type FinancingConfigValue } from './financing-config';
import type { CalculatorItem } from './installment-calculator';

const ITEMS: CalculatorItem[] = [
  {
    id: 'manual:unit',
    source: 'manual',
    label: 'Unidad',
    priceUsd: 100_000,
    quantity: 1,
  },
];

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
      items={ITEMS}
      value={value}
      totalPriceUsd={100_000}
      totalQuantity={2}
      onBack={vi.fn()}
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

  it('conserva el porcentaje decimal al editarlo', () => {
    const onChange = vi.fn();
    renderConfig(DEFAULT_VALUE, onChange);

    fireEvent.focus(screen.getByLabelText('Porcentaje'));
    fireEvent.change(screen.getByLabelText('Porcentaje'), { target: { value: '20,3' } });
    fireEvent.blur(screen.getByLabelText('Porcentaje'));

    expect(screen.getByLabelText('Porcentaje')).toHaveValue('20,3');
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_VALUE,
      downPaymentMode: 'percent',
      downPaymentPercent: 20.3,
      downPaymentManualUsd: 20_300,
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

    fireEvent.click(screen.getByRole('switch', { name: 'Activar refuerzos' }));

    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_VALUE, reinforcementsEnabled: true });
  });

  it('muestra la cuota objetivo como subtítulo antes de los refuerzos obligatorios', () => {
    const { container } = renderConfig({
      ...DEFAULT_VALUE,
      calculationMode: 'target-installment',
      reinforcementsEnabled: true,
    });
    const targetInstallmentGroup = screen.getByRole('group', { name: 'Monto de cuota objetivo' });
    expect(targetInstallmentGroup).toBeInTheDocument();
    expect(
      within(targetInstallmentGroup).getByLabelText('Monto de cuota objetivo'),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Refuerzos' })).toBeInTheDocument();
    expect(
      Array.from(container.querySelectorAll('.cc-config-controls > fieldset legend')).map(
        (legend) => legend.textContent,
      ),
    ).toEqual(['Monto de cuota objetivo', 'Refuerzos', 'Entrega inicial']);
    expect(
      Array.from(
        container.querySelectorAll('.cc-config-controls input, .cc-config-controls select'),
      )
        .slice(0, 4)
        .map((control) => control.id),
    ).toEqual([
      'cc-desired-regular-installment',
      'cc-term-months',
      'cc-installment-periodicity',
      'cc-reinforcement-periodicity',
    ]);
    expect(screen.queryByRole('switch', { name: 'Activar refuerzos' })).not.toBeInTheDocument();
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

  it('mantiene las condiciones abiertas y marca plazo y frecuencia cuando no quedan cuotas regulares', () => {
    const onCalculate = vi.fn();
    renderConfig(
      {
        ...DEFAULT_VALUE,
        calculationMode: 'target-installment',
        reinforcementsEnabled: true,
        termMonths: 6,
        installmentPeriodicity: 'semestral',
        reinforcementPeriodicity: 'semestral',
        desiredRegularInstallmentAmountUsd: 1_000,
      },
      vi.fn(),
      onCalculate,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Calcular plan' }));

    expect(onCalculate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Plazo en meses')).toHaveClass('cc-input-error');
    expect(screen.getByLabelText('Periodicidad de refuerzos')).toHaveClass('cc-input-error');
    expect(screen.getByText(/no deja cuotas regulares disponibles/i)).toBeInTheDocument();
  });

  it('marca la cuota objetivo cuando supera el saldo financiado', () => {
    const onCalculate = vi.fn();
    renderConfig(
      {
        ...DEFAULT_VALUE,
        calculationMode: 'target-installment',
        reinforcementsEnabled: true,
        desiredRegularInstallmentAmountUsd: 10_000,
      },
      vi.fn(),
      onCalculate,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Calcular plan' }));

    expect(onCalculate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Monto de cuota objetivo')).toHaveClass('cc-input-error');
    expect(screen.getByText(/supera el saldo financiado/i)).toBeInTheDocument();
  });
});
