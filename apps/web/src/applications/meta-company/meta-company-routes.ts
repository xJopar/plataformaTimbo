export const META_COMPANY_LAUNCH_PATH = '/apps/meta-company';

export type MetaCompanyRoute =
  | { view: 'advisors' }
  | { view: 'brands' }
  | { view: 'advisor-detail'; advisorId: number; year: number | undefined }
  | { view: 'manage-empresas' }
  | { view: 'manage-negocios' }
  | { view: 'manage-marcas' }
  | { view: 'not-found' };

/**
 * `pathname` puede ser el `launchPath` exacto o alguna de sus sub-rutas deep-linkable:
 *   ""                        → advisors (metas por asesor, default)
 *   "/metas-por-marca"        → brands
 *   "/asesores/:id"           → advisor-detail (año actual)
 *   "/asesores/:id/:anio"     → advisor-detail
 *   "/gestion/empresas"       → manage-empresas
 *   "/gestion/negocios"       → manage-negocios
 *   "/gestion/marcas"         → manage-marcas
 */
export function parseMetaCompanyRoute(pathname: string, launchPath: string): MetaCompanyRoute {
  if (pathname === launchPath) {
    return { view: 'advisors' };
  }
  if (!pathname.startsWith(`${launchPath}/`)) {
    return { view: 'not-found' };
  }

  const segments = pathname
    .slice(launchPath.length)
    .split('/')
    .filter((segment) => segment.length > 0)
    .map(decodeURIComponent);

  if (segments.length === 1 && segments[0] === 'metas-por-marca') {
    return { view: 'brands' };
  }

  if (segments[0] === 'asesores' && (segments.length === 2 || segments.length === 3)) {
    const advisorId = Number(segments[1]);
    if (!Number.isSafeInteger(advisorId) || advisorId <= 0) {
      return { view: 'not-found' };
    }
    if (segments.length === 2) {
      return { view: 'advisor-detail', advisorId, year: undefined };
    }
    const year = Number(segments[2]);
    return Number.isSafeInteger(year) && year > 0
      ? { view: 'advisor-detail', advisorId, year }
      : { view: 'not-found' };
  }

  if (segments[0] === 'gestion' && segments.length === 2) {
    if (segments[1] === 'empresas') return { view: 'manage-empresas' };
    if (segments[1] === 'negocios') return { view: 'manage-negocios' };
    if (segments[1] === 'marcas') return { view: 'manage-marcas' };
  }

  return { view: 'not-found' };
}

export function buildAdvisorDetailPath(launchPath: string, advisorId: number, year: number): string {
  return `${launchPath}/asesores/${advisorId}/${year}`;
}

export function buildBrandGoalsPath(launchPath: string): string {
  return `${launchPath}/metas-por-marca`;
}

export function buildManageEmpresasPath(launchPath: string): string {
  return `${launchPath}/gestion/empresas`;
}

export function buildManageNegociosPath(launchPath: string): string {
  return `${launchPath}/gestion/negocios`;
}

export function buildManageMarcasPath(launchPath: string): string {
  return `${launchPath}/gestion/marcas`;
}
