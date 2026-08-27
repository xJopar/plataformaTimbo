import { describe, expect, it } from 'vitest';
import { calculateInstallmentPlan, sumItemsUsd, type CalculatorItem } from './installment-calculator';

function item(overrides: Partial<CalculatorItem>): CalculatorItem {
  return { id: 'item-1', source: 'manual', label: 'Unidad', priceUsd: 100_000, ...overrides };
}

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
    expect(
      calculateInstallmentPlan({
        items: [],
        downPaymentPercent: 20,
        termMonths: 36,
        installmentPeriodicity: 'mensual',
        reinforcementPeriodicity: 'semestral',
      }),
    ).toBeNull();
  });

  it('calcula entrega inicial, cuotas regulares y refuerzos con cuota mensual + refuerzo semestral', () => {
    const plan = calculateInstallmentPlan({
      items: [item({ priceUsd: 100_000 })],
      downPaymentPercent: 20,
      termMonths: 36,
      installmentPeriodicity: 'mensual',
      reinforcementPeriodicity: 'semestral',
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
      items: [item({ priceUsd: 100_000 })],
      downPaymentPercent: 20,
      termMonths: 36,
      installmentPeriodicity: 'semestral',
      reinforcementPeriodicity: 'anual',
    });

    expect(plan?.regularInstallmentCount).toBe(6);
    expect(plan?.reinforcementCount).toBe(3);
  });

  it('redondea los montos hacia arriba al escalón provisorio', () => {
    const plan = calculateInstallmentPlan({
      items: [item({ priceUsd: 100_001 })],
      downPaymentPercent: 20,
      termMonths: 36,
      installmentPeriodicity: 'mensual',
      reinforcementPeriodicity: 'semestral',
    });

    expect(plan?.regularInstallmentAmountUsd).toBeGreaterThan(0);
    expect((plan?.regularInstallmentAmountUsd ?? 0) % 50).toBe(0);
    expect((plan?.reinforcementAmountUsd ?? 0) % 50).toBe(0);
  });

  it('nunca deja la cuota regular en cero aunque el plazo sea corto', () => {
    const plan = calculateInstallmentPlan({
      items: [item({ priceUsd: 1000 })],
      downPaymentPercent: 20,
      termMonths: 36,
      installmentPeriodicity: 'anual',
      reinforcementPeriodicity: 'anual',
    });

    expect(plan?.regularInstallmentCount).toBeGreaterThanOrEqual(1);
  });
});
