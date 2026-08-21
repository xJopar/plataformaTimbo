import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { AdministrativeUser, Api, AuthSession } from './api';
import { ApiHttpError } from './api';
import './app.css';

interface AppProps {
  api?: Api;
  configurationError?: Error;
}

type OAuthErrorCode =
  | 'GOOGLE_IDENTITY_INVALID'
  | 'GOOGLE_IDENTITY_MISMATCH'
  | 'LOGIN_ATTEMPT_INVALID'
  | 'LOGIN_RESPONSE_INVALID'
  | 'USER_INACTIVE'
  | 'USER_NOT_AUTHORIZED';

type AuthenticationState =
  | { status: 'checking' }
  | { status: 'signed-out' }
  | { status: 'rejected'; code: OAuthErrorCode }
  | { status: 'technical-failure'; error: Error }
  | { status: 'signed-in'; session: AuthSession }
  | { status: 'logging-out'; session: AuthSession }
  | { status: 'logout-failed'; session: AuthSession; error: Error };

const oauthErrorMessages: Record<OAuthErrorCode, string> = {
  GOOGLE_IDENTITY_INVALID: 'No fue posible validar la cuenta de Google. Volvé a intentarlo.',
  GOOGLE_IDENTITY_MISMATCH: 'La cuenta de Google no coincide con la cuenta autorizada.',
  LOGIN_ATTEMPT_INVALID: 'El intento de acceso venció o ya fue utilizado. Iniciá nuevamente.',
  LOGIN_RESPONSE_INVALID: 'El acceso con Google fue cancelado o no pudo completarse.',
  USER_INACTIVE: 'Tu acceso a Plataforma Timbo se encuentra inactivo.',
  USER_NOT_AUTHORIZED: 'Tu cuenta no está autorizada para ingresar a Plataforma Timbo.',
};

function readOAuthErrorFromUrl(): OAuthErrorCode | undefined {
  const rawCode = new URLSearchParams(window.location.search).get('auth_error');
  if (rawCode === null) {
    return undefined;
  }

  const acceptedCode = Object.hasOwn(oauthErrorMessages, rawCode) ? rawCode : undefined;
  const cleanUrl = `${window.location.pathname}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', cleanUrl);
  return acceptedCode as OAuthErrorCode | undefined;
}

function formatCurrentDateTime(): string {
  return new Intl.DateTimeFormat('es-PY', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date());
}

export function App({ api, configurationError }: AppProps): React.JSX.Element {
  const currentRequestId = useRef(0);
  const oauthOutcomeRead = useRef(false);
  const oauthOutcome = useRef<OAuthErrorCode | undefined>(undefined);
  const [authenticationState, setAuthenticationState] = useState<AuthenticationState>(() => {
    if (configurationError !== undefined) {
      return { status: 'technical-failure', error: configurationError };
    }
    return { status: 'checking' };
  });

  const loadSession = useCallback(async (): Promise<void> => {
    const requestId = currentRequestId.current + 1;
    currentRequestId.current = requestId;

    if (api === undefined) {
      setAuthenticationState({
        status: 'technical-failure',
        error: configurationError ?? new Error('No se pudo configurar la conexión con la API.'),
      });
      return;
    }

    setAuthenticationState({ status: 'checking' });
    try {
      const session = await api.auth.getSession();
      if (requestId === currentRequestId.current) {
        setAuthenticationState({ status: 'signed-in', session });
      }
    } catch (error) {
      if (requestId !== currentRequestId.current) {
        return;
      }
      if (error instanceof ApiHttpError && error.status === 401) {
        setAuthenticationState({ status: 'signed-out' });
        return;
      }
      setAuthenticationState({
        status: 'technical-failure',
        error: new Error('No se pudo verificar tu sesión. Intentá nuevamente.'),
      });
    }
  }, [api, configurationError]);

  useEffect(() => {
    if (!oauthOutcomeRead.current) {
      oauthOutcomeRead.current = true;
      const oauthErrorCode = readOAuthErrorFromUrl();
      if (oauthErrorCode !== undefined) {
        oauthOutcome.current = oauthErrorCode;
        setAuthenticationState({ status: 'rejected', code: oauthErrorCode });
        return;
      }
    }
    if (oauthOutcome.current !== undefined) {
      setAuthenticationState({ status: 'rejected', code: oauthOutcome.current });
      return;
    }
    void loadSession();

    return () => {
      currentRequestId.current += 1;
    };
  }, [loadSession]);

  const beginGoogleLogin = useCallback((): void => {
    if (api === undefined) {
      setAuthenticationState({
        status: 'technical-failure',
        error: configurationError ?? new Error('No se pudo iniciar el acceso corporativo.'),
      });
      return;
    }
    window.location.assign(api.auth.getGoogleLoginUrl());
  }, [api, configurationError]);

  const logout = useCallback(
    async (session: AuthSession): Promise<void> => {
      if (api === undefined) {
        setAuthenticationState({
          status: 'logout-failed',
          session,
          error: configurationError ?? new Error('No se pudo cerrar la sesión.'),
        });
        return;
      }

      const requestId = currentRequestId.current + 1;
      currentRequestId.current = requestId;
      setAuthenticationState({ status: 'logging-out', session });
      try {
        await api.auth.logout();
        if (requestId === currentRequestId.current) {
          setAuthenticationState({ status: 'signed-out' });
        }
      } catch (error) {
        if (requestId === currentRequestId.current) {
          setAuthenticationState({
            status: 'logout-failed',
            session,
            error: new Error('No se pudo cerrar la sesión. Intentá nuevamente.'),
          });
        }
      }
    },
    [api, configurationError],
  );

  if (authenticationState.status === 'checking') {
    return <AccessShell title="Verificando sesión" detail="Comprobando tu acceso corporativo." />;
  }

  if (authenticationState.status === 'signed-out' || authenticationState.status === 'rejected') {
    const rejectionMessage =
      authenticationState.status === 'rejected'
        ? oauthErrorMessages[authenticationState.code]
        : undefined;
    return (
      <AccessShell
        title="Acceso corporativo"
        detail="Ingresá con tu cuenta corporativa autorizada."
      >
        {rejectionMessage === undefined ? null : <p role="alert">{rejectionMessage}</p>}
        <button className="action-button" type="button" onClick={beginGoogleLogin}>
          Ingresar con Google
        </button>
      </AccessShell>
    );
  }

  if (authenticationState.status === 'technical-failure') {
    return (
      <AccessShell
        title="No pudimos verificar tu acceso"
        detail="La sesión no pudo consultarse en este momento."
      >
        <p role="alert">{authenticationState.error.message}</p>
        <button className="action-button" type="button" onClick={() => void loadSession()}>
          Reintentar
        </button>
      </AccessShell>
    );
  }

  const { session } = authenticationState;
  const isLoggingOut = authenticationState.status === 'logging-out';
  const logoutFailure =
    authenticationState.status === 'logout-failed' ? authenticationState.error : undefined;
  const employeeName = session.displayName ?? session.corporateEmail;

  if (window.location.pathname === '/admin') {
    if (api === undefined) {
      return (
        <AccessShell title="No pudimos cargar Administración" detail="La API no está disponible." />
      );
    }
    return (
      <AdministrationPanel api={api} session={session} onLogout={() => void logout(session)} />
    );
  }

  return (
    <main className="platform-shell" data-visual-contract="matriz-continua-tablero-despacho">
      <header className="top-bar">
        <p className="product-name">Plataforma Timbo</p>
        <a className="top-navigation-link" href="/admin">
          Administración
        </a>
        <button
          className="logout-button"
          type="button"
          disabled={isLoggingOut}
          onClick={() => void logout(session)}
        >
          {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </header>
      <section className="subheader" aria-label="Información de sesión">
        <p>
          Empleado <strong>{employeeName}</strong>
        </p>
        <p>{formatCurrentDateTime()}</p>
      </section>
      <section
        className="dispatch-board"
        aria-labelledby="home-title"
        data-layout="continuous-empty-surface"
      >
        <p className="eyebrow">Inicio</p>
        <h1 id="home-title">Tablero de despacho</h1>
        {logoutFailure === undefined ? null : <p role="alert">{logoutFailure.message}</p>}
        <div className="empty-surface">
          <h2>Sin aplicaciones asignadas</h2>
          <p>Cuando tengas una aplicación asignada, aparecerá en este tablero.</p>
          {logoutFailure === undefined ? null : (
            <button className="text-button" type="button" onClick={() => void logout(session)}>
              Reintentar cierre de sesión
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

type AdministrationState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'error' }
  | { status: 'ready'; users: AdministrativeUser[]; search: string };

interface AdministrationPanelProps {
  api: Api;
  session: AuthSession;
  onLogout: () => void;
}

function AdministrationPanel({
  api,
  session,
  onLogout,
}: AdministrationPanelProps): React.JSX.Element {
  const [administrationState, setAdministrationState] = useState<AdministrationState>({
    status: 'loading',
  });
  const [search, setSearch] = useState('');
  const [newCorporateEmail, setNewCorporateEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = useCallback(
    async (nextSearch = ''): Promise<void> => {
      setAdministrationState({ status: 'loading' });
      setActionError(undefined);
      try {
        const users = await api.administration.listUsers(nextSearch || undefined);
        setAdministrationState({ status: 'ready', users, search: nextSearch });
      } catch (error) {
        if (error instanceof ApiHttpError && error.status === 403) {
          setAdministrationState({ status: 'forbidden' });
          return;
        }
        setAdministrationState({ status: 'error' });
      }
    },
    [api],
  );

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void loadUsers(search);
  };

  const preauthorizeUser = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSaving(true);
    setActionError(undefined);
    try {
      await api.administration.preauthorizeUser({
        corporateEmail: newCorporateEmail,
        displayName: newDisplayName.trim() || undefined,
      });
      setNewCorporateEmail('');
      setNewDisplayName('');
      await loadUsers(search);
    } catch (error) {
      setActionError(
        error instanceof ApiHttpError && error.status === 403
          ? 'Tu sesión no tiene permiso para administrar usuarios.'
          : 'No pudimos preautorizar el usuario. Revisá los datos e intentá nuevamente.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const changeUserStatus = async (user: AdministrativeUser): Promise<void> => {
    setIsSaving(true);
    setActionError(undefined);
    try {
      if (user.status === 'ACTIVE') {
        await api.administration.deactivateUser(user.id);
      } else {
        await api.administration.reactivateUser(user.id);
      }
      await loadUsers(search);
    } catch {
      setActionError(
        user.isPlatformAdministrator
          ? 'El administrador de plataforma no puede desactivarse en este primer corte.'
          : 'No pudimos actualizar el estado del usuario. Intentá nuevamente.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const updateDisplayName = async (user: AdministrativeUser): Promise<void> => {
    const nextDisplayName = window.prompt('Nombre visible', user.displayName ?? '');
    if (nextDisplayName === null) {
      return;
    }
    setIsSaving(true);
    setActionError(undefined);
    try {
      await api.administration.updateUser(user.id, { displayName: nextDisplayName || null });
      await loadUsers(search);
    } catch {
      setActionError('No pudimos guardar el nombre visible. Intentá nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="platform-shell administration-shell">
      <header className="top-bar">
        <p className="product-name">Plataforma Timbo</p>
        <button className="logout-button" type="button" onClick={onLogout}>
          Cerrar sesión
        </button>
      </header>
      <div className="administration-layout">
        <nav className="administration-navigation" aria-label="Navegación de Administración">
          <a href="/">Inicio</a>
          <a aria-current="page" href="/admin">
            Usuarios
          </a>
        </nav>
        <section className="administration-content" aria-labelledby="administration-title">
          <p className="eyebrow">Administración</p>
          <h1 id="administration-title">Usuarios</h1>
          <p className="administration-description">
            Gestioná los accesos preautorizados de Plataforma Timbo. Sesión:{' '}
            {session.corporateEmail}
          </p>
          {administrationState.status === 'loading' ? (
            <p aria-live="polite">Cargando usuarios…</p>
          ) : null}
          {administrationState.status === 'forbidden' ? (
            <section className="state-surface" aria-labelledby="forbidden-title">
              <h2 id="forbidden-title">No tenés permiso para ver Usuarios</h2>
              <p>Solicitá a un administrador de plataforma que revise tu asignación.</p>
              <a className="text-link" href="/">
                Volver al inicio
              </a>
            </section>
          ) : null}
          {administrationState.status === 'error' ? (
            <section className="state-surface" aria-labelledby="administration-error-title">
              <h2 id="administration-error-title">No pudimos cargar Usuarios</h2>
              <p>La información no está disponible en este momento.</p>
              <button
                className="action-button"
                type="button"
                onClick={() => void loadUsers(search)}
              >
                Reintentar
              </button>
            </section>
          ) : null}
          {administrationState.status === 'ready' ? (
            <>
              <div className="administration-actions">
                <form className="search-form" onSubmit={submitSearch} role="search">
                  <label htmlFor="user-search">Buscar por correo corporativo</label>
                  <div>
                    <input
                      id="user-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <button className="action-button" type="submit" disabled={isSaving}>
                      Buscar
                    </button>
                  </div>
                </form>
                <form
                  className="preauthorize-form"
                  onSubmit={(event) => void preauthorizeUser(event)}
                >
                  <h2>Preautorizar usuario</h2>
                  <label htmlFor="new-corporate-email">Correo corporativo</label>
                  <input
                    id="new-corporate-email"
                    type="email"
                    required
                    value={newCorporateEmail}
                    onChange={(event) => setNewCorporateEmail(event.target.value)}
                  />
                  <label htmlFor="new-display-name">Nombre visible (opcional)</label>
                  <input
                    id="new-display-name"
                    value={newDisplayName}
                    onChange={(event) => setNewDisplayName(event.target.value)}
                  />
                  <button className="action-button" type="submit" disabled={isSaving}>
                    Preautorizar
                  </button>
                </form>
              </div>
              {actionError === undefined ? null : <p role="alert">{actionError}</p>}
              {administrationState.users.length === 0 ? (
                <section className="state-surface" aria-labelledby="empty-users-title">
                  <h2 id="empty-users-title">No encontramos usuarios</h2>
                  <p>
                    {administrationState.search.length === 0
                      ? 'Todavía no hay usuarios preautorizados.'
                      : 'Probá con otro correo corporativo.'}
                  </p>
                </section>
              ) : (
                <div className="users-table-wrapper">
                  <table>
                    <caption>Usuarios preautorizados</caption>
                    <thead>
                      <tr>
                        <th scope="col">Usuario</th>
                        <th scope="col">Correo</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {administrationState.users.map((user) => (
                        <tr key={user.id}>
                          <td>{user.displayName ?? 'Sin nombre visible'}</td>
                          <td>{user.corporateEmail}</td>
                          <td>{user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</td>
                          <td className="user-actions">
                            <button
                              className="text-button"
                              type="button"
                              disabled={isSaving}
                              onClick={() => void updateDisplayName(user)}
                            >
                              Editar nombre
                            </button>
                            {user.isPlatformAdministrator && user.status === 'ACTIVE' ? (
                              <span className="protected-user-state">Administrador protegido</span>
                            ) : (
                              <button
                                className="text-button"
                                type="button"
                                disabled={isSaving}
                                onClick={() => void changeUserStatus(user)}
                              >
                                {user.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

interface AccessShellProps {
  title: string;
  detail: string;
  children?: ReactNode;
}

function AccessShell({ title, detail, children }: AccessShellProps): React.JSX.Element {
  return (
    <main className="platform-shell" data-visual-contract="matriz-continua-tablero-despacho">
      <header className="top-bar">
        <p className="product-name">Plataforma Timbo</p>
      </header>
      <section className="subheader" aria-label="Estado de acceso">
        <p>Acceso corporativo</p>
      </section>
      <section className="access-surface" aria-labelledby="access-title">
        <p className="eyebrow">Plataforma Timbo</p>
        <h1 id="access-title">{title}</h1>
        <p>{detail}</p>
        {children}
      </section>
    </main>
  );
}
