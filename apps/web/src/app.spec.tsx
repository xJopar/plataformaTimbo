import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';
import type { Api, HealthResponse, SystemApi } from './api';

interface PendingHealthRequest {
  resolve(health: HealthResponse): void;
  reject(error: Error): void;
}

describe('App', () => {
  it('muestra verificación y luego disponibilidad', async () => {
    let resolveHealth: ((value: HealthResponse) => void) | undefined;
    const getHealth = vi.fn<SystemApi['getHealth']>();
    getHealth.mockImplementation(
      () =>
        new Promise<HealthResponse>((resolve) => {
          resolveHealth = resolve;
        }),
    );
    const systemApi: SystemApi = {
      getHealth,
    };

    render(<App api={{ system: systemApi }} />);
    expect(screen.getByRole('heading', { name: 'Verificando conexión' })).toBeInTheDocument();

    resolveHealth?.({ status: 'ok', timestamp: '2026-08-18T12:00:00.000Z' });

    expect(await screen.findByRole('heading', { name: 'API disponible' })).toBeInTheDocument();
  });

  it('muestra el fallo y permite reintentar la consulta', async () => {
    const getHealth = vi
      .fn<SystemApi['getHealth']>()
      .mockRejectedValueOnce(new Error('No se pudo conectar.'))
      .mockResolvedValueOnce({ status: 'ok', timestamp: '2026-08-18T12:00:00.000Z' });
    const systemApi: SystemApi = { getHealth };
    const user = userEvent.setup();

    const api: Api = { system: systemApi };
    render(<App api={api} />);

    expect(await screen.findByRole('heading', { name: 'API no disponible' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar.');

    await user.click(screen.getByRole('button', { name: 'Reintentar conexión' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'API disponible' })).toBeInTheDocument();
    });
    expect(getHealth).toHaveBeenCalledTimes(2);
  });

  it('muestra un error de configuración como indisponibilidad', () => {
    render(<App configurationError={new Error('VITE_API_BASE_URL no es válida.')} />);

    expect(screen.getByRole('heading', { name: 'API no disponible' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('VITE_API_BASE_URL no es válida.');
  });

  it('conserva la respuesta más reciente cuando StrictMode completa solicitudes fuera de orden', async () => {
    const pendingRequests: PendingHealthRequest[] = [];
    const getHealth = vi.fn<SystemApi['getHealth']>().mockImplementation(
      () =>
        new Promise<HealthResponse>((resolve, reject) => {
          pendingRequests.push({ resolve, reject });
        }),
    );
    const api: Api = { system: { getHealth } };

    render(
      <StrictMode>
        <App api={api} />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(getHealth.mock.calls.length).toBeGreaterThan(1);
    });

    const firstRequest = pendingRequests[0];
    const mostRecentRequest = pendingRequests.at(-1);
    if (firstRequest === undefined || mostRecentRequest === undefined) {
      throw new Error('Se esperaban al menos dos solicitudes de estado.');
    }

    mostRecentRequest.resolve({ status: 'ok', timestamp: '2026-08-18T12:00:00.000Z' });
    expect(await screen.findByRole('heading', { name: 'API disponible' })).toBeInTheDocument();

    firstRequest.reject(new Error('La solicitud anterior falló.'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'API disponible' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'API no disponible' })).not.toBeInTheDocument();
  });
});
