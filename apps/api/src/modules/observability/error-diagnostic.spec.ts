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
});
