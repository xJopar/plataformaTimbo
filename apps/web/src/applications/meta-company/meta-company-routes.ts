export const META_COMPANY_LAUNCH_PATH = '/apps/meta-company';

export type MetaCompanyRoute =
  | { view: 'advisors' }
  | { view: 'advisor-detail'; advisorId: number; year: number | undefined }
  | { view: 'not-found' };

/**
 * `pathname` puede ser el `launchPath` exacto o su sub-ruta `asesores/:id` /
 * `asesores/:id/:anio` — el deep link a la pantalla de detalle de un asesor.
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

  return { view: 'not-found' };
}

export function buildAdvisorDetailPath(launchPath: string, advisorId: number, year: number): string {
  return `${launchPath}/asesores/${advisorId}/${year}`;
}
