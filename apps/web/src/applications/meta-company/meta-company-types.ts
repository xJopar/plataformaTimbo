import type { ApplicationComponentProps } from '../application-component';

export type Catalogs = Awaited<
  ReturnType<ApplicationComponentProps['api']['applications']['listMetaCompanyCatalogs']>
>;
export type Empresa = Catalogs['empresas'][number];
export type CatalogItem = Catalogs['brands'][number];
export type Advisor = Catalogs['advisors'][number];
export type Capabilities = Awaited<
  ReturnType<ApplicationComponentProps['api']['applications']['getMetaCompanyCapabilities']>
>;

export const EMPTY_CATALOGS: Catalogs = { empresas: [], brands: [], businesses: [], advisors: [] };
export const NO_CAPABILITIES: Capabilities = { canManageCatalogs: false, canManageGoals: false };
