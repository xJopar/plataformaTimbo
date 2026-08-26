import { describe, expect, it } from 'vitest';
import { humanizeEventName } from './activity-event-labels';

describe('humanizeEventName', () => {
  it('traduce un evento conocido del catálogo de la plataforma', () => {
    expect(humanizeEventName('access.user_application_assigned')).toBe(
      'Aplicación asignada a usuario',
    );
  });

  it('deriva un texto legible para un evento de uso reportado por otra aplicación', () => {
    expect(humanizeEventName('quote.pdf_downloaded')).toBe('Quote pdf downloaded');
  });

  it('devuelve la clave original si no puede derivar ningún texto', () => {
    expect(humanizeEventName('')).toBe('');
  });
});
