import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';
import {
  ApiHttpError,
  type AdministrationApi,
  type Api,
  type AuthApi,
  type AuthSession,
} from './api';

const session: AuthSession = {
  id: '3f8a7c4e-6597-42d6-891b-7c7cb1fab2bc',
  corporateEmail: 'persona@timbo.com',
  displayName: 'Persona Timbo',
};

function createApi(
  authOverrides: Partial<AuthApi> = {},
  administrationOverrides: Partial<AdministrationApi> = {},
): Api {
  return {
    auth: {
      getSession: vi.fn<AuthApi['getSession']>().mockResolvedValue(session),
      logout: vi.fn<AuthApi['logout']>().mockResolvedValue(undefined),
      getGoogleLoginUrl: vi
        .fn<AuthApi['getGoogleLoginUrl']>()
        .mockReturnValue('http://localhost:3000/api/auth/google'),
      ...authOverrides,
    },
    administration: {
      listUsers: vi.fn<AdministrationApi['listUsers']>().mockResolvedValue([]),
      preauthorizeUser: vi.fn<AdministrationApi['preauthorizeUser']>(),
      updateUser: vi.fn<AdministrationApi['updateUser']>(),
      deactivateUser: vi.fn<AdministrationApi['deactivateUser']>(),
      reactivateUser: vi.fn<AdministrationApi['reactivateUser']>(),
      ...administrationOverrides,
    },
    system: { getHealth: vi.fn() },
  };
}

describe('App', () => {
  it('muestra acceso corporativo cuando la sesión no existe', async () => {
    const api = createApi({ getSession: vi.fn().mockRejectedValue(new ApiHttpError(401)) });
    render(<App api={api} />);

    expect(await screen.findByRole('heading', { name: 'Acceso corporativo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar con Google' })).toBeInTheDocument();
  });

  it('muestra el Home seguro y el estado vacío cuando existe sesión', async () => {
    render(<App api={createApi()} />);

    expect(await screen.findByRole('heading', { name: 'Tablero de despacho' })).toBeInTheDocument();
    expect(screen.getByText('Persona Timbo')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sin aplicaciones asignadas' })).toBeInTheDocument();
    expect(document.querySelector('[data-layout="continuous-empty-surface"]')).toBeInTheDocument();
  });

  it('consume una vez el resultado OAuth, limpia la URL y permite recuperar el acceso', async () => {
    window.history.replaceState({}, '', '/?auth_error=USER_NOT_AUTHORIZED');
    const api = createApi();
    render(<App api={api} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('no está autorizada');
    expect(window.location.search).toBe('');
    expect(api.auth.getSession).not.toHaveBeenCalled();
  });

  it('muestra un fallo técnico recuperable para errores que no son 401', async () => {
    const getSession = vi
      .fn<AuthApi['getSession']>()
      .mockRejectedValueOnce(new ApiHttpError(503))
      .mockResolvedValueOnce(session);
    const user = userEvent.setup();
    render(<App api={createApi({ getSession })} />);

    expect(
      await screen.findByRole('heading', { name: 'No pudimos verificar tu acceso' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Tablero de despacho' })).toBeInTheDocument();
  });

  it('no muestra éxito de logout si la revocación falla y permite reintentar', async () => {
    const logout = vi
      .fn<AuthApi['logout']>()
      .mockRejectedValueOnce(new ApiHttpError(500))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<App api={createApi({ logout })} />);

    await screen.findByRole('heading', { name: 'Tablero de despacho' });
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar la sesión');
    expect(screen.getByRole('heading', { name: 'Tablero de despacho' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar cierre de sesión' }));
    expect(await screen.findByRole('heading', { name: 'Acceso corporativo' })).toBeInTheDocument();
  });

  it('conserva el resultado más reciente bajo StrictMode y respuestas fuera de orden', async () => {
    let resolveFirst: ((value: AuthSession) => void) | undefined;
    const getSession = vi
      .fn<AuthApi['getSession']>()
      .mockImplementationOnce(
        () =>
          new Promise<AuthSession>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(session);

    render(
      <StrictMode>
        <App api={createApi({ getSession })} />
      </StrictMode>,
    );

    expect(await screen.findByRole('heading', { name: 'Tablero de despacho' })).toBeInTheDocument();
    resolveFirst?.({ ...session, displayName: 'Respuesta anterior' });
    await waitFor(() => expect(screen.getByText('Persona Timbo')).toBeInTheDocument());
  });

  it('no usa almacenamiento del navegador para la autenticación', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const api = createApi({ getSession: vi.fn().mockRejectedValue(new ApiHttpError(401)) });

    render(<App api={api} />);

    await screen.findByRole('heading', { name: 'Acceso corporativo' });
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('muestra el panel de Usuarios vacío cuando el administrador abre /admin', async () => {
    window.history.replaceState({}, '', '/admin');
    render(<App api={createApi()} />);

    expect(await screen.findByRole('heading', { name: 'Usuarios' })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'No encontramos usuarios' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute('aria-current', 'page');
  });

  it('muestra un estado sin permiso cuando la API rechaza el panel', async () => {
    window.history.replaceState({}, '', '/admin');
    render(
      <App
        api={createApi(
          {},
          {
            listUsers: vi
              .fn<AdministrationApi['listUsers']>()
              .mockRejectedValue(new ApiHttpError(403)),
          },
        )}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'No tenés permiso para ver Usuarios' }),
    ).toBeInTheDocument();
  });

  it('no ofrece desactivar a un administrador de plataforma protegido', async () => {
    window.history.replaceState({}, '', '/admin');
    render(
      <App
        api={createApi(
          {},
          {
            listUsers: vi.fn<AdministrationApi['listUsers']>().mockResolvedValue([
              {
                id: 'admin-a',
                corporateEmail: 'admin@timbo.com',
                displayName: 'Administrador',
                status: 'ACTIVE',
                createdAt: '2026-08-21T12:00:00.000Z',
                deactivatedAt: null,
                isPlatformAdministrator: true,
              },
            ]),
          },
        )}
      />,
    );

    expect(await screen.findByText('Administrador protegido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
  });
});
