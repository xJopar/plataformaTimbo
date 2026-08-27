import { useCallback, useEffect, useRef } from 'react';
import {
  ApiHttpError,
  ApplicationsApiUnavailableError,
  type Api,
  type ListaPreciosUsageEventName,
} from '../../api';
import { reportBrowserOperationFailed } from '../../browser-diagnostics';
import type { ListaPreciosRoute } from './lista-precios-routes';
import type { VehicleCatalogState } from '../../vehicle-catalog/use-vehicle-catalog';

interface ListaPreciosModelIdentity {
  brand: string;
  model: string;
}

function resolveModelIdentity(
  route: ListaPreciosRoute,
  vehiclesState: VehicleCatalogState,
): ListaPreciosModelIdentity | undefined {
  if (vehiclesState.status !== 'ready') return undefined;

  if (route.view === 'variants') {
    const matchingGroup = [...vehiclesState.groups.values()].find(
      (group) => group.marca === route.brand && group.modelo === route.modelo,
    );
    return matchingGroup === undefined
      ? undefined
      : { brand: matchingGroup.marca, model: matchingGroup.modelo };
  }
  if (route.view === 'detail') {
    const group = vehiclesState.groups.get(route.modelKey);
    return group === undefined ? undefined : { brand: group.marca, model: group.modelo };
  }
  return undefined;
}

function createModelDedupeKey(model: ListaPreciosModelIdentity): string {
  return [model.brand, model.model]
    .map((value) => value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('es-PY'))
    .join('|');
}

function reportUsageEventFailure(error: unknown): void {
  reportBrowserOperationFailed(error, {
    operation: 'lista-precios.record-usage-event',
    method: 'POST',
    route: '/api/applications/lista-precios/usage-events',
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

export function useListaPreciosUsageEvents(
  api: Api,
  route: ListaPreciosRoute,
  vehiclesState: VehicleCatalogState,
): { recordConsultationStarted: () => void } {
  const visitId = useRef(crypto.randomUUID());
  const recordedEventKeys = useRef(new Set<string>());

  const recordEvent = useCallback(
    (
      eventName: ListaPreciosUsageEventName,
      dedupeKey: string,
      model?: ListaPreciosModelIdentity,
    ): void => {
      if (recordedEventKeys.current.has(dedupeKey)) return;
      recordedEventKeys.current.add(dedupeKey);

      void api.applications
        .recordListaPreciosUsageEvent({
          eventId: crypto.randomUUID(),
          visitId: visitId.current,
          eventName,
          ...(model === undefined ? {} : { brand: model.brand, model: model.model }),
        })
        .catch((error: unknown) => {
          recordedEventKeys.current.delete(dedupeKey);
          reportUsageEventFailure(error);
        });
    },
    [api],
  );

  useEffect(() => {
    recordEvent('lista-precios.catalog_opened', 'catalog-opened');
  }, [recordEvent]);

  const model = resolveModelIdentity(route, vehiclesState);
  const modelDedupeKey = model === undefined ? undefined : createModelDedupeKey(model);
  useEffect(() => {
    if (model === undefined || modelDedupeKey === undefined) return;
    recordEvent('lista-precios.model_viewed', `model-viewed:${modelDedupeKey}`, model);
  }, [model, modelDedupeKey, recordEvent]);

  const recordConsultationStarted = useCallback((): void => {
    if (model === undefined || modelDedupeKey === undefined) return;
    recordEvent(
      'lista-precios.consultation_started',
      `consultation-started:${modelDedupeKey}`,
      model,
    );
  }, [model, modelDedupeKey, recordEvent]);

  return { recordConsultationStarted };
}
