import { redactDiagnosticText } from './secret-redaction';

describe('redactDiagnosticText — redacción de correos libres', () => {
  it('redacta un correo suelto dentro de un mensaje en prosa', () => {
    const result = redactDiagnosticText('Usuario persona@example.test no encontrado', undefined);
    expect(result).toBe('Usuario [EMAIL REDACTED] no encontrado');
  });

  it('redacta un correo aunque la clave que lo precede no sea sensible', () => {
    const result = redactDiagnosticText('email=persona@example.test, fin', undefined);
    expect(result).toBe('email=[EMAIL REDACTED], fin');
  });

  it('redacta varios correos distintos en el mismo texto', () => {
    const result = redactDiagnosticText(
      'de remitente@dominio.test a destinatario@otro-dominio.test',
      undefined,
    );
    expect(result).toBe('de [EMAIL REDACTED] a [EMAIL REDACTED]');
  });

  it.each([
    ['un decorador de NestJS/Swagger', '@ApiOperation({ summary: "x" })'],
    ['un usuario de red social sin dominio', 'contactar a @persona por soporte'],
    ['un @ seguido de texto sin forma de dominio con punto', 'reportado por usuario@interno'],
    ['una URL sin arroba', 'https://example.test:8443/path'],
    ['texto con dos puntos sin correo', 'etiqueta=visible:con-contexto'],
  ])('no sobre-redacta un negativo razonable: %s', (_description, input) => {
    expect(redactDiagnosticText(input, undefined)).toBe(input);
  });

  it('no interfiere con la redacción previa de DATABASE_URL/postgres, que ya contienen @', () => {
    const databaseUrl = 'postgresql://user:password@localhost:5432/timbo';
    const result = redactDiagnosticText(`fallo al conectar a ${databaseUrl}`, databaseUrl);

    expect(result).toBe('fallo al conectar a [DATABASE_URL REDACTED]');
    expect(result).not.toContain('@localhost');
  });
});
