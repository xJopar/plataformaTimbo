import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActivityFilters,
  AdministrativeActivity,
  AdministrativeActivityFilterOptions,
  AdministrativeActivityItem,
  AdministrativeActivityStatistics,
  Api,
  AuthSession,
} from './api';
import { ApiHttpError } from './api';
import { ApplicationsPanel } from './administration/applications-panel';
import { PreauthorizeUsersPage } from './administration/preauthorize-users-page';
import { UserDetailsPage } from './administration/user-details-page';
import { UsersPanel } from './administration/users-panel';
import { humanizeEventName } from './administration/activity-event-labels';
import { AuthorizedApplicationRoute } from './applications/authorized-application-route';
import { HomeLauncher } from './home/home-launcher';
import { AccessShell } from './auth/access-shell';
import { SessionBootScreen } from './auth/session-boot-screen';
import { PlatformHeader } from './layout/platform-header';
import { AccessSupportLinks } from './auth/access-support-links';
import { GoogleGlyph } from './auth/google-glyph';
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

function withEnterTransition(content: React.ReactNode): React.JSX.Element {
  return <div className="app-content-enter">{content}</div>;
}

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
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const syncPathname = (): void => setPathname(window.location.pathname);
    window.addEventListener('popstate', syncPathname);
    return () => window.removeEventListener('popstate', syncPathname);
  }, []);

  const navigate = useCallback((nextPathname: string): void => {
    if (window.location.pathname === nextPathname) return;
    window.history.pushState(window.history.state, '', nextPathname);
    setPathname(nextPathname);
  }, []);

  const handleSessionExpired = useCallback((): void => {
    currentRequestId.current += 1;
    setAuthenticationState({ status: 'signed-out' });
  }, []);

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
    return <SessionBootScreen />;
  }

  if (authenticationState.status === 'signed-out' || authenticationState.status === 'rejected') {
    const rejectionMessage =
      authenticationState.status === 'rejected'
        ? oauthErrorMessages[authenticationState.code]
        : undefined;
    return withEnterTransition(
      <AccessShell
        title="Iniciá sesión"
        detail="Usá tu cuenta de Google del trabajo para continuar."
      >
        {rejectionMessage === undefined ? null : <p role="alert">{rejectionMessage}</p>}
        <button className="access-primary-action" type="button" onClick={beginGoogleLogin}>
          <span className="access-google-mark">
            <GoogleGlyph />
          </span>
          <span>Ingresar con Google</span>
        </button>
        {rejectionMessage === undefined ? null : <AccessSupportLinks />}
      </AccessShell>,
    );
  }

  if (authenticationState.status === 'technical-failure') {
    return withEnterTransition(
      <AccessShell
        title="No pudimos verificar tu acceso"
        detail="La sesión no pudo consultarse en este momento."
      >
        <p role="alert">{authenticationState.error.message}</p>
        <button className="access-primary-action" type="button" onClick={() => void loadSession()}>
          Reintentar
        </button>
        <AccessSupportLinks />
      </AccessShell>,
    );
  }

  const { session } = authenticationState;
  const isLoggingOut = authenticationState.status === 'logging-out';
  const logoutFailure =
    authenticationState.status === 'logout-failed' ? authenticationState.error : undefined;
  if (
    pathname === '/admin' ||
    pathname === '/admin/activity' ||
    pathname === '/admin/applications' ||
    pathname === '/admin/users/preauthorize' ||
    pathname.startsWith('/admin/users/')
  ) {
    if (api === undefined) {
      return withEnterTransition(
        <AccessShell
          title="No pudimos cargar Administración"
          detail="La API no está disponible."
        />,
      );
    }
    return withEnterTransition(
      <AdministrationPanel
        api={api}
        session={session}
        isLoggingOut={isLoggingOut}
        activeSection={
          pathname === '/admin/activity'
            ? 'activity'
            : pathname === '/admin/applications'
              ? 'applications'
              : 'users'
        }
        userPathname={pathname}
        onNavigate={navigate}
        onLogout={() => void logout(session)}
      />,
    );
  }

  if (pathname.startsWith('/apps/')) {
    if (api === undefined) {
      return withEnterTransition(
        <AccessShell title="No pudimos cargar la aplicación" detail="La API no está disponible." />,
      );
    }
    return withEnterTransition(
      <AuthorizedApplicationRoute
        api={api}
        pathname={pathname}
        session={session}
        isLoggingOut={isLoggingOut}
        logoutFailure={logoutFailure}
        onNavigate={navigate}
        onLogout={() => void logout(session)}
        onSessionExpired={handleSessionExpired}
      />,
    );
  }

  if (api === undefined) {
    return withEnterTransition(
      <AccessShell title="No pudimos cargar Inicio" detail="La API no está disponible." />,
    );
  }

  return withEnterTransition(
    <HomeLauncher
      api={api}
      session={session}
      isLoggingOut={isLoggingOut}
      logoutFailure={logoutFailure}
      onNavigate={navigate}
      onLogout={() => void logout(session)}
      onSessionExpired={handleSessionExpired}
    />,
  );
}

interface AdministrationPanelProps {
  api: Api;
  session: AuthSession;
  isLoggingOut: boolean;
  activeSection: 'users' | 'applications' | 'activity';
  userPathname: string;
  onNavigate: (pathname: string) => void;
  onLogout: () => void;
}

function AdministrationPanel({
  api,
  session,
  isLoggingOut,
  activeSection,
  userPathname,
  onNavigate,
  onLogout,
}: AdministrationPanelProps): React.JSX.Element {
  const userDetailsMatch = /^\/admin\/users\/([^/]+)$/.exec(userPathname);

  return (
    <main className="platform-shell administration-shell">
      <PlatformHeader
        isLoggingOut={isLoggingOut}
        isPlatformAdministrator={session.isPlatformAdministrator}
        showAdministrationLink={false}
        variant="home"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
      <div className="administration-layout">
        <nav className="administration-navigation" aria-label="Navegación de Administración">
          <a
            aria-current={activeSection === 'users' ? 'page' : undefined}
            href="/admin"
            onClick={(event) => {
              event.preventDefault();
              onNavigate('/admin');
            }}
          >
            Usuarios
          </a>
          <a
            aria-current={activeSection === 'applications' ? 'page' : undefined}
            href="/admin/applications"
            onClick={(event) => {
              event.preventDefault();
              onNavigate('/admin/applications');
            }}
          >
            Aplicaciones
          </a>
          <a
            aria-current={activeSection === 'activity' ? 'page' : undefined}
            href="/admin/activity"
            onClick={(event) => {
              event.preventDefault();
              onNavigate('/admin/activity');
            }}
          >
            Actividad
          </a>
        </nav>
        {activeSection === 'applications' ? <ApplicationsPanel api={api} /> : null}
        {activeSection === 'activity' ? <ActivityPanel api={api} /> : null}
        {activeSection !== 'users' ? null : userPathname === '/admin/users/preauthorize' ? (
          <PreauthorizeUsersPage api={api} onNavigate={onNavigate} />
        ) : userDetailsMatch === null ? (
          <UsersPanel api={api} onNavigate={onNavigate} />
        ) : (
          <UserDetailsPage
            api={api}
            actorUserId={session.id}
            userId={userDetailsMatch[1] ?? ''}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </main>
  );
}
type ActivityPanelState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'error' }
  | {
      status: 'ready';
      activity: AdministrativeActivity;
      statistics: AdministrativeActivityStatistics;
      options: AdministrativeActivityFilterOptions;
    };

function createDefaultActivityFilters(): ActivityFilters {
  return { datePreset: 'month', asOf: new Date().toISOString(), limit: 25, offset: 0 };
}

function ActivityPanel({ api }: { api: Api }): React.JSX.Element {
  const [filters, setFilters] = useState<ActivityFilters>(createDefaultActivityFilters);
  const [activityState, setActivityState] = useState<ActivityPanelState>({ status: 'loading' });
  const [isDownloading, setIsDownloading] = useState(false);

  const loadActivity = useCallback(
    async (nextFilters: ActivityFilters): Promise<void> => {
      setActivityState({ status: 'loading' });
      try {
        const [activity, statistics, options] = await Promise.all([
          api.administration.listActivity(nextFilters),
          api.administration.getActivityStatistics(nextFilters),
          api.administration.getActivityFilterOptions(nextFilters),
        ]);
        setActivityState({ status: 'ready', activity, statistics, options });
      } catch (error) {
        setActivityState(
          error instanceof ApiHttpError && error.status === 403
            ? { status: 'forbidden' }
            : { status: 'error' },
        );
      }
    },
    [api],
  );

  useEffect(() => {
    void loadActivity(filters);
  }, [loadActivity]);

  const applyFilters = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nextFilters = { ...filters, offset: 0 };
    setFilters(nextFilters);
    void loadActivity(nextFilters);
  };

  const setFilter = (name: keyof ActivityFilters, value: string): void => {
    setFilters((current) => ({ ...current, [name]: value || undefined }));
  };

  const selectPreset = (datePreset: NonNullable<ActivityFilters['datePreset']>): void => {
    const nextFilters = {
      ...filters,
      datePreset,
      dateFrom: undefined,
      dateTo: undefined,
      asOf: new Date().toISOString(),
      offset: 0,
    };
    setFilters(nextFilters);
    void loadActivity(nextFilters);
  };

  const clearFilters = (): void => {
    const nextFilters = createDefaultActivityFilters();
    setFilters(nextFilters);
    void loadActivity(nextFilters);
  };

  const downloadCsv = async (): Promise<void> => {
    setIsDownloading(true);
    try {
      const csv = await api.administration.downloadActivityCsv(filters);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(csv);
      link.download = 'actividad-timbo.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      setActivityState({ status: 'error' });
    } finally {
      setIsDownloading(false);
    }
  };

  const options = activityState.status === 'ready' ? activityState.options : emptyActivityOptions;
  return (
    <section className="administration-content activity-content" aria-labelledby="activity-title">
      <h1 id="activity-title">Actividad</h1>
      <p className="administration-description">
        Consultá los eventos normalizados de las aplicaciones conectadas a Plataforma Timbo.
      </p>
      {activityState.status === 'forbidden' ? (
        <ActivityState
          title="No tenés permiso para ver Actividad"
          detail="Solicitá a un administrador de plataforma que revise tu asignación."
        />
      ) : null}
      {activityState.status === 'error' ? (
        <ActivityState
          title="No pudimos cargar Actividad"
          detail="La información no está disponible en este momento."
          onRetry={() => void loadActivity(filters)}
        />
      ) : null}
      <form className="activity-filters" onSubmit={applyFilters}>
        <div className="activity-filter-heading">
          <h2>Filtros</h2>
          <div className="activity-presets" aria-label="Períodos rápidos">
            {(['today', 'week', 'month'] as const).map((preset) => (
              <button
                key={preset}
                className={
                  filters.datePreset === preset
                    ? 'preset-button preset-button--active'
                    : 'preset-button'
                }
                type="button"
                onClick={() => selectPreset(preset)}
              >
                {preset === 'today' ? 'Hoy' : preset === 'week' ? 'Esta semana' : 'Este mes'}
              </button>
            ))}
          </div>
        </div>
        <div className="activity-filter-grid">
          <ActivityInput
            label="Actor"
            name="actor"
            value={filters.actor}
            options={options.actors}
            onChange={setFilter}
          />
          <ActivityInput
            label="Aplicación"
            name="appKey"
            value={filters.appKey}
            options={options.apps}
            onChange={setFilter}
          />
          <ActivityInput
            label="Evento"
            name="eventName"
            value={filters.eventName}
            options={options.events}
            onChange={setFilter}
          />
          <ActivityInput
            label="Objetivo"
            name="target"
            value={filters.target}
            options={options.targets}
            onChange={setFilter}
          />
          <label>
            Fuente
            <select
              value={filters.source ?? ''}
              onChange={(event) => setFilter('source', event.target.value)}
            >
              <option value="">Todas</option>
              {options.sources?.map((source) => (
                <option key={source} value={source}>
                  {source === 'AUDIT' ? 'Auditoría' : 'Uso'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value || undefined,
                  datePreset: undefined,
                  asOf: undefined,
                }))
              }
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  dateTo: event.target.value || undefined,
                  datePreset: undefined,
                  asOf: undefined,
                }))
              }
            />
          </label>
        </div>
        <div className="activity-filter-actions">
          <button className="action-button" type="submit">
            Aplicar filtros
          </button>
          <button className="text-button" type="button" onClick={clearFilters}>
            Limpiar
          </button>
        </div>
      </form>
      {activityState.status === 'loading' ? <p aria-live="polite">Cargando actividadâ€¦</p> : null}
      {activityState.status === 'ready' ? (
        <ActivityResults
          activity={activityState.activity}
          statistics={activityState.statistics}
          isDownloading={isDownloading}
          onDownload={() => void downloadCsv()}
          onPageChange={(offset) => {
            const nextFilters = { ...filters, offset };
            setFilters(nextFilters);
            void loadActivity(nextFilters);
          }}
        />
      ) : null}
    </section>
  );
}

const emptyActivityOptions: AdministrativeActivityFilterOptions = {
  actors: [],
  sources: ['AUDIT', 'USAGE'],
  apps: [],
  events: [],
  targets: [],
};

function ActivityInput({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: keyof ActivityFilters;
  value: string | undefined;
  options: string[] | undefined;
  onChange: (name: keyof ActivityFilters, value: string) => void;
}): React.JSX.Element {
  const listId = `activity-${name}-options`;
  return (
    <label>
      {label}
      <input
        list={listId}
        value={value ?? ''}
        onChange={(event) => onChange(name, event.target.value)}
      />
      <datalist id={listId}>
        {options?.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  );
}

function ActivityState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
}): React.JSX.Element {
  return (
    <section className="state-surface">
      <h2>{title}</h2>
      <p>{detail}</p>
      {onRetry === undefined ? null : (
        <button className="action-button" type="button" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </section>
  );
}

function ActivityResults({
  activity,
  statistics,
  isDownloading,
  onDownload,
  onPageChange,
}: {
  activity: AdministrativeActivity;
  statistics: AdministrativeActivityStatistics;
  isDownloading: boolean;
  onDownload: () => void;
  onPageChange: (offset: number) => void;
}): React.JSX.Element {
  const totalPages = Math.max(1, Math.ceil(activity.total / activity.limit));
  const currentPage = Math.floor(activity.offset / activity.limit) + 1;
  return (
    <>
      <div className="activity-statistics" aria-label="Resumen de actividad">
        <ActivityMetric
          label="Eventos hoy"
          value={statistics.eventsToday.toLocaleString('es-PY')}
        />
        <ActivityMetric
          label="Personas activas hoy"
          value={statistics.activePeopleToday.toLocaleString('es-PY')}
        />
        <ActivityMetric
          label="Aplicación más frecuente"
          value={statistics.mostFrequentApp ?? 'â€”'}
        />
        <ActivityMetric
          label="Evento más frecuente"
          value={statistics.mostFrequentEvent ?? 'â€”'}
        />
      </div>
      <div className="activity-results-header">
        <div>
          <h2>Registro de actividad</h2>
          <p>{activity.total.toLocaleString('es-PY')} registros según el filtro aplicado.</p>
        </div>
        <button
          className="text-button"
          type="button"
          disabled={activity.total === 0 || isDownloading}
          onClick={onDownload}
        >
          {isDownloading ? 'Preparando CSVâ€¦' : 'Descargar CSV'}
        </button>
      </div>
      {activity.items.length === 0 ? (
        <ActivityState
          title="Sin registros"
          detail="Ajustá los filtros o esperá a que haya actividad."
        />
      ) : (
        <div className="users-table-wrapper activity-table-wrapper">
          <table>
            <caption>Eventos de actividad</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Actor</th>
                <th scope="col">Evento</th>
                <th scope="col">Aplicación</th>
                <th scope="col">Objetivo</th>
                <th scope="col">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {activity.items.map((item) => (
                <ActivityRow key={`${item.source}-${item.id}`} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {activity.total > activity.limit ? (
        <nav className="activity-pagination" aria-label="Paginación de actividad">
          <button
            className="text-button"
            type="button"
            disabled={activity.offset === 0}
            onClick={() => onPageChange(Math.max(0, activity.offset - activity.limit))}
          >
            Anterior
          </button>
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <button
            className="text-button"
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(activity.offset + activity.limit)}
          >
            Siguiente
          </button>
        </nav>
      ) : null}
    </>
  );
}

function ActivityMetric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <section>
      <p>{label}</p>
      <strong>{value}</strong>
    </section>
  );
}

function ActivityRow({ item }: { item: AdministrativeActivityItem }): React.JSX.Element {
  const metadata = Object.entries(item.metadata);
  const displayTarget =
    item.metadata.brand !== undefined && item.metadata.model !== undefined
      ? `${item.metadata.brand} / ${item.metadata.model}`
      : (item.target ?? 'â€”');
  return (
    <tr>
      <td>
        {new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'short' }).format(
          new Date(item.occurredAt),
        )}
      </td>
      <td>{item.actor}</td>
      <td>
        <span className="activity-badge">{item.source === 'AUDIT' ? 'Auditoría' : 'Uso'}</span>
        <div>{humanizeEventName(item.eventName)}</div>
        <div className="activity-event-key">{item.eventName}</div>
      </td>
      <td>{item.appKey}</td>
      <td>{displayTarget}</td>
      <td>
        {metadata.length === 0 ? (
          'â€”'
        ) : (
          <details>
            <summary>Ver detalle seguro</summary>
            {metadata.map(([key, value]) => (
              <div key={key}>
                {key}: {value}
              </div>
            ))}
          </details>
        )}
      </td>
    </tr>
  );
}
