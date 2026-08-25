import type { Api, AuthSession } from '../api';
import { useAuthorizedApplications } from '../applications/use-authorized-applications';

interface HomeLauncherProps {
  api: Api;
  session: AuthSession;
  isLoggingOut: boolean;
  logoutFailure: Error | undefined;
  onNavigate: (pathname: string) => void;
  onLogout: () => void;
}

function formatCurrentDateTime(): string {
  return new Intl.DateTimeFormat('es-PY', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date());
}

export function HomeLauncher({
  api,
  session,
  isLoggingOut,
  logoutFailure,
  onNavigate,
  onLogout,
}: HomeLauncherProps): React.JSX.Element {
  const { state, reload } = useAuthorizedApplications(api);
  const employeeName = session.displayName ?? session.corporateEmail;

  return (
    <main className="platform-shell" data-visual-contract="launcher-aplicaciones-autorizadas">
      <header className="top-bar">
        <p className="product-name">Plataforma Timbo</p>
        <a
          className="top-navigation-link"
          href="/admin"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('/admin');
          }}
        >
          Administración
        </a>
        <button className="logout-button" type="button" disabled={isLoggingOut} onClick={onLogout}>
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
        data-layout="continuous-application-list"
      >
        <div className="launcher-heading">
          <div>
            <h1 id="home-title">Tus aplicaciones</h1>
            <p>Accedé a las herramientas asignadas a tu cuenta.</p>
          </div>
          {state.status === 'ready' && state.applications.length > 0 ? (
            <p className="launcher-count" aria-live="polite">
              {state.applications.length}{' '}
              {state.applications.length === 1
                ? 'aplicación disponible'
                : 'aplicaciones disponibles'}
            </p>
          ) : null}
        </div>
        {logoutFailure === undefined ? null : <p role="alert">{logoutFailure.message}</p>}
        {state.status === 'loading' ? (
          <div className="launcher-state" role="status">
            <h2>Cargando tus aplicaciones</h2>
            <p>Estamos consultando los accesos asignados a tu cuenta.</p>
          </div>
        ) : null}
        {state.status === 'error' ? (
          <div className="launcher-state">
            <h2>No pudimos cargar tus aplicaciones</h2>
            <p>La información no está disponible en este momento.</p>
            <button className="action-button" type="button" onClick={() => void reload()}>
              Reintentar
            </button>
          </div>
        ) : null}
        {state.status === 'ready' && state.applications.length === 0 ? (
          <div className="launcher-state">
            <h2>Sin aplicaciones asignadas</h2>
            <p>Cuando Administración te asigne una aplicación, aparecerá en este espacio.</p>
          </div>
        ) : null}
        {state.status === 'ready' && state.applications.length > 0 ? (
          <nav className="application-launcher" aria-label="Aplicaciones autorizadas">
            {state.applications.map((application) => (
              <a
                className="application-launcher-item"
                href={application.launchPath}
                key={application.key}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(application.launchPath);
                }}
              >
                <span className="application-launcher-copy">
                  <strong>{application.name}</strong>
                  <span>
                    {application.description ?? 'Aplicación interna de Plataforma Timbo.'}
                  </span>
                </span>
                <span className="application-launcher-action">Abrir aplicación</span>
              </a>
            ))}
          </nav>
        ) : null}
        {logoutFailure === undefined ? null : (
          <button className="text-button" type="button" onClick={onLogout}>
            Reintentar cierre de sesión
          </button>
        )}
      </section>
    </main>
  );
}
