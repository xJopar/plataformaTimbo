/**
 * PROVISORIO: no hay todavía tabla de interés ni regla de redondeo real (las va a definir el
 * usuario). Este módulo concentra TODA la lógica financiera en un único lugar reemplazable —
 * el resto de la app sólo conoce `InstallmentPlan`, nunca esta fórmula — para que cuando llegue
 * la configuración real, el cambio quede acotado a este archivo.
 *
 * Fórmula provisoria: reparto lineal sin interés. El monto financiado se separa en dos bolsas
 * (cuotas regulares / refuerzos) según PROVISIONAL_REINFORCEMENT_SHARE, y cada bolsa se divide
 * en partes iguales redondeadas hacia arriba a PROVISIONAL_ROUNDING_STEP_USD.
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
  financedAmountUsd: number;
  regularInstallmentCount: number;
  regularInstallmentAmountUsd: number;
  reinforcementCount: number;
  reinforcementAmountUsd: number;
  isProvisional: true;
}

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

const PROVISIONAL_ROUNDING_STEP_USD = 50;
const PROVISIONAL_REINFORCEMENT_SHARE = 0.15;

function roundUpToStep(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export function sumItemsUsd(items: CalculatorItem[]): number {
  return items.reduce((total, item) => total + item.priceUsd, 0);
}

export function calculateInstallmentPlan(input: InstallmentPlanInput): InstallmentPlan | null {
  const totalPriceUsd = sumItemsUsd(input.items);
  if (totalPriceUsd <= 0) {
    return null;
  }

  const rawDownPaymentUsd =
    input.downPaymentMode === 'manual'
      ? input.downPaymentManualUsd
      : (totalPriceUsd * input.downPaymentPercent) / 100;
  const downPaymentUsd = roundUpToStep(
    Math.min(Math.max(rawDownPaymentUsd, 0), totalPriceUsd),
    PROVISIONAL_ROUNDING_STEP_USD,
  );
  const financedAmountUsd = Math.max(0, totalPriceUsd - downPaymentUsd);

  const installmentIntervalMonths = PERIODICITY_MONTHS[input.installmentPeriodicity];
  const reinforcementIntervalMonths = PERIODICITY_MONTHS[input.reinforcementPeriodicity];

  const reinforcementCount = input.reinforcementsEnabled
    ? Math.max(0, Math.floor(input.termMonths / reinforcementIntervalMonths))
    : 0;
  const rawRegularCount = Math.floor(input.termMonths / installmentIntervalMonths);
  // Cuando la cuota regular es mensual, el mes de un refuerzo reemplaza esa cuota (no se pagan
  // las dos el mismo mes) — con periodicidad semestral/anual de cuota regular no hay solapamiento.
  const overlappingMonths = installmentIntervalMonths === 1 ? reinforcementCount : 0;
  const regularInstallmentCount = Math.max(1, rawRegularCount - overlappingMonths);

  const reinforcementPoolUsd =
    reinforcementCount > 0 ? financedAmountUsd * PROVISIONAL_REINFORCEMENT_SHARE : 0;
  const regularPoolUsd = financedAmountUsd - reinforcementPoolUsd;

  const regularInstallmentAmountUsd = roundUpToStep(
    regularPoolUsd / regularInstallmentCount,
    PROVISIONAL_ROUNDING_STEP_USD,
  );
  const reinforcementAmountUsd =
    reinforcementCount > 0
      ? roundUpToStep(reinforcementPoolUsd / reinforcementCount, PROVISIONAL_ROUNDING_STEP_USD)
      : 0;

  return {
    totalPriceUsd,
    downPaymentUsd,
    financedAmountUsd,
    regularInstallmentCount,
    regularInstallmentAmountUsd,
    reinforcementCount,
    reinforcementAmountUsd,
    isProvisional: true,
  };
}
