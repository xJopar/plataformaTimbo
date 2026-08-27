export type ListaPreciosRoute =
  | { view: 'home' }
  | { view: 'brand'; brand: string }
  | { view: 'suspensions'; brand: string; modelo: string }
  | { view: 'variants'; brand: string; modelo: string; suspension?: string }
  | { view: 'detail'; modelKey: string }
  | { view: 'not-found' };

const HOWO_NX_BRAND = 'SINOTRUK';
const HOWO_NX_MODEL = 'HOWO NX';

export function isHowoNxModel(brand: string, modelo: string): boolean {
  return (
    brand.trim().toUpperCase() === HOWO_NX_BRAND && modelo.trim().toUpperCase() === HOWO_NX_MODEL
  );
}

/**
 * `pathname` puede ser el `launchPath` exacto o cualquiera de sus sub-rutas deep-linkable:
 *   ""                        → home
 *   "/marca/:brand"            → brand
 *   "/marca/:brand/:modelo"    → variants, o suspensions para HOWO NX
 *   "/marca/SINOTRUK/HOWO NX/:suspension" → variants de HOWO NX
 *   "/modelo/:modelKey"        → detail
 */
export function parseListaPreciosRoute(pathname: string, launchPath: string): ListaPreciosRoute {
  if (pathname === launchPath) {
    return { view: 'home' };
  }
  if (!pathname.startsWith(`${launchPath}/`)) {
    return { view: 'not-found' };
  }

  const segments = pathname
    .slice(launchPath.length)
    .split('/')
    .filter((segment) => segment.length > 0)
    .map(decodeURIComponent);

  if (segments[0] === 'marca' && segments.length === 2 && segments[1] !== undefined) {
    return { view: 'brand', brand: segments[1] };
  }
  if (
    segments[0] === 'marca' &&
    segments.length === 3 &&
    segments[1] !== undefined &&
    segments[2] !== undefined
  ) {
    if (isHowoNxModel(segments[1], segments[2])) {
      return { view: 'suspensions', brand: segments[1], modelo: segments[2] };
    }
    return { view: 'variants', brand: segments[1], modelo: segments[2] };
  }
  if (
    segments[0] === 'marca' &&
    segments.length === 4 &&
    segments[1] !== undefined &&
    segments[2] !== undefined &&
    segments[3] !== undefined &&
    isHowoNxModel(segments[1], segments[2])
  ) {
    return {
      view: 'variants',
      brand: segments[1],
      modelo: segments[2],
      suspension: segments[3],
    };
  }
  if (segments[0] === 'modelo' && segments.length === 2 && segments[1] !== undefined) {
    return { view: 'detail', modelKey: segments[1] };
  }

  return { view: 'not-found' };
}

export function buildHomePath(launchPath: string): string {
  return launchPath;
}

export function buildBrandPath(launchPath: string, brand: string): string {
  return `${launchPath}/marca/${encodeURIComponent(brand)}`;
}

export function buildVariantsPath(launchPath: string, brand: string, modelo: string): string {
  return `${launchPath}/marca/${encodeURIComponent(brand)}/${encodeURIComponent(modelo)}`;
}

export function buildSuspensionVariantsPath(
  launchPath: string,
  brand: string,
  modelo: string,
  suspension: string,
): string {
  return `${buildVariantsPath(launchPath, brand, modelo)}/${encodeURIComponent(suspension)}`;
}

export function buildDetailPath(launchPath: string, modelKey: string): string {
  return `${launchPath}/modelo/${encodeURIComponent(modelKey)}`;
}

/**
 * Ruta padre para cuando no hay historial interno propio (deep link directo, ej. un link de
 * WhatsApp): el botón "atrás" de la pantalla necesita ir a algún lado sensato sin depender del
 * historial del navegador. Para `detail` reconstruye marca/modelo a partir de `modelKey`
 * (`getGroupKey` en vehicle-catalog.ts los junta con "|") — si no alcanza para reconstruirlos,
 * vuelve a home.
 */
export function getParentPath(route: ListaPreciosRoute, launchPath: string): string {
  switch (route.view) {
    case 'brand':
      return buildHomePath(launchPath);
    case 'suspensions':
      return buildBrandPath(launchPath, route.brand);
    case 'variants':
      return route.suspension === undefined
        ? buildBrandPath(launchPath, route.brand)
        : buildVariantsPath(launchPath, route.brand, route.modelo);
    case 'detail': {
      const [marca, modelo, , suspension] = route.modelKey.split('|');
      return marca !== undefined && marca !== '' && modelo !== undefined && modelo !== ''
        ? isHowoNxModel(marca, modelo) && suspension !== undefined && suspension !== ''
          ? buildSuspensionVariantsPath(launchPath, marca, modelo, suspension)
          : buildVariantsPath(launchPath, marca, modelo)
        : buildHomePath(launchPath);
    }
    case 'home':
    case 'not-found':
      return buildHomePath(launchPath);
  }
}
