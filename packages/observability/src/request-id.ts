export const INCOMING_REQUEST_ID_HEADER = 'x-request-id';
export const RESPONSE_REQUEST_ID_HEADER = 'X-Request-Id';

const MAX_REQUEST_ID_LENGTH = 128;
// Charset acotado a caracteres seguros para encabezados HTTP y logs: evita inyección de
// saltos de línea o separadores que rompan el JSON estructurado o el propio encabezado.
const VALID_REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]+$/u;

export function isValidIncomingRequestId(value: string | undefined): value is string {
  return (
    value !== undefined &&
    value.length > 0 &&
    value.length <= MAX_REQUEST_ID_LENGTH &&
    VALID_REQUEST_ID_PATTERN.test(value)
  );
}

export function generateRequestId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Un `X-Request-Id` entrante nunca se confía para decisiones de seguridad: sólo se preserva
 * si cumple el formato y límite definidos, y en cualquier otro caso se reemplaza por un UUID
 * generado localmente.
 */
export function resolveRequestId(incomingValue: string | undefined): string {
  return isValidIncomingRequestId(incomingValue) ? incomingValue : generateRequestId();
}
