import type { UsageEventTarget } from '../usage-events/usage-events.service';

export const LISTA_PRECIOS_USAGE_EVENT_NAMES = [
  'lista-precios.catalog_opened',
  'lista-precios.model_viewed',
  'lista-precios.consultation_started',
] as const;

export type ListaPreciosUsageEventName = (typeof LISTA_PRECIOS_USAGE_EVENT_NAMES)[number];

export const LISTA_PRECIOS_MODEL_TARGET_TYPE = 'vehicle_model';
export const LISTA_PRECIOS_BRAND_MAX_LENGTH = 80;
export const LISTA_PRECIOS_MODEL_MAX_LENGTH = 120;

export type ListaPreciosUsageEventRequest =
  | {
      eventId: string;
      visitId: string;
      eventName: 'lista-precios.catalog_opened';
    }
  | {
      eventId: string;
      visitId: string;
      eventName: Exclude<ListaPreciosUsageEventName, 'lista-precios.catalog_opened'>;
      brand: string;
      model: string;
    };

export function isListaPreciosUsageEventName(value: unknown): value is ListaPreciosUsageEventName {
  return (
    typeof value === 'string' &&
    (LISTA_PRECIOS_USAGE_EVENT_NAMES as readonly string[]).includes(value)
  );
}

export function requiresListaPreciosModel(
  eventName: ListaPreciosUsageEventName,
): eventName is Exclude<ListaPreciosUsageEventName, 'lista-precios.catalog_opened'> {
  return eventName !== 'lista-precios.catalog_opened';
}

export function createListaPreciosModelTarget(brand: string, model: string): UsageEventTarget {
  return {
    targetType: LISTA_PRECIOS_MODEL_TARGET_TYPE,
    targetId: createListaPreciosModelKey(brand, model),
  };
}

export function createListaPreciosModelKey(brand: string, model: string): string {
  return [brand, model].map((value) => normalizeListaPreciosModelPart(value)).join('|');
}

export function normalizeListaPreciosModelPart(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('es-PY');
}
