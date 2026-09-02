/**
 * Almacén de valores de meta en memoria, mientras el equipo de Service Layer construye los
 * endpoints reales sobre SQL Server (ver docs/meta-company-servicelayer-endpoints.md). La
 * identidad (asesor, marca) siempre viene del catálogo real de la app — este módulo solo
 * recuerda, por tipo+id+período, el valor cargado durante la sesión del navegador.
 */

export type MonthGoalKind = 'advisor' | 'brand';

export interface MonthGoal {
  periodo: string;
  meta: string | null;
}

const goalValues = new Map<string, string>();

function goalKey(kind: MonthGoalKind, id: number, periodo: string): string {
  return `${kind}:${id}:${periodo}`;
}

function buildTwelveMonths(kind: MonthGoalKind, id: number, anio: number): MonthGoal[] {
  return Array.from({ length: 12 }, (_, index) => {
    const periodo = `${anio}-${String(index + 1).padStart(2, '0')}-01`;
    return { periodo, meta: goalValues.get(goalKey(kind, id, periodo)) ?? null };
  });
}

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 260 + Math.random() * 220));
}

export async function fetchMonthGoals(
  kind: MonthGoalKind,
  id: number,
  anio: number,
): Promise<MonthGoal[]> {
  await delay();
  return buildTwelveMonths(kind, id, anio);
}

export async function saveMonthGoal(
  kind: MonthGoalKind,
  id: number,
  periodo: string,
  meta: string,
): Promise<MonthGoal> {
  await delay();
  goalValues.set(goalKey(kind, id, periodo), meta);
  return { periodo, meta };
}
