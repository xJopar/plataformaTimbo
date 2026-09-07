import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiHttpError,
  ApplicationsApiUnavailableError,
  type Api,
  type EquipmentRentalResponse,
} from '../../api';
import { reportBrowserOperationFailed } from '../../browser-diagnostics';

export type EquipmentRentalsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; rentals: EquipmentRentalResponse[] };

function reportEquipmentRentalsFailure(error: unknown): void {
  reportBrowserOperationFailed(error, {
    operation: 'lista-precios.load-equipment-rentals',
    method: 'GET',
    route: '/api/applications/lista-precios/equipment-rentals',
    provider: 'api',
    ...(error instanceof ApiHttpError
      ? {
          status: error.status,
          ...(error.requestId === undefined ? {} : { requestId: error.requestId }),
        }
      : {}),
  });
}

export function useEquipmentRentals(
  api: Api,
  enabled: boolean,
): {
  state: EquipmentRentalsState;
  reload: () => Promise<void>;
} {
  const currentRequestId = useRef(0);
  const [state, setState] = useState<EquipmentRentalsState>({ status: 'loading' });

  const reload = useCallback(async (): Promise<void> => {
    const requestId = currentRequestId.current + 1;
    currentRequestId.current = requestId;
    setState({ status: 'loading' });
    try {
      const rentals = await api.applications.listListaPreciosEquipmentRentals();
      if (requestId === currentRequestId.current) {
        setState({ status: 'ready', rentals });
      }
    } catch (error) {
      reportEquipmentRentalsFailure(error);
      if (!(error instanceof ApiHttpError) && !(error instanceof ApplicationsApiUnavailableError)) {
        queueMicrotask(() => {
          throw error;
        });
        return;
      }
      if (requestId === currentRequestId.current) {
        setState({ status: 'error' });
      }
    }
  }, [api]);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    return () => {
      currentRequestId.current += 1;
    };
  }, [enabled, reload]);

  return { state, reload };
}
