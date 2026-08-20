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

describe('redactDiagnosticText — valores sensibles adicionales', () => {
  it('redacta un valor sensible adicional conocido por el llamador (por ejemplo un origen interno)', () => {
    const apiInternalOrigin = 'http://api.railway.internal:3000';
    const result = redactDiagnosticText(`fallo al conectar a ${apiInternalOrigin}`, undefined, [
      apiInternalOrigin,
    ]);

    expect(result).toBe('fallo al conectar a [REDACTED]');
    expect(result).not.toContain('api.railway.internal');
  });

  it('redacta varias ocurrencias del mismo valor adicional en el mismo texto', () => {
    const apiInternalOrigin = 'http://api.railway.internal:3000';
    const result = redactDiagnosticText(
      `${apiInternalOrigin} inaccesible; reintentando ${apiInternalOrigin}`,
      undefined,
      [apiInternalOrigin],
    );

    expect(result).toBe('[REDACTED] inaccesible; reintentando [REDACTED]');
  });

  it('un valor adicional ausente o vacío no sobre-redacta ni rompe el texto', () => {
    const message = 'fallo al conectar al upstream';
    expect(redactDiagnosticText(message, undefined, [undefined])).toBe(message);
    expect(redactDiagnosticText(message, undefined, [''])).toBe(message);
    expect(redactDiagnosticText(message, undefined, [])).toBe(message);
    expect(redactDiagnosticText(message, undefined)).toBe(message);
  });

  it('combina la redacción de un valor adicional con DATABASE_URL, secretos y emails sin alterar las reglas existentes', () => {
    const apiInternalOrigin = 'http://api.railway.internal:3000';
    const databaseUrl = 'postgresql://user:password@localhost:5432/timbo';
    const message = `${apiInternalOrigin} no pudo alcanzar ${databaseUrl}, con token=secreto-token y contacto persona@example.test`;

    const result = redactDiagnosticText(message, databaseUrl, [apiInternalOrigin]);

    expect(result).toBe(
      '[REDACTED] no pudo alcanzar [DATABASE_URL REDACTED], con token=[REDACTED] y contacto [EMAIL REDACTED]',
    );
  });
});
