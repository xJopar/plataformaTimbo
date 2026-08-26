import type { Api, AuthSession } from '../api';
import { ApplicationRouteState } from './application-route-state';
import { findApplicationComponent } from './application-registry';
import { useAuthorizedApplications } from './use-authorized-applications';

interface AuthorizedApplicationRouteProps {
  api: Api;
  pathname: string;
  session: AuthSession;
  isLoggingOut: boolean;
  logoutFailure: Error | undefined;
  onNavigate: (pathname: string) => void;
  onLogout: () => void;
}

export function AuthorizedApplicationRoute({
  api,
  pathname,
  session,
  isLoggingOut,
  logoutFailure,
  onNavigate,
  onLogout,
}: AuthorizedApplicationRouteProps): React.JSX.Element {
  const { state, reload } = useAuthorizedApplications(api);

  if (state.status === 'loading') {
    return (
      <ApplicationRouteState
        session={session}
        title="Verificando acceso"
        detail="Estamos comprobando si esta aplicación está asignada a tu cuenta."
        isLoggingOut={isLoggingOut}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
    );
  }

  if (state.status === 'error') {
    return (
      <ApplicationRouteState
        session={session}
        title="No pudimos verificar tu acceso"
        detail="La información de esta aplicación no está disponible en este momento."
        isLoggingOut={isLoggingOut}
        onNavigate={onNavigate}
        onLogout={onLogout}
      >
        <button className="action-button" type="button" onClick={() => void reload()}>
          Reintentar
        </button>
      </ApplicationRouteState>
    );
  }

  const application = state.applications.find((item) => item.launchPath === pathname);
  if (application === undefined) {
    return (
      <ApplicationRouteState
        session={session}
        title="Aplicación no disponible"
        detail="Esta aplicación no está activa o no fue asignada a tu cuenta."
        isLoggingOut={isLoggingOut}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
    );
  }

  const ApplicationComponent = findApplicationComponent(pathname);
  if (ApplicationComponent === undefined) {
    return (
      <ApplicationRouteState
        session={session}
        title="Aplicación pendiente de integración"
        detail="Tu acceso está vigente, pero esta ruta todavía no tiene una interfaz disponible."
        isLoggingOut={isLoggingOut}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
    );
  }

  return (
    <ApplicationComponent
      api={api}
      application={application}
      availableApplications={state.applications}
      session={session}
      isLoggingOut={isLoggingOut}
      logoutFailure={logoutFailure}
      onNavigate={onNavigate}
      onLogout={onLogout}
    />
  );
}
