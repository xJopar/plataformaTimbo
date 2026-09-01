/**
 * Motor de cálculo del cuotero. Dos piezas de negocio, ambas confirmadas con el usuario:
 *
 * 1) Interés: tabla de tasa anual por (plazo en meses × % de entrega sobre el precio final).
 *    Se aplica como interés simple sobre el monto a financiar: interés = financiado × tasa_anual ×
 *    (plazo_meses / 12). Verificado contra un caso real: precio 11500, entrega 500, plazo 36,
 *    tasa 10% → saldo a financiar 14300 (= 11000 + 11000×0.10×3).
 *
 * 2) Redondeo de cuota: adaptado de `docs/cuotas_redondeo.js` (v6.1), sin refuerzos
 *    extraordinarios (esos son pagos puntuales fuera de calendario que esta calculadora no
 *    modela). La cuota regular se trunca a la decena; la diferencia que eso deja sin cubrir se
 *    concentra en una única "cuota de ajuste" para que la suma total cierre exacto.
 *
 * La bolsa de refuerzos periódicos (monto de cada refuerzo) sigue siendo provisoria: todavía no
 * hay una regla de negocio definida para ese monto, así que se sigue tomando como un porcentaje
 * del saldo a financiar. El resto del cálculo (interés, cuota regular y su redondeo) ya es real.
 */

export type CuotaPeriodicity = 'mensual' | 'semestral' | 'anual';
export type PlazoMeses = 36 | 48 | 60;
export type DownPaymentMode = 'percent' | 'manual';

export interface CalculatorItem {
  id: string;
  source: 'catalog' | 'manual';
  label: string;
  detail?: string;
  priceUsd: number;
}

export interface InstallmentPlanInput {
  items: CalculatorItem[];
  downPaymentMode: DownPaymentMode;
  downPaymentPercent: number;
  downPaymentManualUsd: number;
  termMonths: PlazoMeses;
  installmentPeriodicity: CuotaPeriodicity;
  reinforcementsEnabled: boolean;
  reinforcementPeriodicity: CuotaPeriodicity;
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
  hasAdjustmentInstallment: boolean;
  adjustmentInstallmentAmountUsd: number;
  reinforcementCount: number;
  reinforcementAmountUsd: number;
}

export type InstallmentPlanResult =
  | { status: 'empty' }
  | { status: 'down-payment-too-low'; minPercent: number }
  | { status: 'invalid-term-reinforcement-combination' }
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

/** Forma adjetiva plural para frases como "29 cuotas mensuales de USD 1.520". */
export const PERIODICITY_ADJECTIVE_PLURAL: Record<CuotaPeriodicity, string> = {
  mensual: 'mensuales',
  semestral: 'semestrales',
  anual: 'anuales',
};

/** Tabla de tasa anual (%) para USD: fila = plazo en meses, columna = % de entrega sobre el
 * precio final. Sólo hay datos para USD por ahora. */
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

/** Entrega mínima exigida por la tabla de tasas: por debajo de 20% no hay tasa definida. */
export const MIN_DOWN_PAYMENT_PERCENT = USD_ANNUAL_RATE_TABLE.porcentajeEntregaBins[0];

function findRowIndex(termMonths: number, bins: readonly number[]): number {
  for (let i = 0; i < bins.length; i += 1) {
    const bin = bins[i];
    if (bin !== undefined && termMonths <= bin) return i;
  }
  return bins.length - 1;
}

function findColumnIndex(downPaymentPercent: number, bins: readonly number[]): number {
  for (let i = bins.length - 1; i >= 0; i -= 1) {
    const bin = bins[i];
    if (bin !== undefined && downPaymentPercent >= bin) return i;
  }
  return 0;
}

/** Tasa anual (%) para un plazo y un % de entrega (sobre el precio final) dados. */
export function getAnnualRatePercent(termMonths: number, downPaymentPercent: number): number {
  const row = findRowIndex(termMonths, USD_ANNUAL_RATE_TABLE.plazoMesesBins);
  const col = findColumnIndex(downPaymentPercent, USD_ANNUAL_RATE_TABLE.porcentajeEntregaBins);
  const rate = USD_ANNUAL_RATE_TABLE.matriz[row]?.[col];
  if (rate === undefined) {
    throw new Error(`Tasa no encontrada para plazo=${termMonths}, entrega=${downPaymentPercent}%`);
  }
  return rate;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs((a / gcd(a, b)) * b);
}

const PROVISIONAL_REINFORCEMENT_SHARE = 0.15;
const PROVISIONAL_ROUNDING_STEP_USD = 50;

function roundUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export function sumItemsUsd(items: CalculatorItem[]): number {
  return items.reduce((total, item) => total + item.priceUsd, 0);
}

export function calculateInstallmentPlan(input: InstallmentPlanInput): InstallmentPlanResult {
  const totalPriceUsd = sumItemsUsd(input.items);
  if (totalPriceUsd <= 0) {
    return { status: 'empty' };
  }

  const rawDownPaymentUsd =
    input.downPaymentMode === 'manual'
      ? input.downPaymentManualUsd
      : (totalPriceUsd * input.downPaymentPercent) / 100;
  const downPaymentUsd = Math.min(Math.max(rawDownPaymentUsd, 0), totalPriceUsd);
  const downPaymentPercent = (downPaymentUsd / totalPriceUsd) * 100;

  if (downPaymentPercent < MIN_DOWN_PAYMENT_PERCENT) {
    return { status: 'down-payment-too-low', minPercent: MIN_DOWN_PAYMENT_PERCENT };
  }

  const financedPrincipalUsd = totalPriceUsd - downPaymentUsd;
  const annualRatePercent = getAnnualRatePercent(input.termMonths, downPaymentPercent);
  const interestTotalUsd = financedPrincipalUsd * (annualRatePercent / 100) * (input.termMonths / 12);
  const saldoAFinanciarUsd = financedPrincipalUsd + interestTotalUsd;

  const installmentIntervalMonths = PERIODICITY_MONTHS[input.installmentPeriodicity];
  const reinforcementIntervalMonths = PERIODICITY_MONTHS[input.reinforcementPeriodicity];

  const cuotasTeoricas = Math.floor(input.termMonths / installmentIntervalMonths);
  const reinforcementCount = input.reinforcementsEnabled
    ? Math.floor(input.termMonths / reinforcementIntervalMonths)
    : 0;
  // Una cuota regular y un refuerzo que caen el mismo mes no se pagan por separado: se cuentan
  // los meses de cruce (múltiplos del mcm de ambas periodicidades) y se restan de las cuotas
  // teóricas — igual que `primerCruce`/`contarCrucesDesde` en cuotas_redondeo.js.
  const overlappingMonths =
    reinforcementCount > 0
      ? Math.floor(input.termMonths / lcm(installmentIntervalMonths, reinforcementIntervalMonths))
      : 0;
  let regularInstallmentCount = cuotasTeoricas - overlappingMonths;

  if (regularInstallmentCount <= 0) {
    return { status: 'invalid-term-reinforcement-combination' };
  }

  // Bolsa de refuerzos: PROVISORIO (ver comentario de cabecera) — se reparte en partes iguales
  // redondeadas hacia arriba a la decena de PROVISIONAL_ROUNDING_STEP_USD.
  const reinforcementPoolUsd =
    reinforcementCount > 0 ? saldoAFinanciarUsd * PROVISIONAL_REINFORCEMENT_SHARE : 0;
  const reinforcementAmountUsd =
    reinforcementCount > 0
      ? roundUpToStep(reinforcementPoolUsd / reinforcementCount, PROVISIONAL_ROUNDING_STEP_USD)
      : 0;
  const totalRefuerzosUsd = reinforcementAmountUsd * reinforcementCount;

  // Cuota regular redondeada a la decena (cuotas_redondeo.js v6.1, sin refuerzos extraordinarios).
  const cuotaRegularExacta = (saldoAFinanciarUsd - totalRefuerzosUsd) / regularInstallmentCount;
  const cuotaRegularEntera = Math.floor(cuotaRegularExacta / 10) * 10;

  if (cuotaRegularEntera <= 0) {
    return { status: 'regular-installment-negative' };
  }

  // Lo que el truncado a la decena deja sin cubrir se concentra en una única cuota de ajuste,
  // en vez de repartirse (invisible) entre todas las cuotas regulares.
  let montoRedondeo = saldoAFinanciarUsd - (cuotaRegularEntera * regularInstallmentCount + totalRefuerzosUsd);
  let hasAdjustmentInstallment = false;
  if (montoRedondeo > 0) {
    regularInstallmentCount -= 1;
    montoRedondeo += cuotaRegularEntera;
    hasAdjustmentInstallment = true;
  } else {
    montoRedondeo = 0;
  }

  const totalPagarUsd =
    downPaymentUsd + totalRefuerzosUsd + montoRedondeo + cuotaRegularEntera * regularInstallmentCount;

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
      totalPagarUsd,
      regularInstallmentCount,
      regularInstallmentAmountUsd: cuotaRegularEntera,
      hasAdjustmentInstallment,
      adjustmentInstallmentAmountUsd: montoRedondeo,
      reinforcementCount,
      reinforcementAmountUsd,
    },
  };
}
