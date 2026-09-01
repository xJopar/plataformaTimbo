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

  it('traduce los hitos de Lista de Precios para Actividad', () => {
    expect(humanizeEventName('lista-precios.model_viewed')).toBe('Vio un modelo');
  });

  it('traduce las mutaciones auditadas de Meta Company para Actividad', () => {
    expect(humanizeEventName('meta-company.brand_deactivated')).toBe('Marca desactivada');
  });
});
