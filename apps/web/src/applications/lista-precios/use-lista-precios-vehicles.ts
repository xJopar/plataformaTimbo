import { useCallback, useEffect, useRef, useState } from 'react';
import type { Api } from '../../api';
import { extractBrands, groupByModel, type BrandSummary, type VehicleGroup } from './data-processor';

export type ListaPreciosVehiclesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; groups: Map<string, VehicleGroup>; brands: BrandSummary[] };

export function useListaPreciosVehicles(api: Api): {
  state: ListaPreciosVehiclesState;
  reload: () => Promise<void>;
} {
  const currentRequestId = useRef(0);
  const [state, setState] = useState<ListaPreciosVehiclesState>({ status: 'loading' });

  const reload = useCallback(async (): Promise<void> => {
    const requestId = currentRequestId.current + 1;
    currentRequestId.current = requestId;
    setState({ status: 'loading' });
    try {
      const vehicles = await api.applications.listListaPreciosVehicles();
      if (requestId === currentRequestId.current) {
        const groups = groupByModel(vehicles);
        setState({ status: 'ready', groups, brands: extractBrands(groups) });
      }
    } catch {
      if (requestId === currentRequestId.current) {
        setState({ status: 'error' });
      }
    }
  }, [api]);

  useEffect(() => {
    void reload();
    return () => {
      currentRequestId.current += 1;
    };
  }, [reload]);

  return { state, reload };
}
