/** Motor de cálculo del cuotero para operaciones en USD. */

export type CuotaPeriodicity = 'mensual' | 'semestral' | 'anual';
export type DownPaymentMode = 'percent' | 'manual';
export type CalculationMode = 'standard' | 'target-installment';

export interface CalculatorItem {
  id: string;
  source: 'catalog' | 'manual';
  label: string;
  detail?: string;
  priceUsd: number;
  quantity: number;
}

export interface InstallmentPlanInput {
  items: CalculatorItem[];
  calculationMode: CalculationMode;
  downPaymentMode: DownPaymentMode;
  downPaymentPercent: number;
  downPaymentManualUsd: number;
  termMonths: number;
  installmentPeriodicity: CuotaPeriodicity;
  reinforcementsEnabled: boolean;
  reinforcementPeriodicity: CuotaPeriodicity;
  reinforcementAmountUsd: number;
  desiredRegularInstallmentAmountUsd: number;
}

export interface InstallmentPlan {
  totalPriceUsd: number;
  downPaymentUsd: number;
  downPaymentPercent: number;
  annualRatePercent: number;
  financedPrincipalUsd: number;
  interestTotalUsd: number;
  saldoAFinanciarUsd: number;
  totalPagarUsd: number;
  regularInstallmentCount: number;
  regularInstallmentAmountUsd: number;
  reinforcementCount: number;
  reinforcementAmountUsd: number;
}

export type InstallmentPlanResult =
  | { status: 'empty' }
  | { status: 'invalid-term-reinforcement-combination' }
  | { status: 'reinforcement-installment-required' }
  | { status: 'reinforcement-amount-negative' }
  | { status: 'regular-installment-negative' }
  | { status: 'ok'; plan: InstallmentPlan };

const PERIODICITY_MONTHS: Record<CuotaPeriodicity, number> = {
  mensual: 1,
  semestral: 6,
  anual: 12,
};

export const PERIODICITY_LABELS: Record<CuotaPeriodicity, string> = {
  mensual: 'Mensual',
  semestral: 'Semestral',
  anual: 'Anual',
};

export const PERIODICITY_ADJECTIVE_PLURAL: Record<CuotaPeriodicity, string> = {
  mensual: 'mensuales',
  semestral: 'semestrales',
  anual: 'anuales',
};

/** La primera banda (20% a <30%) también cubre entregas menores al 20%. */
const USD_ANNUAL_RATE_TABLE = {
  plazoMesesBins: [12, 24, 36, 48, 60],
  porcentajeEntregaBins: [20, 30, 40, 50],
  matriz: [
    [9, 8.5, 8, 7.5],
    [9.5, 9, 8.5, 8],
    [10, 9.5, 9, 8.5],
    [10.5, 10, 9.5, 9],
    [11, 10.5, 10, 9.5],
  ],
} as const;

function findRowIndex(termMonths: number, bins: readonly number[]): number {
  for (let index = 0; index < bins.length; index += 1) {
    const bin = bins[index];
    if (bin !== undefined && termMonths <= bin) return index;
  }
  return bins.length - 1;
}

function findColumnIndex(downPaymentPercent: number, bins: readonly number[]): number {
  for (let index = bins.length - 1; index >= 0; index -= 1) {
    const bin = bins[index];
    if (bin !== undefined && downPaymentPercent >= bin) return index;
  }
  return 0;
}

export function getAnnualRatePercent(termMonths: number, downPaymentPercent: number): number {
  const row = findRowIndex(termMonths, USD_ANNUAL_RATE_TABLE.plazoMesesBins);
  const column = findColumnIndex(downPaymentPercent, USD_ANNUAL_RATE_TABLE.porcentajeEntregaBins);
  const rate = USD_ANNUAL_RATE_TABLE.matriz[row]?.[column];
  if (rate === undefined) {
    throw new Error(
      `Tasa no encontrada para plazo=${String(termMonths)}, entrega=${String(downPaymentPercent)}%`,
    );
  }
  return rate;
}

function greatestCommonDivisor(first: number, second: number): number {
  let dividend = Math.abs(first);
  let divisor = Math.abs(second);
  while (divisor !== 0) {
    [dividend, divisor] = [divisor, dividend % divisor];
  }
  return dividend;
}

function leastCommonMultiple(first: number, second: number): number {
  if (first === 0 || second === 0) return 0;
  return Math.abs((first / greatestCommonDivisor(first, second)) * second);
}

export function formatUsd(amount: number): string {
  return `${amount.toLocaleString('es-PY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD`;
}

export function sumItemsUsd(items: CalculatorItem[]): number {
  return items.reduce((total, item) => total + item.priceUsd * item.quantity, 0);
}

export function calculateInstallmentPlan(input: InstallmentPlanInput): InstallmentPlanResult {
  const totalPriceUsd = sumItemsUsd(input.items);
  if (totalPriceUsd <= 0) return { status: 'empty' };

  const termMonths = Math.max(1, Math.floor(input.termMonths));
  const rawDownPaymentUsd =
    input.downPaymentMode === 'manual'
      ? input.downPaymentManualUsd
      : (totalPriceUsd * input.downPaymentPercent) / 100;
  const downPaymentUsd = Math.min(Math.max(rawDownPaymentUsd, 0), totalPriceUsd);
  const downPaymentPercent = (downPaymentUsd / totalPriceUsd) * 100;
  const financedPrincipalUsd = totalPriceUsd - downPaymentUsd;
  const annualRatePercent = getAnnualRatePercent(termMonths, downPaymentPercent);
  const interestTotalUsd = financedPrincipalUsd * (annualRatePercent / 100) * (termMonths / 12);
  const saldoAFinanciarUsd = financedPrincipalUsd + interestTotalUsd;

  const installmentIntervalMonths = PERIODICITY_MONTHS[input.installmentPeriodicity];
  const reinforcementIntervalMonths = PERIODICITY_MONTHS[input.reinforcementPeriodicity];
  const installmentsInTerm = Math.floor(termMonths / installmentIntervalMonths);
  const reinforcementCount = input.reinforcementsEnabled
    ? Math.floor(termMonths / reinforcementIntervalMonths)
    : 0;
  const overlappingMonths =
    reinforcementCount > 0
      ? Math.floor(
          termMonths / leastCommonMultiple(installmentIntervalMonths, reinforcementIntervalMonths),
        )
      : 0;
  const regularInstallmentCount = installmentsInTerm - overlappingMonths;

  if (regularInstallmentCount <= 0 || (input.reinforcementsEnabled && reinforcementCount === 0)) {
    return { status: 'invalid-term-reinforcement-combination' };
  }

  if (!input.reinforcementsEnabled) {
    const regularInstallmentAmountUsd = saldoAFinanciarUsd / regularInstallmentCount;
    if (regularInstallmentAmountUsd <= 0) return { status: 'regular-installment-negative' };
    return {
      status: 'ok',
      plan: {
        totalPriceUsd,
        downPaymentUsd,
        downPaymentPercent,
        annualRatePercent,
        financedPrincipalUsd,
        interestTotalUsd,
        saldoAFinanciarUsd,
        totalPagarUsd: downPaymentUsd + saldoAFinanciarUsd,
        regularInstallmentCount,
        regularInstallmentAmountUsd,
        reinforcementCount: 0,
        reinforcementAmountUsd: 0,
      },
    };
  }

  if (input.calculationMode === 'standard') {
    if (input.reinforcementAmountUsd <= 0) {
      return { status: 'reinforcement-installment-required' };
    }

    const totalReinforcementsUsd = reinforcementCount * input.reinforcementAmountUsd;
    const regularInstallmentPoolUsd = saldoAFinanciarUsd - totalReinforcementsUsd;
    if (regularInstallmentPoolUsd <= 0) return { status: 'reinforcement-amount-negative' };

    const regularInstallmentAmountUsd = regularInstallmentPoolUsd / regularInstallmentCount;
    if (regularInstallmentAmountUsd <= 0) return { status: 'regular-installment-negative' };

    return {
      status: 'ok',
      plan: {
        totalPriceUsd,
        downPaymentUsd,
        downPaymentPercent,
        annualRatePercent,
        financedPrincipalUsd,
        interestTotalUsd,
        saldoAFinanciarUsd,
        totalPagarUsd: downPaymentUsd + saldoAFinanciarUsd,
        regularInstallmentCount,
        regularInstallmentAmountUsd,
        reinforcementCount,
        reinforcementAmountUsd: input.reinforcementAmountUsd,
      },
    };
  }

  if (input.desiredRegularInstallmentAmountUsd <= 0) {
    return { status: 'reinforcement-installment-required' };
  }

  const totalRegularInstallmentsUsd =
    regularInstallmentCount * input.desiredRegularInstallmentAmountUsd;
  const reinforcementPoolUsd = saldoAFinanciarUsd - totalRegularInstallmentsUsd;
  if (reinforcementPoolUsd < 0) return { status: 'reinforcement-amount-negative' };

  const reinforcementAmountUsd =
    reinforcementCount > 0 ? reinforcementPoolUsd / reinforcementCount : 0;

  return {
    status: 'ok',
    plan: {
      totalPriceUsd,
      downPaymentUsd,
      downPaymentPercent,
      annualRatePercent,
      financedPrincipalUsd,
      interestTotalUsd,
      saldoAFinanciarUsd,
      totalPagarUsd: downPaymentUsd + saldoAFinanciarUsd,
      regularInstallmentCount,
      regularInstallmentAmountUsd: input.desiredRegularInstallmentAmountUsd,
      reinforcementCount,
      reinforcementAmountUsd,
    },
  };
}
