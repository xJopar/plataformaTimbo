export interface StartupFailureDiagnostic {
  event: 'api.bootstrap.failed';
  operation: 'bootstrap';
  name: string;
  code?: string;
  message: string;
  stack?: string;
}

const POSTGRES_URL_PATTERN = /postgres(?:ql)?:\/\/[^\s'"`]+/giu;
const KEY_VALUE_PATTERN =
  /((?:"|')?([A-Za-z][A-Za-z0-9_-]*)(?:"|')?\s*[:=]\s*)(\{(?:\\.|[^{}])*\}|\[(?:\\.|[^\]])*\]|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|(?:Bearer\s+)?[^\s,}\]\r\n]+)/giu;
const KEY_VALUE_AT_START_PATTERN = new RegExp(`^${KEY_VALUE_PATTERN.source}`, 'iu');
const SENSITIVE_FINAL_SEGMENTS = new Set([
  'token',
  'password',
  'secret',
  'authorization',
  'cookie',
]);

function splitKeySegments(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .split(/[-_\s]+/u)
    .filter((segment) => segment !== '')
    .map((segment) => segment.toLowerCase());
}

function isSensitiveKey(key: string): boolean {
  const segments = splitKeySegments(key);
  const finalSegment = segments.at(-1);
  const previousSegment = segments.at(-2);

  return (
    (finalSegment !== undefined && SENSITIVE_FINAL_SEGMENTS.has(finalSegment)) ||
    (finalSegment === 'key' && previousSegment === 'api')
  );
}

function redactSensitiveKeyValue(
  match: string,
  prefix: string,
  key: string,
  value: string,
): string {
  if (!isSensitiveKey(key)) {
    const containsNestedAssignment = value.includes('=') || value.includes(':');
    // `value` empieza después del separador de la asignación exterior, por lo que cada llamada recursiva recibe una subcadena menor.
    const nestedRedactedValue = containsNestedAssignment ? redactSensitiveKeyValues(value) : value;
    return nestedRedactedValue === value ? match : `${prefix}${nestedRedactedValue}`;
  }

  const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"');
  const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");
  const redactedValue = hasDoubleQuotes
    ? '"[REDACTED]"'
    : hasSingleQuotes
      ? "'[REDACTED]'"
      : '[REDACTED]';

  return `${prefix}${redactedValue}`;
}

function redactSensitiveKeyValues(value: string): string {
  return value.replace(KEY_VALUE_PATTERN, redactSensitiveKeyValue);
}

function redactAllSensitiveKeyValues(text: string): string {
  let redactedText = '';
  let position = 0;

  while (position < text.length) {
    const match = KEY_VALUE_AT_START_PATTERN.exec(text.slice(position));

    if (match?.index !== 0) {
      redactedText += text.charAt(position);
      position += 1;
      continue;
    }

    const [matchedText, prefix, key, value] = match;

    if (prefix === undefined || key === undefined || value === undefined) {
      redactedText += text.charAt(position);
      position += 1;
      continue;
    }

    if (isSensitiveKey(key)) {
      const hasUnclosedQuote =
        (value.startsWith('"') && !value.endsWith('"')) ||
        (value.startsWith("'") && !value.endsWith("'"));

      if (hasUnclosedQuote) {
        const remainingValue = text.slice(position + prefix.length);
        const openingQuote = remainingValue.charAt(0);
        const delimiterPosition = remainingValue.search(/[,}\]\r\n]/u);
        const unterminatedValue =
          delimiterPosition === -1 ? remainingValue : remainingValue.slice(0, delimiterPosition);

        redactedText += `${prefix}${openingQuote}[REDACTED]`;
        position += prefix.length + unterminatedValue.length;
        continue;
      }

      redactedText += redactSensitiveKeyValue(matchedText, prefix, key, value);
      position += matchedText.length;
      continue;
    }

    const containsNestedAssignment = value.includes('=') || value.includes(':');
    const nextCharacter = text.charAt(position + matchedText.length);
    const hasSafeValueBoundary =
      nextCharacter === '' || [',', '}', ']', '\r', '\n'].includes(nextCharacter);
    const nestedRedactedValue =
      containsNestedAssignment && hasSafeValueBoundary ? redactAllSensitiveKeyValues(value) : value;

    if (nestedRedactedValue !== value) {
      redactedText += `${prefix}${nestedRedactedValue}`;
      position += matchedText.length;
      continue;
    }

    redactedText += text.charAt(position);
    position += 1;
  }

  return redactedText;
}

function redactDiagnosticText(value: string, databaseUrl: string | undefined): string {
  const databaseUrlRedacted =
    databaseUrl === undefined || databaseUrl === ''
      ? value
      : value.replaceAll(databaseUrl, '[DATABASE_URL REDACTED]');

  return redactAllSensitiveKeyValues(
    databaseUrlRedacted.replace(POSTGRES_URL_PATTERN, '[POSTGRES_URL REDACTED]'),
  );
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const code = error.code;
  return typeof code === 'string' || typeof code === 'number' ? String(code) : undefined;
}

/**
 * El handler terminal no puede asumir que dependencias externas redacten sus propios errores.
 * Conserva el contexto técnico útil, pero sanea cada texto antes de enviarlo al log.
 */
export function createStartupFailureDiagnostic(
  error: unknown,
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): StartupFailureDiagnostic {
  const code = getErrorCode(error);

  if (!(error instanceof Error)) {
    return {
      event: 'api.bootstrap.failed',
      operation: 'bootstrap',
      name: 'NonErrorThrown',
      ...(code === undefined ? {} : { code: redactDiagnosticText(code, databaseUrl) }),
      message: `Se lanzó un valor no Error de tipo ${typeof error}.`,
    };
  }

  return {
    event: 'api.bootstrap.failed',
    operation: 'bootstrap',
    name: redactDiagnosticText(error.name, databaseUrl),
    ...(code === undefined ? {} : { code: redactDiagnosticText(code, databaseUrl) }),
    message: redactDiagnosticText(error.message, databaseUrl),
    ...(error.stack === undefined ? {} : { stack: redactDiagnosticText(error.stack, databaseUrl) }),
  };
}
