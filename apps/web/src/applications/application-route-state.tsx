import type { ReactNode } from 'react';
import type { AuthSession } from '../api';
import { PlatformHeader } from '../layout/platform-header';

interface ApplicationRouteStateProps {
  session: AuthSession;
  title: string;
  detail: string;
  isLoggingOut: boolean;
  onNavigate: (pathname: string) => void;
  onLogout: () => void;
  children?: ReactNode;
}

export function ApplicationRouteState({
  session,
  title,
  detail,
  isLoggingOut,
  onNavigate,
  onLogout,
  children,
}: ApplicationRouteStateProps): React.JSX.Element {
  return (
    <main className="platform-shell">
      <PlatformHeader
        applicationName="Aplicación"
        isLoggingOut={isLoggingOut}
        isPlatformAdministrator={session.isPlatformAdministrator}
        showAdministrationLink={false}
        variant="application"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
      <section className="subheader" aria-label="Información de la aplicación">
        <p>Aplicación</p>
        <p>{session.displayName ?? session.corporateEmail}</p>
      </section>
      <section className="access-surface" aria-labelledby="application-route-state-title">
        <h1 id="application-route-state-title">{title}</h1>
        <p>{detail}</p>
        {children}
      </section>
    </main>
  );
}
