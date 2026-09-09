import { useEffect, useRef, useState } from 'react';
import type { Api, VehicleImage } from '../../api';

export type VehicleImagesState =
  | { status: 'loading' }
  | { status: 'ready'; images: VehicleImage[] };

/**
 * Trae las fotos de un Stock bajo demanda (no vienen en el catálogo masivo: la mayoría de las
 * pantallas de Lista de Precios, y otras apps como Calculadora de Cuotas que reusan el mismo
 * catálogo, no las necesitan). Se pide de nuevo cada vez que cambia `stock`, descartando
 * respuestas que lleguen tarde para un stock que ya no es el actual.
 */
export function useVehicleImages(api: Api, stock: string): VehicleImagesState {
  const [state, setState] = useState<VehicleImagesState>({ status: 'loading' });
  const currentRequestId = useRef(0);

  useEffect(() => {
    const requestId = currentRequestId.current + 1;
    currentRequestId.current = requestId;
    setState({ status: 'loading' });

    api.applications
      .getListaPreciosVehicleImages(stock)
      .then((images) => {
        if (requestId === currentRequestId.current) {
          setState({ status: 'ready', images });
        }
      })
      .catch(() => {
        if (requestId === currentRequestId.current) {
          setState({ status: 'ready', images: [] });
        }
      });

    return () => {
      currentRequestId.current += 1;
    };
  }, [api, stock]);

  return state;
}
