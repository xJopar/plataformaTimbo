import type { ComponentType } from 'react';
import type { ApplicationComponentProps } from './application-component';
import { CALCULADORA_CUOTAS_LAUNCH_PATH } from './calculadora-cuotas/calculadora-cuotas-routes';
import { CalculadoraCuotasApplication } from './calculadora-cuotas/calculadora-cuotas-application';
import { HelloWorldApplication } from './hello-world/hello-world-application';
import { ListaPreciosApplication } from './lista-precios/lista-precios-application';

const applicationComponents: Record<string, ComponentType<ApplicationComponentProps>> = {
  '/apps/hello-world': HelloWorldApplication,
  '/apps/lista-precios': ListaPreciosApplication,
  [CALCULADORA_CUOTAS_LAUNCH_PATH]: CalculadoraCuotasApplication,
};

/**
 * `pathname` puede ser una sub-ruta interna de la app (deep link), no solo su `launchPath`
 * exacto — se busca la entrada registrada de la que `pathname` cuelga.
 */
export function findApplicationComponent(
  pathname: string,
): ComponentType<ApplicationComponentProps> | undefined {
  const registeredLaunchPath = Object.keys(applicationComponents).find(
    (launchPath) => pathname === launchPath || pathname.startsWith(`${launchPath}/`),
  );
  return registeredLaunchPath === undefined
    ? undefined
    : applicationComponents[registeredLaunchPath];
}
