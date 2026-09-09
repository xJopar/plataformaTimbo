import type { UsageEventTarget } from '../usage-events/usage-events.service';

export const CALCULADORA_CUOTAS_USAGE_EVENT_NAMES = [
  'calculadora-cuotas.opened',
  'calculadora-cuotas.lista_precios_item_added',
  'calculadora-cuotas.image_exported',
] as const;

export type CalculadoraCuotasUsageEventName = (typeof CALCULADORA_CUOTAS_USAGE_EVENT_NAMES)[number];

export const CALCULADORA_CUOTAS_IMAGE_ID_PATTERN = /^[A-Z0-9]{8}$/u;
export const CALCULADORA_CUOTAS_IMAGE_TARGET_TYPE = 'calculator_image';
export const CALCULADORA_CUOTAS_CALCULATION_SOURCES = ['manual', 'lista_precios', 'mixed'] as const;

export type CalculadoraCuotasCalculationSource =
  (typeof CALCULADORA_CUOTAS_CALCULATION_SOURCES)[number];

export type CalculadoraCuotasUsageEventRequest =
  | {
      eventId: string;
      visitId: string;
      eventName: Exclude<CalculadoraCuotasUsageEventName, 'calculadora-cuotas.image_exported'>;
    }
  | {
      eventId: string;
      visitId: string;
      eventName: 'calculadora-cuotas.image_exported';
      imageId: string;
      calculationSource: CalculadoraCuotasCalculationSource;
    };

export function isCalculadoraCuotasUsageEventName(
  value: unknown,
): value is CalculadoraCuotasUsageEventName {
  return (
    typeof value === 'string' &&
    (CALCULADORA_CUOTAS_USAGE_EVENT_NAMES as readonly string[]).includes(value)
  );
}

export function isCalculadoraCuotasCalculationSource(
  value: unknown,
): value is CalculadoraCuotasCalculationSource {
  return (
    typeof value === 'string' &&
    (CALCULADORA_CUOTAS_CALCULATION_SOURCES as readonly string[]).includes(value)
  );
}

export function createCalculadoraCuotasImageTarget(imageId: string): UsageEventTarget {
  return { targetType: CALCULADORA_CUOTAS_IMAGE_TARGET_TYPE, targetId: imageId };
}
