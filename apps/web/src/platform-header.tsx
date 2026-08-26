interface PlatformHeaderProps {
  isLoggingOut: boolean;
  isPlatformAdministrator: boolean;
  showAdministrationLink: boolean;
  variant?: 'home';
  onNavigate: (pathname: string) => void;
  onLogout: () => void;
}

export function PlatformHeader({
  isLoggingOut,
  isPlatformAdministrator,
  showAdministrationLink,
  variant,
  onNavigate,
  onLogout,
}: PlatformHeaderProps): React.JSX.Element {
  return (
    <header className={`top-bar${variant === 'home' ? ' top-bar--home' : ''}`}>
      {variant === 'home' ? (
        <a
          className="top-bar-brand"
          href="/"
          aria-label="Ir al inicio de Plataforma Timbo"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('/');
          }}
        >
          <img src="/brand/timbo-logo-white.png" alt="Timbo" />
          <span>Plataforma</span>
        </a>
      ) : (
        <p className="product-name">Plataforma Timbo</p>
      )}
      <nav className="top-bar-actions" aria-label="Acciones de sesión">
        {isPlatformAdministrator && showAdministrationLink ? (
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
        ) : null}
        <button className="logout-button" type="button" disabled={isLoggingOut} onClick={onLogout}>
          {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </nav>
    </header>
  );
}
