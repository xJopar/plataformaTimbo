interface PlatformHeaderProps {
  isLoggingOut: boolean;
  isPlatformAdministrator: boolean;
  showAdministrationLink: boolean;
  onNavigate: (pathname: string) => void;
  onLogout: () => void;
}

export function PlatformHeader({
  isLoggingOut,
  isPlatformAdministrator,
  showAdministrationLink,
  onNavigate,
  onLogout,
}: PlatformHeaderProps): React.JSX.Element {
  return (
    <header className="top-bar">
      <p className="product-name">Plataforma Timbo</p>
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
