export interface ZohoAnalyticsConfig {
  orgId: string;
  workspaceId: string;
  viewId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

function resolveRequiredZohoValue(rawValue: string | undefined, variableName: string): string {
  if (rawValue === undefined || rawValue.trim() === '') {
    throw new Error(`La variable de entorno ${variableName} es obligatoria.`);
  }

  return rawValue;
}

/**
 * Resuelve y valida la configuración de Zoho Analytics a partir de variables de entorno.
 * Se resuelve al construir el servicio (no en el arranque global de la API) porque sólo
 * el módulo Lista de Precios la necesita; una configuración inválida falla al primer uso
 * en vez de bloquear el arranque de módulos que no dependen de Zoho.
 */
export function resolveZohoAnalyticsConfig(
  env: NodeJS.ProcessEnv = process.env,
): ZohoAnalyticsConfig {
  return {
    orgId: resolveRequiredZohoValue(env.ZOHO_ORG_ID, 'ZOHO_ORG_ID'),
    workspaceId: resolveRequiredZohoValue(env.ZOHO_WORKSPACE_ID, 'ZOHO_WORKSPACE_ID'),
    viewId: resolveRequiredZohoValue(env.ZOHO_VIEW_ID, 'ZOHO_VIEW_ID'),
    clientId: resolveRequiredZohoValue(env.ZOHO_CLIENT_ID, 'ZOHO_CLIENT_ID'),
    clientSecret: resolveRequiredZohoValue(env.ZOHO_CLIENT_SECRET, 'ZOHO_CLIENT_SECRET'),
    refreshToken: resolveRequiredZohoValue(env.ZOHO_REFRESH_TOKEN, 'ZOHO_REFRESH_TOKEN'),
  };
}
