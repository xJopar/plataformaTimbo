import type { ComponentType } from 'react';
import type { ApplicationComponentProps } from './application-component';
import { CALCULADORA_CUOTAS_LAUNCH_PATH } from './calculadora-cuotas/calculadora-cuotas-routes';
import { CalculadoraCuotasApplication } from './calculadora-cuotas/calculadora-cuotas-application';
import { HelloWorldApplication } from './hello-world/hello-world-application';
import { ListaPreciosApplication } from './lista-precios/lista-precios-application';
import { MetaCompanyApplication } from './meta-company/meta-company-application';
import { META_COMPANY_LAUNCH_PATH } from './meta-company/meta-company-routes';
import { SEGUIMIENTO_5S_LAUNCH_PATH } from './seguimiento-5s/seguimiento-5s-routes';
import { Seguimiento5sApplication } from './seguimiento-5s/seguimiento-5s-application';

const applicationComponents: Record<string, ComponentType<ApplicationComponentProps>> = {
  '/apps/hello-world': HelloWorldApplication,
  '/apps/lista-precios': ListaPreciosApplication,
  [META_COMPANY_LAUNCH_PATH]: MetaCompanyApplication,
  [CALCULADORA_CUOTAS_LAUNCH_PATH]: CalculadoraCuotasApplication,
  [SEGUIMIENTO_5S_LAUNCH_PATH]: Seguimiento5sApplication,
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
