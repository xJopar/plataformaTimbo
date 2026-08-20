import { buildErrorDiagnosticFields } from './error-diagnostic';

describe('buildErrorDiagnosticFields', () => {
  it('incluye la causa encadenada cuando el error la trae, redactada', () => {
    const cause = new Error('password=causa-secreta');
    const error = new Error('fallo externo', { cause });

    const diagnostic = buildErrorDiagnosticFields(error, undefined);

    expect(diagnostic.cause).toBeDefined();
    expect(diagnostic.cause).toContain('[REDACTED]');
    expect(diagnostic.cause).not.toContain('causa-secreta');
  });

  it('describe una causa que no es Error sin serializarla ciegamente', () => {
    const error = new Error('fallo externo', { cause: { token: 'token-secreto' } });

    const diagnostic = buildErrorDiagnosticFields(error, undefined);

    expect(diagnostic.cause).toContain('[REDACTED]');
    expect(diagnostic.cause).not.toContain('token-secreto');
  });

  it('omite el campo cause cuando el error no la trae', () => {
    const diagnostic = buildErrorDiagnosticFields(new Error('sin causa'), undefined);
    expect(diagnostic.cause).toBeUndefined();
    expect('cause' in diagnostic).toBe(false);
  });

  it('redacta un valor sensible adicional en message, cause y stack cuando el llamador lo entrega', () => {
    const apiInternalOrigin = 'http://api.railway.internal:3000';
    const cause = new Error(`conectando a ${apiInternalOrigin}`);
    const error = new Error(`fallo alcanzando ${apiInternalOrigin}`, { cause });
    error.stack = `Error: fallo alcanzando ${apiInternalOrigin}\n    at intento (${apiInternalOrigin}/health)`;

    const diagnostic = buildErrorDiagnosticFields(error, undefined, [apiInternalOrigin]);
    const serializedDiagnostic = JSON.stringify(diagnostic);

    expect(serializedDiagnostic).not.toContain('api.railway.internal');
    expect(diagnostic.message).toBe('fallo alcanzando [REDACTED]');
    expect(diagnostic.cause).toContain('[REDACTED]');
    expect(diagnostic.stack).toContain('[REDACTED]');
  });

  it('un valor sensible adicional ausente o vacío no sobre-redacta ni rompe el diagnóstico', () => {
    const error = new Error('fallo sin origen interno configurado');

    expect(buildErrorDiagnosticFields(error, undefined, [undefined]).message).toBe(
      'fallo sin origen interno configurado',
    );
    expect(buildErrorDiagnosticFields(error, undefined, ['']).message).toBe(
      'fallo sin origen interno configurado',
    );
    expect(buildErrorDiagnosticFields(error, undefined, []).message).toBe(
      'fallo sin origen interno configurado',
    );
  });
});
