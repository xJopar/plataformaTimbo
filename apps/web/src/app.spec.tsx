import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';
import {
  ApiHttpError,
  type AdministrationApi,
  type Api,
  type ApplicationsApi,
  type AuthApi,
  type AuthSession,
  type AuthorizedApplication,
} from './api';

vi.mock('./applications/hello-world/mymemory-translation', () => ({
  translateEnglishToSpanish: vi.fn((originalText: string) =>
    Promise.resolve(originalText === 'Recovered joke.' ? 'Chiste recuperado.' : 'Un chiste corto.'),
  ),
}));

const session: AuthSession = {
  id: '3f8a7c4e-6597-42d6-891b-7c7cb1fab2bc',
  corporateEmail: 'persona@timbo.com',
  displayName: 'Persona Timbo',
  isPlatformAdministrator: false,
};

const platformAdministratorSession: AuthSession = {
  ...session,
  isPlatformAdministrator: true,
};

const authorizedApplication: AuthorizedApplication = {
  key: 'hello-world',
  name: 'Hello World',
  description: 'Primera aplicación de Plataforma Timbo.',
  launchPath: '/apps/hello-world',
  displayOrder: 0,
};

const secondAuthorizedApplication: AuthorizedApplication = {
  key: 'price-list',
  name: 'Lista de Precios',
  description: 'Consulta interna de precios.',
  launchPath: '/apps/price-list',
  displayOrder: 1,
};

const listaPreciosApplication: AuthorizedApplication = {
  key: 'lista-precios',
  name: 'Lista de Precios',
  description: 'Catálogo de stock y precios de vehículos.',
  launchPath: '/apps/lista-precios',
  displayOrder: 1,
};

function createApi(
  authOverrides: Partial<AuthApi> = {},
  administrationOverrides: Partial<AdministrationApi> = {},
  applicationsOverrides: Partial<ApplicationsApi> = {},
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
      listApplications: vi.fn<AdministrationApi['listApplications']>().mockResolvedValue([]),
      createApplication: vi.fn<AdministrationApi['createApplication']>(),
      updateApplication: vi.fn<AdministrationApi['updateApplication']>(),
      deactivateApplication: vi.fn<AdministrationApi['deactivateApplication']>(),
      reactivateApplication: vi.fn<AdministrationApi['reactivateApplication']>(),
      listUserApplicationAccesses: vi
        .fn<AdministrationApi['listUserApplicationAccesses']>()
        .mockResolvedValue([]),
      assignApplicationToUser: vi.fn<AdministrationApi['assignApplicationToUser']>(),
      unassignApplicationFromUser: vi.fn<AdministrationApi['unassignApplicationFromUser']>(),
      listApplicationPermissions: vi
        .fn<AdministrationApi['listApplicationPermissions']>()
        .mockResolvedValue([]),
      listApplicationProfiles: vi
        .fn<AdministrationApi['listApplicationProfiles']>()
        .mockResolvedValue([]),
      createApplicationProfile: vi.fn<AdministrationApi['createApplicationProfile']>(),
      updateApplicationProfile: vi.fn<AdministrationApi['updateApplicationProfile']>(),
      deactivateApplicationProfile: vi.fn<AdministrationApi['deactivateApplicationProfile']>(),
      reactivateApplicationProfile: vi.fn<AdministrationApi['reactivateApplicationProfile']>(),
      addPermissionToApplicationProfile:
        vi.fn<AdministrationApi['addPermissionToApplicationProfile']>(),
      removePermissionFromApplicationProfile:
        vi.fn<AdministrationApi['removePermissionFromApplicationProfile']>(),
      assignApplicationProfileToUser: vi.fn<AdministrationApi['assignApplicationProfileToUser']>(),
      unassignApplicationProfileFromUser:
        vi.fn<AdministrationApi['unassignApplicationProfileFromUser']>(),
      listUsers: vi.fn<AdministrationApi['listUsers']>().mockResolvedValue([]),
      preauthorizeUser: vi.fn<AdministrationApi['preauthorizeUser']>(),
      preauthorizeUsersBulk: vi
        .fn<AdministrationApi['preauthorizeUsersBulk']>()
        .mockResolvedValue([]),
      assignApplicationToUsers: vi
        .fn<AdministrationApi['assignApplicationToUsers']>()
        .mockResolvedValue([]),
      unassignApplicationFromUsers: vi
        .fn<AdministrationApi['unassignApplicationFromUsers']>()
        .mockResolvedValue([]),
      updateUser: vi.fn<AdministrationApi['updateUser']>(),
      deactivateUser: vi.fn<AdministrationApi['deactivateUser']>(),
      reactivateUser: vi.fn<AdministrationApi['reactivateUser']>(),
      listActivity: vi.fn<AdministrationApi['listActivity']>().mockResolvedValue({
        items: [],
        total: 0,
        limit: 25,
        offset: 0,
      }),
      getActivityStatistics: vi.fn<AdministrationApi['getActivityStatistics']>().mockResolvedValue({
        eventsToday: 0,
        activePeopleToday: 0,
        mostFrequentApp: null,
        mostFrequentEvent: null,
      }),
      getActivityFilterOptions: vi
        .fn<AdministrationApi['getActivityFilterOptions']>()
        .mockResolvedValue({
          actors: [],
          sources: ['AUDIT', 'USAGE'],
          apps: [],
          events: [],
          targets: [],
        }),
      downloadActivityCsv: vi.fn<AdministrationApi['downloadActivityCsv']>(),
      ...administrationOverrides,
    },
    applications: {
      listAuthorizedApplications: vi
        .fn<ApplicationsApi['listAuthorizedApplications']>()
        .mockResolvedValue([]),
      requestHelloWorldJoke: vi.fn<ApplicationsApi['requestHelloWorldJoke']>().mockResolvedValue({
        id: 'joke-a',
        originalText: 'A short joke.',
      }),
      listListaPreciosVehicles: vi
        .fn<ApplicationsApi['listListaPreciosVehicles']>()
        .mockResolvedValue([]),
      ...applicationsOverrides,
    },
    system: { getHealth: vi.fn() },
  };
}

describe('App', () => {
  it('muestra acceso corporativo cuando la sesión no existe', async () => {
    const api = createApi({ getSession: vi.fn().mockRejectedValue(new ApiHttpError(401)) });
    render(<App api={api} />);

    expect(await screen.findByRole('heading', { name: 'Iniciá sesión' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar con Google' })).toBeInTheDocument();
    expect(document.querySelector('.access-brand-picture source')).toHaveAttribute(
      'srcset',
      expect.stringContaining('fotografia-sede-timbo-640.webp'),
    );
    expect(document.querySelector('.access-wordmark')).toHaveAttribute(
      'src',
      '/marca/logotipo-timbo-blanco-transparente.webp',
    );
  });

  it('muestra el launcher seguro y el estado vacío cuando existe sesión', async () => {
    render(<App api={createApi()} />);

    expect(await screen.findByRole('heading', { name: 'Apps' })).toBeInTheDocument();
    expect(screen.getByText('Persona Timbo')).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        'La pasión por el cliente guía cada solución que ponemos en tus manos.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Administración de plataforma' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Sin aplicaciones asignadas' }),
    ).toBeInTheDocument();
    expect(document.querySelector('[data-layout="application-launcher-grid"]')).toBeInTheDocument();
  });

  it('mantiene una superficie neutral mientras verifica una sesión existente', () => {
    const getSession = vi
      .fn<AuthApi['getSession']>()
      .mockImplementation(() => new Promise<AuthSession>(() => undefined));

    render(<App api={createApi({ getSession })} />);

    expect(screen.getByRole('status', { name: 'Verificando sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Iniciá sesión' })).not.toBeInTheDocument();
    expect(screen.getByAltText('Timbo')).toHaveAttribute(
      'src',
      '/marca/logotipo-timbo-blanco-transparente.png',
    );
  });

  it('muestra las aplicaciones autorizadas y navega por su ruta interna', async () => {
    const user = userEvent.setup();
    render(
      <App
        api={createApi(
          {},
          {},
          {
            listAuthorizedApplications: vi
              .fn<ApplicationsApi['listAuthorizedApplications']>()
              .mockResolvedValue([authorizedApplication]),
          },
        )}
      />,
    );

    const applicationLink = await screen.findByRole('link', { name: /Hello World/ });
    expect(applicationLink).toHaveAttribute('href', '/apps/hello-world');
    expect(screen.getByText('1 aplicación disponible')).toBeInTheDocument();

    await user.click(applicationLink);
    expect(
      await screen.findByRole('heading', { name: 'Un chiste, en dos idiomas.' }),
    ).toBeInTheDocument();
  });

  it('permite reintentar la carga del launcher', async () => {
    window.history.replaceState({}, '', '/');
    const listAuthorizedApplications = vi
      .fn<ApplicationsApi['listAuthorizedApplications']>()
      .mockRejectedValueOnce(new ApiHttpError(503))
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();
    render(<App api={createApi({}, {}, { listAuthorizedApplications })} />);

    expect(
      await screen.findByRole('heading', { name: 'No pudimos cargar tus aplicaciones' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByRole('heading', { name: 'Sin aplicaciones asignadas' }),
    ).toBeInTheDocument();
  });

  it('consume una vez el resultado OAuth, limpia la URL y permite recuperar el acceso', async () => {
    window.history.replaceState({}, '', '/?auth_error=USER_NOT_AUTHORIZED');
    const api = createApi();
    render(<App api={api} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('no está autorizada');
    expect(window.location.search).toBe('');
    expect(api.auth.getSession).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Escribinos por correo' })).toHaveAttribute(
      'href',
      'mailto:desarrollo4.ti@timbo.com.py',
    );
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/595994900313',
    );
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
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Apps' })).toBeInTheDocument();
  });

  it('no muestra éxito de logout si la revocación falla y permite reintentar', async () => {
    const logout = vi
      .fn<AuthApi['logout']>()
      .mockRejectedValueOnce(new ApiHttpError(500))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<App api={createApi({ logout })} />);

    await screen.findByRole('heading', { name: 'Apps' });
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar la sesión');
    expect(screen.getByRole('heading', { name: 'Apps' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar cierre de sesión' }));
    expect(await screen.findByRole('heading', { name: 'Iniciá sesión' })).toBeInTheDocument();
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

    expect(await screen.findByRole('heading', { name: 'Apps' })).toBeInTheDocument();
    resolveFirst?.({ ...session, displayName: 'Respuesta anterior' });
    await waitFor(() => expect(screen.getByText('Persona Timbo')).toBeInTheDocument());
  });

  it('no usa almacenamiento del navegador para la autenticación', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const api = createApi({ getSession: vi.fn().mockRejectedValue(new ApiHttpError(401)) });

    render(<App api={api} />);

    await screen.findByRole('heading', { name: 'Iniciá sesión' });
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

  it('navega entre Usuarios y Actividad sin volver a verificar la sesión', async () => {
    window.history.replaceState({}, '', '/');
    const api = createApi({
      getSession: vi.fn<AuthApi['getSession']>().mockResolvedValue(platformAdministratorSession),
    });
    const user = userEvent.setup();
    render(<App api={api} />);

    await screen.findByRole('heading', { name: 'Apps' });
    const administrationLink = screen.getByRole('link', { name: 'Administración de plataforma' });
    expect(administrationLink).toHaveAttribute('data-tooltip', 'Administración de plataforma');
    expect(administrationLink.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
    const logoutButton = screen.getByRole('button', { name: 'Cerrar sesión' });
    expect(logoutButton).toHaveAttribute('data-tooltip', 'Cerrar sesión');
    expect(logoutButton.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();

    await user.click(administrationLink);
    expect(await screen.findByRole('heading', { name: 'Usuarios' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Actividad' }));

    expect(await screen.findByRole('heading', { name: 'Actividad' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Verificando sesión' })).not.toBeInTheDocument();
    expect(api.auth.getSession).toHaveBeenCalledTimes(1);
    expect(api.administration.listActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        datePreset: 'month',
        limit: 25,
        offset: 0,
        asOf: expect.any(String),
      }),
    );
    expect(window.location.pathname).toBe('/admin/activity');
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

  it('edita el nombre visible mediante un formulario inline accesible', async () => {
    window.history.replaceState({}, '', '/admin');
    const user = userEvent.setup();
    const originalUser = {
      id: 'user-a',
      corporateEmail: 'persona@timbo.com',
      displayName: 'Persona Timbo',
      status: 'ACTIVE' as const,
      createdAt: '2026-08-24T12:00:00.000Z',
      deactivatedAt: null,
      isPlatformAdministrator: false,
    };
    const updateUser = vi
      .fn<AdministrationApi['updateUser']>()
      .mockResolvedValue({ ...originalUser, displayName: 'Nombre actualizado' });
    render(
      <App
        api={createApi(
          {},
          {
            listUsers: vi
              .fn<AdministrationApi['listUsers']>()
              .mockResolvedValueOnce([originalUser])
              .mockResolvedValueOnce([{ ...originalUser, displayName: 'Nombre actualizado' }]),
            updateUser,
          },
        )}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Editar nombre' }));
    const displayNameInput = screen.getByLabelText('Nombre visible');
    await user.clear(displayNameInput);
    await user.type(displayNameInput, 'Nombre actualizado');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith('user-a', { displayName: 'Nombre actualizado' }),
    );
    expect(await screen.findByText('Nombre actualizado')).toBeInTheDocument();
  });

  it('cierra la gestión de accesos si una búsqueda ya no contiene al usuario seleccionado', async () => {
    window.history.replaceState({}, '', '/admin');
    const user = userEvent.setup();
    const listUsers = vi
      .fn<AdministrationApi['listUsers']>()
      .mockResolvedValueOnce([
        {
          id: 'user-a',
          corporateEmail: 'persona@timbo.com',
          displayName: 'Persona Timbo',
          status: 'ACTIVE' as const,
          createdAt: '2026-08-24T12:00:00.000Z',
          deactivatedAt: null,
          isPlatformAdministrator: false,
        },
      ])
      .mockResolvedValueOnce([]);
    render(<App api={createApi({}, { listUsers })} />);

    await user.click(await screen.findByRole('button', { name: 'Gestionar accesos' }));
    expect(await screen.findByRole('heading', { name: 'Gestionar accesos' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar por correo corporativo'), 'otra@timbo.com');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Gestionar accesos' })).not.toBeInTheDocument(),
    );
  });

  it('asigna aplicaciones activas desde la gestión de accesos y bloquea la confirmación de retiro', async () => {
    window.history.replaceState({}, '', '/admin');
    const user = userEvent.setup();
    const application = {
      id: 'application-a',
      key: 'lista-precios',
      name: 'Lista de precios',
      description: null,
      launchPath: '/apps/lista-precios',
      status: 'ACTIVE' as const,
      displayOrder: 0,
      createdAt: '2026-08-24T12:00:00.000Z',
      updatedAt: '2026-08-24T12:00:00.000Z',
      deactivatedAt: null,
    };
    const assignApplicationToUser = vi
      .fn<AdministrationApi['assignApplicationToUser']>()
      .mockResolvedValue(undefined);
    render(
      <App
        api={createApi(
          {},
          {
            listUsers: vi.fn<AdministrationApi['listUsers']>().mockResolvedValue([
              {
                id: 'user-a',
                corporateEmail: 'persona@timbo.com',
                displayName: 'Persona Timbo',
                status: 'ACTIVE',
                createdAt: '2026-08-24T12:00:00.000Z',
                deactivatedAt: null,
                isPlatformAdministrator: false,
              },
            ]),
            listApplications: vi
              .fn<AdministrationApi['listApplications']>()
              .mockResolvedValue([application]),
            assignApplicationToUser,
          },
        )}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Gestionar accesos' }));
    expect(await screen.findByRole('heading', { name: 'Gestionar accesos' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Asignar aplicación' }));
    await waitFor(() =>
      expect(assignApplicationToUser).toHaveBeenCalledWith('user-a', 'application-a'),
    );
  });

  it('muestra un error recuperable al no poder cargar las asignaciones del usuario', async () => {
    window.history.replaceState({}, '', '/admin');
    const user = userEvent.setup();
    render(
      <App
        api={createApi(
          {},
          {
            listUsers: vi.fn<AdministrationApi['listUsers']>().mockResolvedValue([
              {
                id: 'user-a',
                corporateEmail: 'persona@timbo.com',
                displayName: 'Persona Timbo',
                status: 'ACTIVE',
                createdAt: '2026-08-24T12:00:00.000Z',
                deactivatedAt: null,
                isPlatformAdministrator: false,
              },
            ]),
            listApplications: vi
              .fn<AdministrationApi['listApplications']>()
              .mockRejectedValueOnce(new ApiHttpError(503))
              .mockRejectedValueOnce(new ApiHttpError(503))
              .mockResolvedValueOnce([]),
          },
        )}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Gestionar accesos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cargar las asignaciones',
    );
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByRole('heading', { name: 'No hay aplicaciones para asignar' }),
    ).toBeInTheDocument();
  });

  it('requiere una nueva confirmación al elegir otra aplicación para desasignar', async () => {
    window.history.replaceState({}, '', '/admin');
    const user = userEvent.setup();
    const createApplication = (id: string, name: string) => ({
      id,
      key: id,
      name,
      description: null,
      launchPath: `/apps/${id}`,
      status: 'ACTIVE' as const,
      displayOrder: 0,
      createdAt: '2026-08-24T12:00:00.000Z',
      updatedAt: '2026-08-24T12:00:00.000Z',
      deactivatedAt: null,
    });
    render(
      <App
        api={createApi(
          {},
          {
            listUsers: vi.fn<AdministrationApi['listUsers']>().mockResolvedValue([
              {
                id: 'user-a',
                corporateEmail: 'persona@timbo.com',
                displayName: 'Persona Timbo',
                status: 'ACTIVE',
                createdAt: '2026-08-24T12:00:00.000Z',
                deactivatedAt: null,
                isPlatformAdministrator: false,
              },
            ]),
            listApplications: vi
              .fn<AdministrationApi['listApplications']>()
              .mockResolvedValue([
                createApplication('application-a', 'Aplicación A'),
                createApplication('application-b', 'Aplicación B'),
              ]),
            listUserApplicationAccesses: vi
              .fn<AdministrationApi['listUserApplicationAccesses']>()
              .mockResolvedValue([
                {
                  applicationId: 'application-a',
                  assignedAt: '2026-08-24T12:00:00.000Z',
                  profileIds: [],
                },
                {
                  applicationId: 'application-b',
                  assignedAt: '2026-08-24T12:00:00.000Z',
                  profileIds: [],
                },
              ]),
          },
        )}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Gestionar accesos' }));
    await user.click((await screen.findAllByRole('button', { name: 'Desasignar aplicación' }))[0]!);
    await user.click(
      screen.getByRole('checkbox', { name: /Confirmo que deseo retirar la aplicación/ }),
    );
    expect(screen.getByRole('button', { name: 'Confirmar desasignación' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Desasignar aplicación' }));
    expect(screen.getByRole('button', { name: 'Confirmar desasignación' })).toBeDisabled();
  });

  it('recupera la carga de perfiles sin conservar un estado de carga tras el error', async () => {
    window.history.replaceState({}, '', '/admin/applications');
    const user = userEvent.setup();
    const application = {
      id: 'application-a',
      key: 'lista-precios',
      name: 'Lista de precios',
      description: null,
      launchPath: '/apps/lista-precios',
      status: 'ACTIVE' as const,
      displayOrder: 0,
      createdAt: '2026-08-24T12:00:00.000Z',
      updatedAt: '2026-08-24T12:00:00.000Z',
      deactivatedAt: null,
    };
    render(
      <App
        api={createApi(
          {},
          {
            listApplications: vi
              .fn<AdministrationApi['listApplications']>()
              .mockResolvedValue([application]),
            listApplicationProfiles: vi
              .fn<AdministrationApi['listApplicationProfiles']>()
              .mockRejectedValueOnce(new ApiHttpError(503))
              .mockResolvedValueOnce([]),
            listApplicationPermissions: vi
              .fn<AdministrationApi['listApplicationPermissions']>()
              .mockResolvedValue([]),
          },
        )}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Gestionar perfiles' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los perfiles');
    expect(screen.queryByText('Cargando perfiles y permisos…')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByRole('heading', { name: 'No hay perfiles funcionales' }),
    ).toBeInTheDocument();
  });

  it('muestra permisos inactivos sin ofrecer su asociación a un perfil', async () => {
    window.history.replaceState({}, '', '/admin/applications');
    const user = userEvent.setup();
    const application = {
      id: 'application-a',
      key: 'lista-precios',
      name: 'Lista de precios',
      description: null,
      launchPath: '/apps/lista-precios',
      status: 'ACTIVE' as const,
      displayOrder: 0,
      createdAt: '2026-08-24T12:00:00.000Z',
      updatedAt: '2026-08-24T12:00:00.000Z',
      deactivatedAt: null,
    };
    render(
      <App
        api={createApi(
          {},
          {
            listApplications: vi
              .fn<AdministrationApi['listApplications']>()
              .mockResolvedValue([application]),
            listApplicationProfiles: vi
              .fn<AdministrationApi['listApplicationProfiles']>()
              .mockResolvedValue([
                {
                  id: 'profile-a',
                  key: 'consulta',
                  name: 'Consulta',
                  description: null,
                  status: 'INACTIVE',
                  permissionIds: ['permission-a'],
                },
              ]),
            listApplicationPermissions: vi
              .fn<AdministrationApi['listApplicationPermissions']>()
              .mockResolvedValue([
                {
                  id: 'permission-a',
                  key: 'prices.read',
                  name: 'Consultar precios',
                  description: null,
                  status: 'INACTIVE',
                },
              ]),
          },
        )}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Gestionar perfiles' }));
    expect(await screen.findByText('Permiso inactivo')).toBeInTheDocument();
    expect(screen.getByText('Reactivá el perfil para desasociarlo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desasociar' })).not.toBeInTheDocument();
  });

  it('muestra el catálogo administrativo y abre la ruta interna registrada', async () => {
    window.history.replaceState({}, '', '/admin/applications');
    const application = {
      id: 'application-a',
      key: 'hello-world',
      name: 'Hello World',
      description: 'Primera aplicación de Plataforma Timbo.',
      launchPath: '/apps/hello-world',
      status: 'ACTIVE' as const,
      displayOrder: 0,
      createdAt: '2026-08-24T12:00:00.000Z',
      updatedAt: '2026-08-24T12:00:00.000Z',
      deactivatedAt: null,
    };
    render(
      <App
        api={createApi(
          {},
          {
            listApplications: vi
              .fn<AdministrationApi['listApplications']>()
              .mockResolvedValue([application]),
          },
        )}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Aplicaciones' })).toBeInTheDocument();
    expect(await screen.findByText('Hello World')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aplicaciones' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute(
      'href',
      '/apps/hello-world',
    );
  });

  it('muestra el chiste en inglés y su traducción dentro de la sesión compartida', async () => {
    window.history.replaceState({}, '', '/apps/hello-world');
    const user = userEvent.setup();
    render(
      <App
        api={createApi(
          {},
          {},
          {
            listAuthorizedApplications: vi
              .fn<ApplicationsApi['listAuthorizedApplications']>()
              .mockResolvedValue([authorizedApplication, secondAuthorizedApplication]),
          },
        )}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Un chiste, en dos idiomas.' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Aplicación actual: Hello World')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Inicio' })).not.toBeInTheDocument();
    expect(screen.queryByText('Herramienta de demostración')).not.toBeInTheDocument();
    expect(screen.getByText('Hola,')).toBeInTheDocument();
    const applicationSwitcher = screen.getByLabelText('Cambiar aplicación');
    expect(applicationSwitcher.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
    await user.click(applicationSwitcher);
    expect(screen.getByRole('link', { name: 'Lista de Precios' })).toHaveAttribute(
      'href',
      '/apps/price-list',
    );
    const logoutButton = screen.getByRole('button', { name: 'Cerrar sesión' });
    expect(logoutButton).toHaveAttribute('data-tooltip', 'Cerrar sesión');
    expect(logoutButton.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Contar un chiste' }));
    expect(await screen.findByText('A short joke.')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('Un chiste corto.')).toHaveAttribute('lang', 'es');
    expect(screen.getByRole('button', { name: 'Contar otro' })).toBeInTheDocument();
  });

  it('permite reintentar cuando un proveedor de Hello World no está disponible', async () => {
    window.history.replaceState({}, '', '/apps/hello-world');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const requestHelloWorldJoke = vi
      .fn<ApplicationsApi['requestHelloWorldJoke']>()
      .mockRejectedValueOnce(new ApiHttpError(502, 'request-hello-world-502'))
      .mockResolvedValueOnce({
        id: 'joke-b',
        originalText: 'Recovered joke.',
      });
    const user = userEvent.setup();
    render(
      <App
        api={createApi(
          {},
          {},
          {
            listAuthorizedApplications: vi.fn().mockResolvedValue([authorizedApplication]),
            requestHelloWorldJoke,
          },
        )}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Contar un chiste' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos obtener y traducir el chiste',
    );
    await user.click(screen.getByRole('button', { name: 'Contar un chiste' }));
    expect(await screen.findByText('Chiste recuperado.')).toBeInTheDocument();
    expect(requestHelloWorldJoke).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'web.browser.operation_failed',
        operation: 'hello-world.request-joke',
        route: '/api/applications/hello-world/joke',
        status: 502,
        requestId: 'request-hello-world-502',
      }),
    );
    consoleError.mockRestore();
  });

  it('bloquea en la interfaz una ruta interna que no está asignada', async () => {
    window.history.replaceState({}, '', '/apps/hello-world');
    render(<App api={createApi()} />);

    expect(
      await screen.findByRole('heading', { name: 'Aplicación no disponible' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Contar un chiste' })).not.toBeInTheDocument();
  });

  it('navega a una sub-ruta deep-linkable de una aplicación con rutas internas', async () => {
    window.history.replaceState({}, '', '/apps/lista-precios/marca/Scania');
    const user = userEvent.setup();
    render(
      <App
        api={createApi(
          {},
          {},
          {
            listAuthorizedApplications: vi
              .fn<ApplicationsApi['listAuthorizedApplications']>()
              .mockResolvedValue([listaPreciosApplication]),
          },
        )}
      />,
    );

    const backButton = await screen.findByRole('button', { name: 'Volver a Inicio' });
    expect(backButton).toHaveAttribute('data-tooltip', 'Volver a Inicio');
    expect(screen.getByText('Scania')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Aplicación no disponible' }),
    ).not.toBeInTheDocument();

    await user.click(backButton);
    expect(window.location.pathname).toBe('/apps/lista-precios');
  });

  it('no confunde un pathname parecido con el launchPath de otra aplicación', async () => {
    window.history.replaceState({}, '', '/apps/hello-worldish');
    render(
      <App
        api={createApi(
          {},
          {},
          {
            listAuthorizedApplications: vi
              .fn<ApplicationsApi['listAuthorizedApplications']>()
              .mockResolvedValue([authorizedApplication]),
          },
        )}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Aplicación no disponible' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Contar un chiste' })).not.toBeInTheDocument();
  });
});
