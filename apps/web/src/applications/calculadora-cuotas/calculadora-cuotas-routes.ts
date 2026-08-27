/** Ruta bien conocida de la app — coincide con la entrada registrada en `application-registry.tsx`
 * y con el `launchPath` que Administración debe darle de alta en el catálogo de aplicaciones. */
export const CALCULADORA_CUOTAS_LAUNCH_PATH = '/apps/calculadora-cuotas';

export type CalculadoraCuotasRoute =
  | { view: 'home' }
  | { view: 'from-stock'; stock: string }
  | { view: 'not-found' };

/**
 * `pathname` puede ser el `launchPath` exacto o su sub-ruta `desde-stock/:stock` — el deep link
 * que usa Lista de Precios para precargar una unidad puntual (ver `buildFromStockPath`).
 */
export function parseCalculadoraCuotasRoute(
  pathname: string,
  launchPath: string,
): CalculadoraCuotasRoute {
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

  if (segments[0] === 'desde-stock' && segments.length === 2 && segments[1] !== undefined) {
    return { view: 'from-stock', stock: segments[1] };
  }

  return { view: 'not-found' };
}

export function buildFromStockPath(launchPath: string, stock: string): string {
  return `${launchPath}/desde-stock/${encodeURIComponent(stock)}`;
}
