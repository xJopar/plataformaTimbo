import { describe, expect, it } from 'vitest';
import {
  calculateInstallmentPlan,
  formatUsd,
  getAnnualRatePercent,
  sumItemsUsd,
  type CalculatorItem,
  type InstallmentPlanInput,
} from './installment-calculator';

function item(overrides: Partial<CalculatorItem>): CalculatorItem {
  return {
    id: 'item-1',
    source: 'manual',
    label: 'Unidad',
    priceUsd: 100_000,
    quantity: 1,
    ...overrides,
  };
}

const BASE_INPUT: InstallmentPlanInput = {
  items: [],
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

describe('sumItemsUsd', () => {
  it('suma el precio de todos los ítems', () => {
    expect(sumItemsUsd([item({ priceUsd: 1000 }), item({ priceUsd: 500 })])).toBe(1500);
  });

  it('multiplica el precio unitario por la cantidad de cada ítem', () => {
    expect(
      sumItemsUsd([item({ priceUsd: 1000, quantity: 3 }), item({ priceUsd: 500, quantity: 2 })]),
    ).toBe(4000);
  });

  it('devuelve 0 para una lista vacía', () => {
    expect(sumItemsUsd([])).toBe(0);
  });
});

describe('getAnnualRatePercent', () => {
  it('usa la fila y columna exactas de la matriz USD', () => {
    expect(getAnnualRatePercent(12, 20)).toBe(9);
    expect(getAnnualRatePercent(12, 50)).toBe(7.5);
    expect(getAnnualRatePercent(36, 40)).toBe(9);
    expect(getAnnualRatePercent(60, 50)).toBe(9.5);
  });

  it('usa la primera columna cuando la entrega es menor al 20%', () => {
    expect(getAnnualRatePercent(12, 0)).toBe(9);
    expect(getAnnualRatePercent(30, 10)).toBe(10);
  });

  it('acepta un plazo libre y lo lleva al bin superior más cercano', () => {
    expect(getAnnualRatePercent(13, 20)).toBe(9.5);
    expect(getAnnualRatePercent(30, 20)).toBe(10);
    expect(getAnnualRatePercent(72, 20)).toBe(11);
  });
});

describe('formatUsd', () => {
  it('oculta los decimales cuando el importe no los tiene', () => {
    expect(formatUsd(1234567)).toBe('1.234.567 USD');
  });

  it('conserva los decimales significativos y el sufijo USD', () => {
    expect(formatUsd(1234567.8)).toBe('1.234.567,80 USD');
  });
});

describe('calculateInstallmentPlan', () => {
  it('devuelve status empty cuando no hay ítems', () => {
    expect(calculateInstallmentPlan({ ...BASE_INPUT, items: [] })).toEqual({ status: 'empty' });
  });

  it('calcula una entrega inferior al 20% con la primera banda de la tasa', () => {
    const result = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 10_000 })],
      downPaymentPercent: 10,
      termMonths: 36,
    });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.plan.annualRatePercent).toBe(10);
    expect(result.plan.downPaymentUsd).toBe(1000);
  });

  it('calcula cuotas sin redondeo ni cuota de ajuste', () => {
    const result = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 11_500 })],
      downPaymentMode: 'manual',
      downPaymentManualUsd: 2300,
      termMonths: 36,
    });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const { plan } = result;

    expect(plan.downPaymentUsd).toBe(2300);
    expect(plan.financedPrincipalUsd).toBe(9200);
    expect(plan.annualRatePercent).toBe(10);
    expect(plan.interestTotalUsd).toBeCloseTo(2760, 6);
    expect(plan.saldoAFinanciarUsd).toBeCloseTo(11_960, 6);
    expect(plan.regularInstallmentCount).toBe(36);
    expect(plan.regularInstallmentAmountUsd).toBeCloseTo(11_960 / 36, 6);
    expect(plan.totalPagarUsd).toBeCloseTo(14_260, 6);
  });

  it('calcula el sobrante de los refuerzos según las cuotas elegidas por el cliente', () => {
    const result = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 100_000 })],
      downPaymentPercent: 20,
      termMonths: 36,
      reinforcementsEnabled: true,
      calculationMode: 'target-installment',
      reinforcementPeriodicity: 'semestral',
      desiredRegularInstallmentAmountUsd: 1000,
    });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const { plan } = result;

    expect(plan.regularInstallmentCount).toBe(30);
    expect(plan.regularInstallmentAmountUsd).toBe(1000);
    expect(plan.reinforcementCount).toBe(6);
    expect(plan.reinforcementAmountUsd).toBeCloseTo((104_000 - 30_000) / 6, 6);
    expect(plan.totalPagarUsd).toBeCloseTo(124_000, 6);
  });

  it('pide el monto de cuota regular cuando se habilitan refuerzos', () => {
    const result = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 100_000 })],
      reinforcementsEnabled: true,
      calculationMode: 'target-installment',
    });

    expect(result).toEqual({ status: 'reinforcement-installment-required' });
  });

  it('rechaza una frecuencia de refuerzo que no ocurre dentro del plazo', () => {
    const result = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 100_000 })],
      termMonths: 3,
      reinforcementsEnabled: true,
      calculationMode: 'target-installment',
      reinforcementPeriodicity: 'semestral',
      desiredRegularInstallmentAmountUsd: 1_000,
    });

    expect(result).toEqual({ status: 'invalid-term-reinforcement-combination' });
  });

  it('rechaza una cuota regular cuyo total supera el saldo financiado', () => {
    const result = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 100_000 })],
      reinforcementsEnabled: true,
      calculationMode: 'target-installment',
      desiredRegularInstallmentAmountUsd: 10_000,
    });

    expect(result).toEqual({ status: 'reinforcement-amount-negative' });
  });

  it('permite un plazo de un mes', () => {
    const result = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 1000 })],
      termMonths: 1,
    });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.plan.regularInstallmentCount).toBe(1);
  });

  it('descuenta los refuerzos definidos en modalidad normal antes de calcular la cuota regular', () => {
    const result = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 100_000 })],
      downPaymentPercent: 20,
      termMonths: 36,
      reinforcementsEnabled: true,
      reinforcementPeriodicity: 'semestral',
      reinforcementAmountUsd: 2_000,
    });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.plan.reinforcementCount).toBe(6);
    expect(result.plan.reinforcementAmountUsd).toBe(2_000);
    expect(result.plan.regularInstallmentCount).toBe(30);
    expect(result.plan.regularInstallmentAmountUsd).toBeCloseTo((104_000 - 12_000) / 30, 6);
  });
});
