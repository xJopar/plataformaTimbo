import type { ReactNode } from 'react';
import type { AuthSession } from '../api';

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
      <header className="top-bar">
        <p className="product-name">Plataforma Timbo</p>
        <a
          className="top-navigation-link"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('/');
          }}
        >
          Inicio
        </a>
        <button className="logout-button" type="button" disabled={isLoggingOut} onClick={onLogout}>
          {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </header>
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
