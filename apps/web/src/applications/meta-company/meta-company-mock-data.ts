/**
 * Datos de prueba para la pantalla de metas por asesor, mientras el equipo de Service Layer
 * construye los endpoints reales sobre SQL Server (ver docs/meta-company-servicelayer-endpoints.md).
 * La forma de los tipos y funciones calca ese contrato para que el reemplazo futuro sea mínimo.
 */

export interface AdvisorMonthGoal {
  periodo: string;
  meta: string | null;
}

export interface AdvisorAnnualSummary {
  id_asesor: number;
  asesor: string;
  meses: AdvisorMonthGoal[];
}

interface AdvisorRecord {
  id_asesor: number;
  asesor: string;
  metasPorPeriodo: Map<string, string>;
}

const ADVISORS: AdvisorRecord[] = [
  {
    id_asesor: 152,
    asesor: 'Luis Reguera',
    metasPorPeriodo: new Map([
      ['2026-01-01', '291419.00'],
      ['2026-02-01', '384675.00'],
      ['2026-03-01', '412895.00'],
      ['2026-04-01', '466369.00'],
      ['2026-05-01', '521344.00'],
      ['2026-06-01', '432632.00'],
      ['2026-07-01', '417386.00'],
      ['2026-08-01', '358954.00'],
      ['2026-09-01', '527466.00'],
      ['2026-10-01', '316649.00'],
      ['2026-11-01', '462065.00'],
      ['2026-12-01', '332456.00'],
    ]),
  },
  {
    id_asesor: 153,
    asesor: 'Mirna Ovelar',
    metasPorPeriodo: new Map([
      ['2026-01-01', '198500.00'],
      ['2026-02-01', '205300.00'],
      ['2026-04-01', '210800.00'],
      ['2026-05-01', '220150.00'],
      ['2026-07-01', '198000.00'],
      ['2026-08-01', '215600.00'],
      ['2026-09-01', '230400.00'],
      ['2026-11-01', '225000.00'],
      ['2026-12-01', '240100.00'],
    ]),
  },
  {
    id_asesor: 154,
    asesor: 'Carlos Duarte',
    metasPorPeriodo: new Map([
      ['2026-01-01', '150200.00'],
      ['2026-02-01', '162400.00'],
      ['2026-03-01', '158900.00'],
      ['2026-05-01', '171200.00'],
      ['2026-06-01', '165800.00'],
      ['2026-08-01', '180300.00'],
      ['2026-09-01', '176500.00'],
      ['2026-10-01', '182100.00'],
      ['2026-12-01', '190400.00'],
    ]),
  },
  {
    id_asesor: 155,
    asesor: 'Rocío Benítez',
    metasPorPeriodo: new Map([
      ['2026-02-01', '134200.00'],
      ['2026-03-01', '140500.00'],
      ['2026-04-01', '138900.00'],
      ['2026-06-01', '145600.00'],
      ['2026-07-01', '149200.00'],
      ['2026-09-01', '152800.00'],
      ['2026-10-01', '147300.00'],
      ['2026-11-01', '155100.00'],
    ]),
  },
];

function buildTwelveMonths(anio: number, metasPorPeriodo: Map<string, string>): AdvisorMonthGoal[] {
  return Array.from({ length: 12 }, (_, index) => {
    const periodo = `${anio}-${String(index + 1).padStart(2, '0')}-01`;
    return { periodo, meta: metasPorPeriodo.get(periodo) ?? null };
  });
}

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 260 + Math.random() * 220));
}

function findAdvisor(idAsesor: number): AdvisorRecord | undefined {
  return ADVISORS.find((advisor) => advisor.id_asesor === idAsesor);
}

export async function fetchAdvisorsAnnualSummary(anio: number): Promise<AdvisorAnnualSummary[]> {
  await delay();
  return ADVISORS.map((advisor) => ({
    id_asesor: advisor.id_asesor,
    asesor: advisor.asesor,
    meses: buildTwelveMonths(anio, advisor.metasPorPeriodo),
  }));
}

export async function fetchAdvisorName(idAsesor: number): Promise<string | undefined> {
  await delay();
  return findAdvisor(idAsesor)?.asesor;
}

export async function fetchAdvisorMetas(idAsesor: number, anio: number): Promise<AdvisorMonthGoal[]> {
  await delay();
  return buildTwelveMonths(anio, findAdvisor(idAsesor)?.metasPorPeriodo ?? new Map());
}

export async function saveAdvisorMonthGoal(
  idAsesor: number,
  periodo: string,
  meta: string,
): Promise<AdvisorMonthGoal> {
  await delay();
  const advisor = findAdvisor(idAsesor);
  if (advisor === undefined) {
    throw new Error('Asesor no encontrado.');
  }
  advisor.metasPorPeriodo.set(periodo, meta);
  return { periodo, meta };
}
