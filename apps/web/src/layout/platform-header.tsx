import { AccountSetting01Icon, GridViewIcon, Logout01Icon } from '@hugeicons/core-free-icons';
import { AppIcon } from '../ui/app-icon';

interface PlatformHeaderProps {
  isLoggingOut: boolean;
  isPlatformAdministrator: boolean;
  showAdministrationLink: boolean;
  variant?: 'home' | 'application';
  applicationName?: string;
  onNavigate: (pathname: string) => void;
  onLogout: () => void;
}

export function PlatformHeader({
  isLoggingOut,
  isPlatformAdministrator,
  showAdministrationLink,
  variant,
  applicationName,
  onNavigate,
  onLogout,
}: PlatformHeaderProps): React.JSX.Element {
  const useCompactActions = variant === 'home' || variant === 'application';
  const isApplicationHeader = variant === 'application';

  return (
    <header
      className={`top-bar${variant === 'home' ? ' top-bar--home' : ''}${
        isApplicationHeader ? ' top-bar--application' : ''
      }`}
    >
      {variant === 'home' || isApplicationHeader ? (
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
        </a>
      ) : (
        <p className="product-name">Plataforma Timbo</p>
      )}
      {isApplicationHeader ? (
        <p className="application-current" aria-label={`Aplicación actual: ${applicationName}`}>
          {applicationName}
        </p>
      ) : null}
      <nav className="top-bar-actions" aria-label="Acciones de sesión">
        {isApplicationHeader ? (
          <a
            className="application-switcher"
            href="/"
            aria-label="Cambiar aplicación"
            onClick={(event) => {
              event.preventDefault();
              onNavigate('/');
            }}
          >
            <AppIcon icon={GridViewIcon} />
            <span>Aplicaciones</span>
          </a>
        ) : null}
        {isPlatformAdministrator && showAdministrationLink ? (
          <a
            className={useCompactActions ? 'header-icon-action' : 'top-navigation-link'}
            href="/admin"
            aria-label={useCompactActions ? 'Administración de plataforma' : undefined}
            data-tooltip={useCompactActions ? 'Administración de plataforma' : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate('/admin');
            }}
          >
            {useCompactActions ? <AppIcon icon={AccountSetting01Icon} /> : 'Administración'}
          </a>
        ) : null}
        <button
          className={useCompactActions ? 'header-icon-action' : 'logout-button'}
          type="button"
          aria-label={isLoggingOut ? 'Cerrando sesión' : 'Cerrar sesión'}
          data-tooltip={
            useCompactActions ? (isLoggingOut ? 'Cerrando sesión' : 'Cerrar sesión') : undefined
          }
          disabled={isLoggingOut}
          onClick={onLogout}
        >
          {useCompactActions ? (
            <AppIcon icon={Logout01Icon} />
          ) : isLoggingOut ? (
            'Cerrando sesión…'
          ) : (
            'Cerrar sesión'
          )}
        </button>
      </nav>
    </header>
  );
}
