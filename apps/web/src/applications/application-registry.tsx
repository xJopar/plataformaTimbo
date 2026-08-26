import type { ComponentType } from 'react';
import type { ApplicationComponentProps } from './application-component';
import { HelloWorldApplication } from './hello-world/hello-world-application';
import { ListaPreciosApplication } from './lista-precios/lista-precios-application';

const applicationComponents: Record<string, ComponentType<ApplicationComponentProps>> = {
  '/apps/hello-world': HelloWorldApplication,
  '/apps/lista-precios': ListaPreciosApplication,
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
