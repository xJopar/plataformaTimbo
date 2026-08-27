import { describe, expect, it } from 'vitest';
import {
  calculateInstallmentPlan,
  sumItemsUsd,
  type CalculatorItem,
  type InstallmentPlanInput,
} from './installment-calculator';

function item(overrides: Partial<CalculatorItem>): CalculatorItem {
  return { id: 'item-1', source: 'manual', label: 'Unidad', priceUsd: 100_000, ...overrides };
}

const BASE_INPUT: InstallmentPlanInput = {
  items: [],
  downPaymentMode: 'percent',
  downPaymentPercent: 20,
  downPaymentManualUsd: 0,
  termMonths: 36,
  installmentPeriodicity: 'mensual',
  reinforcementsEnabled: true,
  reinforcementPeriodicity: 'semestral',
};

describe('sumItemsUsd', () => {
  it('suma el precio de todos los items', () => {
    expect(sumItemsUsd([item({ priceUsd: 1000 }), item({ priceUsd: 500 })])).toBe(1500);
  });

  it('devuelve 0 para una lista vacía', () => {
    expect(sumItemsUsd([])).toBe(0);
  });
});

describe('calculateInstallmentPlan', () => {
  it('devuelve null cuando no hay items', () => {
    expect(calculateInstallmentPlan({ ...BASE_INPUT, items: [] })).toBeNull();
  });

  it('calcula entrega inicial, cuotas regulares y refuerzos con cuota mensual + refuerzo semestral', () => {
    const plan = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 100_000 })],
    });

    expect(plan).not.toBeNull();
    expect(plan?.totalPriceUsd).toBe(100_000);
    expect(plan?.downPaymentUsd).toBe(20_000);
    expect(plan?.financedAmountUsd).toBe(80_000);
    // 36 meses / 6 = 6 refuerzos; 36 cuotas mensuales menos los 6 meses de refuerzo = 30 regulares.
    expect(plan?.reinforcementCount).toBe(6);
    expect(plan?.regularInstallmentCount).toBe(30);
    expect(plan?.isProvisional).toBe(true);
  });

  it('no solapa meses cuando la cuota regular ya es semestral o anual', () => {
    const plan = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 100_000 })],
      installmentPeriodicity: 'semestral',
      reinforcementPeriodicity: 'anual',
    });

    expect(plan?.regularInstallmentCount).toBe(6);
    expect(plan?.reinforcementCount).toBe(3);
  });

  it('redondea los montos hacia arriba al escalón provisorio', () => {
    const plan = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 100_001 })],
    });

    expect(plan?.regularInstallmentAmountUsd).toBeGreaterThan(0);
    expect((plan?.regularInstallmentAmountUsd ?? 0) % 50).toBe(0);
    expect((plan?.reinforcementAmountUsd ?? 0) % 50).toBe(0);
  });

  it('nunca deja la cuota regular en cero aunque el plazo sea corto', () => {
    const plan = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 1000 })],
      installmentPeriodicity: 'anual',
      reinforcementPeriodicity: 'anual',
    });

    expect(plan?.regularInstallmentCount).toBeGreaterThanOrEqual(1);
  });

  it('usa el monto manual de entrega en vez del porcentaje cuando el modo es manual', () => {
    const plan = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 100_000 })],
      downPaymentMode: 'manual',
      downPaymentManualUsd: 15_000,
    });

    expect(plan?.downPaymentUsd).toBe(15_000);
    expect(plan?.financedAmountUsd).toBe(85_000);
  });

  it('no deja financiar un monto negativo cuando la entrega manual supera el precio total', () => {
    const plan = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 10_000 })],
      downPaymentMode: 'manual',
      downPaymentManualUsd: 999_999,
    });

    expect(plan?.financedAmountUsd).toBe(0);
  });

  it('sin refuerzos habilitados, todo el financiamiento va a cuotas regulares', () => {
    const plan = calculateInstallmentPlan({
      ...BASE_INPUT,
      items: [item({ priceUsd: 100_000 })],
      reinforcementsEnabled: false,
    });

    expect(plan?.reinforcementCount).toBe(0);
    expect(plan?.reinforcementAmountUsd).toBe(0);
    // Sin refuerzos no hay solapamiento de meses: 36 cuotas mensuales completas.
    expect(plan?.regularInstallmentCount).toBe(36);
  });
});
