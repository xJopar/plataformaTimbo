import { describe, expect, it } from 'vitest';
import {
  buildAdvisorDetailPath,
  parseMetaCompanyRoute,
} from './meta-company-routes';

const LAUNCH_PATH = '/apps/meta-company';

describe('parseMetaCompanyRoute', () => {
  it('reconoce la lista de asesores en el launchPath exacto', () => {
    expect(parseMetaCompanyRoute(LAUNCH_PATH, LAUNCH_PATH)).toEqual({ view: 'advisors' });
  });

  it('reconoce el detalle de un asesor con año', () => {
    expect(parseMetaCompanyRoute(`${LAUNCH_PATH}/asesores/152/2026`, LAUNCH_PATH)).toEqual({
      view: 'advisor-detail',
      advisorId: 152,
      year: 2026,
    });
  });

  it('reconoce el detalle de un asesor sin año', () => {
    expect(parseMetaCompanyRoute(`${LAUNCH_PATH}/asesores/152`, LAUNCH_PATH)).toEqual({
      view: 'advisor-detail',
      advisorId: 152,
      year: undefined,
    });
  });

  it('devuelve not-found para un id no numérico', () => {
    expect(parseMetaCompanyRoute(`${LAUNCH_PATH}/asesores/abc`, LAUNCH_PATH)).toEqual({
      view: 'not-found',
    });
  });

  it('devuelve not-found para un año no numérico', () => {
    expect(parseMetaCompanyRoute(`${LAUNCH_PATH}/asesores/152/no-es-un-anio`, LAUNCH_PATH)).toEqual({
      view: 'not-found',
    });
  });

  it('devuelve not-found para un pathname que no cuelga del launchPath', () => {
    expect(parseMetaCompanyRoute('/apps/meta-companyy', LAUNCH_PATH)).toEqual({
      view: 'not-found',
    });
    expect(parseMetaCompanyRoute('/apps/hello-world', LAUNCH_PATH)).toEqual({ view: 'not-found' });
  });

  it('devuelve not-found para una sub-ruta desconocida o incompleta', () => {
    expect(parseMetaCompanyRoute(`${LAUNCH_PATH}/asesores`, LAUNCH_PATH)).toEqual({
      view: 'not-found',
    });
    expect(parseMetaCompanyRoute(`${LAUNCH_PATH}/algo-mas`, LAUNCH_PATH)).toEqual({
      view: 'not-found',
    });
  });
});

describe('buildAdvisorDetailPath', () => {
  it('arma la ruta con launchPath, id y año, y la ruta resultante se vuelve a parsear igual', () => {
    const path = buildAdvisorDetailPath(LAUNCH_PATH, 152, 2026);
    expect(path).toBe(`${LAUNCH_PATH}/asesores/152/2026`);
    expect(parseMetaCompanyRoute(path, LAUNCH_PATH)).toEqual({
      view: 'advisor-detail',
      advisorId: 152,
      year: 2026,
    });
  });
});
