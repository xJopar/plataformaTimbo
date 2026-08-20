const POSTGRES_URL_PATTERN = /postgres(?:ql)?:\/\/[^\s'"`]+/giu;
// Requiere forma completa local@dominio.tld: no confunde un `@decorator` ni un `usuario@`
// incompleto con un correo real.
const EMAIL_ADDRESS_PATTERN =
  /[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9][A-Za-z0-9-]*(?:\.[A-Za-z0-9][A-Za-z0-9-]*)*\.[A-Za-z]{2,}/gu;
const KEY_VALUE_PATTERN =
  /((?:"|')?([A-Za-z][A-Za-z0-9_-]*)(?:"|')?\s*[:=]\s*)(\{(?:\\.|[^{}])*\}|\[(?:\\.|[^\]])*\]|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|(?:Bearer\s+)?[^\s,}\]\r\n]+)/giu;
const KEY_VALUE_AT_START_PATTERN = new RegExp(`^${KEY_VALUE_PATTERN.source}`, 'iu');
const SENSITIVE_FINAL_SEGMENTS = new Set([
  'token',
  'password',
  'secret',
  'authorization',
  'cookie',
  'state',
  'verifier',
  'code',
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

/**
 * Motor de redacción compartido: lo reutilizan tanto el diagnóstico de arranque como el
 * diagnóstico de peticiones, para no mantener dos contratos incompatibles de secretos.
 */
export function redactDiagnosticText(value: string, databaseUrl: string | undefined): string {
  const databaseUrlRedacted =
    databaseUrl === undefined || databaseUrl === ''
      ? value
      : value.replaceAll(databaseUrl, '[DATABASE_URL REDACTED]');

  const withoutSensitiveUrls = databaseUrlRedacted.replace(
    POSTGRES_URL_PATTERN,
    '[POSTGRES_URL REDACTED]',
  );
  const withoutSensitiveKeyValues = redactAllSensitiveKeyValues(withoutSensitiveUrls);

  // Un correo libre (fuera de una asignación clave=valor reconocida, por ejemplo dentro de un
  // mensaje de error en prosa) es PII y se redacta igual en message, cause y stack.
  return withoutSensitiveKeyValues.replace(EMAIL_ADDRESS_PATTERN, '[EMAIL REDACTED]');
}
