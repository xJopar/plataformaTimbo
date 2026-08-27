import { describe, expect, it } from 'vitest';
import {
  buildBrandPath,
  buildDetailPath,
  buildHomePath,
  buildSuspensionVariantsPath,
  buildVariantsPath,
  getParentPath,
  parseListaPreciosRoute,
} from './lista-precios-routes';

const LAUNCH_PATH = '/apps/lista-precios';

describe('parseListaPreciosRoute', () => {
  it('reconoce home en el launchPath exacto', () => {
    expect(parseListaPreciosRoute(LAUNCH_PATH, LAUNCH_PATH)).toEqual({ view: 'home' });
  });

  it('reconoce una marca', () => {
    expect(parseListaPreciosRoute(`${LAUNCH_PATH}/marca/Scania`, LAUNCH_PATH)).toEqual({
      view: 'brand',
      brand: 'Scania',
    });
  });

  it('reconoce marca + modelo (variantes)', () => {
    expect(parseListaPreciosRoute(`${LAUNCH_PATH}/marca/Scania/R`, LAUNCH_PATH)).toEqual({
      view: 'variants',
      brand: 'Scania',
      modelo: 'R',
    });
  });

  it('agrega el paso de suspensión exclusivamente para SINOTRUK HOWO NX', () => {
    expect(parseListaPreciosRoute(`${LAUNCH_PATH}/marca/SINOTRUK/HOWO%20NX`, LAUNCH_PATH)).toEqual({
      view: 'suspensions',
      brand: 'SINOTRUK',
      modelo: 'HOWO NX',
    });
    expect(
      parseListaPreciosRoute(`${LAUNCH_PATH}/marca/SINOTRUK/HOWO%20NX/Neum%C3%A1tica`, LAUNCH_PATH),
    ).toEqual({
      view: 'variants',
      brand: 'SINOTRUK',
      modelo: 'HOWO NX',
      suspension: 'Neumática',
    });
    expect(parseListaPreciosRoute(`${LAUNCH_PATH}/marca/Scania/R`, LAUNCH_PATH)).toEqual({
      view: 'variants',
      brand: 'Scania',
      modelo: 'R',
    });
  });

  it('reconoce un modelKey codificado, incluyendo el separador "|"', () => {
    expect(
      parseListaPreciosRoute(`${LAUNCH_PATH}/modelo/SCANIA%7CR%7CTRACTO%7C4X2%7C450`, LAUNCH_PATH),
    ).toEqual({ view: 'detail', modelKey: 'SCANIA|R|TRACTO|4X2|450' });
  });

  it('decodifica marcas/modelos con espacios y caracteres especiales', () => {
    expect(
      parseListaPreciosRoute(
        `${LAUNCH_PATH}/marca/${encodeURIComponent('LIBRELATO')}`,
        LAUNCH_PATH,
      ),
    ).toEqual({ view: 'brand', brand: 'LIBRELATO' });
  });

  it('devuelve not-found para un pathname que no cuelga del launchPath', () => {
    expect(parseListaPreciosRoute('/apps/lista-preciosos', LAUNCH_PATH)).toEqual({
      view: 'not-found',
    });
    expect(parseListaPreciosRoute('/apps/hello-world', LAUNCH_PATH)).toEqual({
      view: 'not-found',
    });
  });

  it('devuelve not-found para una sub-ruta desconocida o incompleta', () => {
    expect(parseListaPreciosRoute(`${LAUNCH_PATH}/marca`, LAUNCH_PATH)).toEqual({
      view: 'not-found',
    });
    expect(parseListaPreciosRoute(`${LAUNCH_PATH}/algo-mas`, LAUNCH_PATH)).toEqual({
      view: 'not-found',
    });
  });
});

describe('builders de ruta', () => {
  it('siempre incluyen el launchPath como prefijo y codifican los segmentos', () => {
    expect(buildHomePath(LAUNCH_PATH)).toBe(LAUNCH_PATH);
    expect(buildBrandPath(LAUNCH_PATH, 'Scania')).toBe(`${LAUNCH_PATH}/marca/Scania`);
    expect(buildVariantsPath(LAUNCH_PATH, 'Scania', 'R')).toBe(`${LAUNCH_PATH}/marca/Scania/R`);
    expect(buildSuspensionVariantsPath(LAUNCH_PATH, 'SINOTRUK', 'HOWO NX', 'Neumática')).toBe(
      `${LAUNCH_PATH}/marca/SINOTRUK/HOWO%20NX/Neum%C3%A1tica`,
    );
    expect(buildDetailPath(LAUNCH_PATH, 'SCANIA|R|TRACTO|4X2|450')).toBe(
      `${LAUNCH_PATH}/modelo/SCANIA%7CR%7CTRACTO%7C4X2%7C450`,
    );
  });

  it('parseListaPreciosRoute revierte lo que construyen los builders', () => {
    const detailPath = buildDetailPath(LAUNCH_PATH, 'SCANIA|R|TRACTO|4X2|450');
    expect(parseListaPreciosRoute(detailPath, LAUNCH_PATH)).toEqual({
      view: 'detail',
      modelKey: 'SCANIA|R|TRACTO|4X2|450',
    });
  });
});

describe('getParentPath', () => {
  it('sube de brand a home', () => {
    expect(getParentPath({ view: 'brand', brand: 'Scania' }, LAUNCH_PATH)).toBe(LAUNCH_PATH);
  });

  it('sube de variants a su brand', () => {
    expect(getParentPath({ view: 'variants', brand: 'Scania', modelo: 'R' }, LAUNCH_PATH)).toBe(
      buildBrandPath(LAUNCH_PATH, 'Scania'),
    );
  });

  it('sube de variants filtradas a la selección de suspensión', () => {
    expect(
      getParentPath(
        { view: 'variants', brand: 'SINOTRUK', modelo: 'HOWO NX', suspension: 'Neumática' },
        LAUNCH_PATH,
      ),
    ).toBe(buildVariantsPath(LAUNCH_PATH, 'SINOTRUK', 'HOWO NX'));
  });

  it('reconstruye marca/modelo desde el modelKey para detail', () => {
    expect(
      getParentPath({ view: 'detail', modelKey: 'SCANIA|R|TRACTO|4X2|450' }, LAUNCH_PATH),
    ).toBe(buildVariantsPath(LAUNCH_PATH, 'SCANIA', 'R'));
  });

  it('reconstruye también la suspensión para el detalle de HOWO NX', () => {
    expect(
      getParentPath(
        { view: 'detail', modelKey: 'SINOTRUK|HOWO NX|6X4|NEUMÁTICA|DIESEL' },
        LAUNCH_PATH,
      ),
    ).toBe(buildSuspensionVariantsPath(LAUNCH_PATH, 'SINOTRUK', 'HOWO NX', 'NEUMÁTICA'));
  });

  it('vuelve a home si el modelKey no trae marca y modelo', () => {
    expect(getParentPath({ view: 'detail', modelKey: 'SOLO-MARCA' }, LAUNCH_PATH)).toBe(
      LAUNCH_PATH,
    );
  });
});
