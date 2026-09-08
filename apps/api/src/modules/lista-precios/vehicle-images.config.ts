export interface VehicleImagesConfig {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
}

function resolveRequiredValue(rawValue: string | undefined, variableName: string): string {
  if (rawValue === undefined || rawValue.trim() === '') {
    throw new Error(`La variable de entorno ${variableName} es obligatoria.`);
  }
  return rawValue;
}

/**
 * Resuelve la configuración del bucket S3-compatible (Railway Bucket) que guarda las fotos de
 * Lista de Precios. Se resuelve al primer uso, igual que `resolveZohoAnalyticsConfig`, para no
 * bloquear el arranque de módulos que no dependen de esto.
 */
export function resolveVehicleImagesConfig(
  env: NodeJS.ProcessEnv = process.env,
): VehicleImagesConfig {
  const trimmedRegion = env.REGION?.trim();
  return {
    bucket: resolveRequiredValue(env.BUCKET, 'BUCKET'),
    accessKeyId: resolveRequiredValue(env.ACCESS_KEY_ID, 'ACCESS_KEY_ID'),
    secretAccessKey: resolveRequiredValue(env.SECRET_ACCESS_KEY, 'SECRET_ACCESS_KEY'),
    endpoint: resolveRequiredValue(env.ENDPOINT, 'ENDPOINT'),
    region: trimmedRegion !== undefined && trimmedRegion !== '' ? trimmedRegion : 'auto',
  };
}
