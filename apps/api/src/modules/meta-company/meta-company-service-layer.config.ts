export interface MetaCompanyServiceLayerConfig {
  baseUrl: string;
  username: string;
  password: string;
  domain: string;
}

function resolveRequiredValue(rawValue: string | undefined, variableName: string): string {
  if (rawValue === undefined || rawValue.trim() === '') {
    throw new Error(`La variable de entorno ${variableName} es obligatoria.`);
  }

  return rawValue.trim();
}

function resolveBaseUrl(rawValue: string | undefined): string {
  const baseUrl = resolveRequiredValue(rawValue, 'META_COMPANY_SERVICE_LAYER_BASE_URL');

  try {
    const parsedUrl = new URL(baseUrl);
    if (
      (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') ||
      parsedUrl.search !== '' ||
      parsedUrl.hash !== ''
    ) {
      throw new Error('invalid base URL');
    }
  } catch {
    throw new Error(
      'La variable de entorno META_COMPANY_SERVICE_LAYER_BASE_URL debe ser una URL HTTP o HTTPS valida, sin parametros ni fragmento.',
    );
  }

  return baseUrl.replace(/\/+$/u, '');
}

/**
 * La configuracion se valida al primer uso del proveedor para que una variable de
 * Service Layer faltante no impida arrancar los modulos que todavia no lo necesitan.
 */
export function resolveMetaCompanyServiceLayerConfig(
  env: NodeJS.ProcessEnv = process.env,
): MetaCompanyServiceLayerConfig {
  return {
    baseUrl: resolveBaseUrl(env.META_COMPANY_SERVICE_LAYER_BASE_URL),
    username: resolveRequiredValue(
      env.META_COMPANY_SERVICE_LAYER_USERNAME,
      'META_COMPANY_SERVICE_LAYER_USERNAME',
    ),
    password: resolveRequiredValue(
      env.META_COMPANY_SERVICE_LAYER_PASSWORD,
      'META_COMPANY_SERVICE_LAYER_PASSWORD',
    ),
    domain: resolveRequiredValue(
      env.META_COMPANY_SERVICE_LAYER_DOMAIN,
      'META_COMPANY_SERVICE_LAYER_DOMAIN',
    ),
  };
}
