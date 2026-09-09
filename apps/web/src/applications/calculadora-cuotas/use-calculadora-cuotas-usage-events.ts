import { useCallback, useEffect, useRef } from 'react';
import {
  ApiHttpError,
  ApplicationsApiUnavailableError,
  type Api,
  type CalculadoraCuotasCalculationSource,
  type CalculadoraCuotasUsageEventName,
} from '../../api';
import { reportBrowserOperationFailed } from '../../browser-diagnostics';
import type { CalculatorItem } from './installment-calculator';

function reportUsageEventFailure(error: unknown): void {
  reportBrowserOperationFailed(error, {
    operation: 'calculadora-cuotas.record-usage-event',
    method: 'POST',
    route: '/api/applications/calculadora-cuotas/usage-events',
    provider: 'api',
    ...(error instanceof ApiHttpError
      ? {
          status: error.status,
          ...(error.requestId === undefined ? {} : { requestId: error.requestId }),
        }
      : {}),
  });

  if (!(error instanceof ApiHttpError) && !(error instanceof ApplicationsApiUnavailableError)) {
    queueMicrotask(() => {
      throw error;
    });
  }
}

export function getCalculationSource(
  items: readonly Pick<CalculatorItem, 'source'>[],
): CalculadoraCuotasCalculationSource {
  const hasCatalogItems = items.some((item) => item.source === 'catalog');
  const hasManualItems = items.some((item) => item.source === 'manual');
  if (hasCatalogItems && hasManualItems) return 'mixed';
  return hasCatalogItems ? 'lista_precios' : 'manual';
}

export function useCalculadoraCuotasUsageEvents(api: Api): {
  recordListaPreciosItemAdded: (itemId: string) => void;
  recordImageExported: (imageId: string, items: readonly CalculatorItem[]) => void;
} {
  const visitId = useRef(crypto.randomUUID());
  const recordedEventKeys = useRef(new Set<string>());

  const recordEvent = useCallback(
    (
      eventName: CalculadoraCuotasUsageEventName,
      dedupeKey: string,
      image?: { imageId: string; calculationSource: CalculadoraCuotasCalculationSource },
    ): void => {
      if (recordedEventKeys.current.has(dedupeKey)) return;
      recordedEventKeys.current.add(dedupeKey);

      void api.applications
        .recordCalculadoraCuotasUsageEvent({
          eventId: crypto.randomUUID(),
          visitId: visitId.current,
          eventName,
          ...(image ?? {}),
        })
        .catch((error: unknown) => {
          recordedEventKeys.current.delete(dedupeKey);
          reportUsageEventFailure(error);
        });
    },
    [api],
  );

  useEffect(() => {
    recordEvent('calculadora-cuotas.opened', 'opened');
  }, [recordEvent]);

  const recordListaPreciosItemAdded = useCallback(
    (itemId: string): void => {
      recordEvent(
        'calculadora-cuotas.lista_precios_item_added',
        `lista-precios-item-added:${itemId}`,
      );
    },
    [recordEvent],
  );

  const recordImageExported = useCallback(
    (imageId: string, items: readonly CalculatorItem[]): void => {
      recordEvent('calculadora-cuotas.image_exported', `image-exported:${imageId}`, {
        imageId,
        calculationSource: getCalculationSource(items),
      });
    },
    [recordEvent],
  );

  return { recordListaPreciosItemAdded, recordImageExported };
}
