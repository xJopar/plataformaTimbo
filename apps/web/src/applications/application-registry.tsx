import type { ComponentType } from 'react';
import type { ApplicationComponentProps } from './application-component';
import { HelloWorldApplication } from './hello-world/hello-world-application';

const applicationComponents: Record<string, ComponentType<ApplicationComponentProps>> = {
  '/apps/hello-world': HelloWorldApplication,
};

export function findApplicationComponent(
  launchPath: string,
): ComponentType<ApplicationComponentProps> | undefined {
  return applicationComponents[launchPath];
}
