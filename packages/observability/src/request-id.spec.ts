import { generateRequestId, isValidIncomingRequestId, resolveRequestId } from './request-id';

describe('isValidIncomingRequestId', () => {
  it('acepta un identificador con charset seguro dentro del límite de longitud', () => {
    expect(isValidIncomingRequestId('a1b2c3-D4_E5.f6')).toBe(true);
  });

  it('rechaza undefined y cadenas vacías', () => {
    expect(isValidIncomingRequestId(undefined)).toBe(false);
    expect(isValidIncomingRequestId('')).toBe(false);
  });

  it('rechaza caracteres fuera del charset seguro, incluidos separadores de header/log', () => {
    expect(isValidIncomingRequestId('id con espacios')).toBe(false);
    expect(isValidIncomingRequestId('id\ncon-salto')).toBe(false);
    expect(isValidIncomingRequestId('id,con,coma')).toBe(false);
    expect(isValidIncomingRequestId('id"con-comillas')).toBe(false);
  });

  it('rechaza un identificador que exceda el límite de longitud', () => {
    expect(isValidIncomingRequestId('a'.repeat(129))).toBe(false);
    expect(isValidIncomingRequestId('a'.repeat(128))).toBe(true);
  });
});

describe('generateRequestId', () => {
  it('genera un UUID', () => {
    const requestId = generateRequestId();
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);
  });
});

describe('resolveRequestId', () => {
  it('preserva un identificador entrante válido', () => {
    expect(resolveRequestId('cliente-valido-123')).toBe('cliente-valido-123');
  });

  it('nunca confía en un identificador entrante inválido: genera uno nuevo', () => {
    const resolved = resolveRequestId('id inválido con espacios');
    expect(resolved).not.toBe('id inválido con espacios');
    expect(isValidIncomingRequestId(resolved)).toBe(true);
  });

  it('genera un identificador cuando no llega ninguno', () => {
    expect(isValidIncomingRequestId(resolveRequestId(undefined))).toBe(true);
  });
});
