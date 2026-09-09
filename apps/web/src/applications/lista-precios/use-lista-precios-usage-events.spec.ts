import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Api } from '../../api';
import type { ListaPreciosRoute } from './lista-precios-routes';
import type { VehicleCatalogState } from '../../vehicle-catalog/use-vehicle-catalog';
import { useListaPreciosUsageEvents } from './use-lista-precios-usage-events';

const vehicleState: VehicleCatalogState = {
  status: 'ready',
  groups: new Map([
    [
      'FACCHINI|GRANELERO|6X4|NEUMATICA|DIESEL',
      {
        key: 'FACCHINI|GRANELERO|6X4|NEUMATICA|DIESEL',
        marca: 'FACCHINI',
        modelo: 'GRANELERO',
        config: '6X4',
        susp: 'NEUMATICA',
        tipoMotor: 'DIESEL',
        tipo: 'Semirremolque',
        name: 'FACCHINI GRANELERO',
        anios: ['2026'],
        precioMin: null,
        precioMax: null,
        stockCount: 1,
        units: [],
      },
    ],
  ]),
  brands: [],
};

describe('useListaPreciosUsageEvents', () => {
  it('registra el catálogo y un modelo una sola vez aunque se llegue a su detalle', async () => {
    const recordListaPreciosUsageEvent = vi.fn().mockResolvedValue(undefined);
    const api = {
      applications: { recordListaPreciosUsageEvent },
    } as unknown as Api;
    const variantRoute: ListaPreciosRoute = {
      view: 'variants',
      brand: 'FACCHINI',
      modelo: 'GRANELERO',
    };
    const { result, rerender } = renderHook<
      { recordConsultationStarted: () => void },
      { route: ListaPreciosRoute }
    >(
      ({ route }: { route: ListaPreciosRoute }) =>
        useListaPreciosUsageEvents(api, route, vehicleState),
      { initialProps: { route: variantRoute } },
    );

    await waitFor(() => {
      expect(recordListaPreciosUsageEvent).toHaveBeenCalledTimes(2);
    });
    expect(recordListaPreciosUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'lista-precios.catalog_opened' }),
    );
    expect(recordListaPreciosUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'lista-precios.model_viewed',
        brand: 'FACCHINI',
        model: 'GRANELERO',
      }),
    );

    rerender({
      route: { view: 'detail', modelKey: 'FACCHINI|GRANELERO|6X4|NEUMATICA|DIESEL' },
    });
    await waitFor(() => {
      expect(recordListaPreciosUsageEvent).toHaveBeenCalledTimes(2);
    });

    act(() => {
      result.current.recordConsultationStarted();
      result.current.recordConsultationStarted();
    });
    await waitFor(() => {
      expect(recordListaPreciosUsageEvent).toHaveBeenCalledTimes(3);
    });
    expect(recordListaPreciosUsageEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventName: 'lista-precios.consultation_started',
        brand: 'FACCHINI',
        model: 'GRANELERO',
      }),
    );
  });
});
