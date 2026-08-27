import {
  AccountSetting01Icon,
  ArrowLeft02Icon,
  GridViewIcon,
  Logout01Icon,
} from '@hugeicons/core-free-icons';
import type { AuthorizedApplication } from '../api';
import { AppIcon } from '../ui/app-icon';

interface PlatformHeaderProps {
  isLoggingOut: boolean;
  isPlatformAdministrator: boolean;
  showAdministrationLink: boolean;
  variant?: 'home' | 'application';
  applicationName?: string;
  applicationLaunchPath?: string;
  applications?: readonly AuthorizedApplication[];
  /**
   * Ubicación actual dentro de la app (ej. "Scania  R"), junto al nombre de la aplicación.
   * Sólo la usan apps con navegación interna propia (hoy, lista-precios).
   */
  breadcrumb?: string;
  backLabel?: string;
  onBack?: () => void;
  onNavigate: (pathname: string) => void;
  onLogout: () => void;
}

export function PlatformHeader({
  isLoggingOut,
  isPlatformAdministrator,
  showAdministrationLink,
  variant,
  applicationName,
  applicationLaunchPath,
  applications = [],
  breadcrumb,
  backLabel,
  onBack,
  onNavigate,
  onLogout,
}: PlatformHeaderProps): React.JSX.Element {
  const useCompactActions = variant === 'home' || variant === 'application';
  const isApplicationHeader = variant === 'application';
  const canSwitchApplications = isApplicationHeader && applications.length > 1;

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
          <img src="/marca/logotipo-timbo-blanco-transparente.png" alt="Timbo" />
        </a>
      ) : (
        <p className="product-name">Plataforma Timbo</p>
      )}
      {isApplicationHeader ? (
        <div className="application-context">
          {breadcrumb === undefined || onBack === undefined ? null : (
            <button
              className="header-icon-action application-breadcrumb-back"
              type="button"
              aria-label={backLabel === undefined ? 'Volver' : `Volver a ${backLabel}`}
              data-tooltip={backLabel === undefined ? 'Volver' : `Volver a ${backLabel}`}
              onClick={onBack}
            >
              <AppIcon icon={ArrowLeft02Icon} size={22} strokeWidth={2.5} />
              {backLabel === undefined ? null : (
                <span className="application-breadcrumb-back-label">{backLabel}</span>
              )}
            </button>
          )}
          <p className="application-current" aria-label={`Aplicación actual: ${applicationName}`}>
            {applicationName}
          </p>
          {breadcrumb === undefined ? null : <p className="application-breadcrumb">{breadcrumb}</p>}
        </div>
      ) : null}
      <nav className="top-bar-actions" aria-label="Acciones de sesión">
        {canSwitchApplications ? (
          <details className="application-switcher">
            <summary aria-label="Cambiar aplicación">
              <AppIcon icon={GridViewIcon} />
              <span>Aplicaciones</span>
            </summary>
            <nav className="application-switcher-menu" aria-label="Aplicaciones autorizadas">
              {applications.map((item) =>
                item.launchPath === applicationLaunchPath ? (
                  <span aria-current="page" className="application-switcher-current" key={item.key}>
                    {item.name}
                  </span>
                ) : (
                  <a
                    href={item.launchPath}
                    key={item.key}
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate(item.launchPath);
                    }}
                  >
                    {item.name}
                  </a>
                ),
              )}
            </nav>
          </details>
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
