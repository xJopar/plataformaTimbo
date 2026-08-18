import { useCallback, useEffect, useRef, useState } from 'react';
import type { Api, HealthResponse } from './api';

interface AppProps {
  api?: Api;
  configurationError?: Error;
}

type ConnectionState =
  | { status: 'checking' }
  | { status: 'available'; health: HealthResponse }
  | { status: 'unavailable'; error: Error };

export function App({ api, configurationError }: AppProps): React.JSX.Element {
  const currentRequestId = useRef(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>(() => {
    if (configurationError !== undefined) {
      return { status: 'unavailable', error: configurationError };
    }

    return { status: 'checking' };
  });

  const checkConnection = useCallback(async (): Promise<void> => {
    const requestId = currentRequestId.current + 1;
    currentRequestId.current = requestId;

    if (api === undefined) {
      setConnectionState({
        status: 'unavailable',
        error: configurationError ?? new Error('No se pudo configurar la conexión con la API.'),
      });
      return;
    }

    setConnectionState({ status: 'checking' });

    try {
      const health = await api.system.getHealth();
      if (requestId !== currentRequestId.current) {
        return;
      }
      setConnectionState({ status: 'available', health });
    } catch (error: unknown) {
      if (requestId !== currentRequestId.current) {
        return;
      }
      setConnectionState({
        status: 'unavailable',
        error: error instanceof Error ? error : new Error('No se pudo consultar la API.'),
      });
    }
  }, [api, configurationError]);

  useEffect(() => {
    void checkConnection();

    return () => {
      currentRequestId.current += 1;
    };
  }, [checkConnection]);

  if (connectionState.status === 'checking') {
    return (
      <main>
        <h1>Verificando conexión</h1>
        <p>Consultando la disponibilidad de la API.</p>
      </main>
    );
  }

  if (connectionState.status === 'available') {
    return (
      <main>
        <h1>API disponible</h1>
        <p>La API respondió correctamente.</p>
        <dl>
          <dt>Estado</dt>
          <dd>{connectionState.health.status}</dd>
          <dt>Marca de tiempo</dt>
          <dd>{connectionState.health.timestamp}</dd>
        </dl>
      </main>
    );
  }

  return (
    <main>
      <h1>API no disponible</h1>
      <p role="alert">{connectionState.error.message}</p>
      <button type="button" onClick={() => void checkConnection()}>
        Reintentar conexión
      </button>
    </main>
  );
}
