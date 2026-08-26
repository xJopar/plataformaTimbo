import { useEffect, useState } from 'react';
import type { Api, AuthSession } from '../api';
import { useAuthorizedApplications } from '../applications/use-authorized-applications';
import { PlatformHeader } from '../layout/platform-header';

const COMPANY_VALUES = [
  'La pasión por el cliente guía cada solución que ponemos en tus manos.',
  'Actuamos con proactividad y lideramos con el ejemplo, todos los días.',
  'Elegimos la evolución continua para aprender, mejorar y avanzar juntos.',
  'Cuidamos a las personas y al medio ambiente en cada decisión que tomamos.',
] as const;

const COMPANY_VALUE_ROTATION_INTERVAL_MS = 15_000;

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
  const [companyValueIndex, setCompanyValueIndex] = useState(0);

  useEffect(() => {
    const reducedMotionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let intervalId: number | undefined;

    const stopRotation = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const startRotation = () => {
      if (intervalId !== undefined || document.hidden || reducedMotionPreference?.matches) {
        return;
      }

      intervalId = window.setInterval(() => {
        setCompanyValueIndex((currentIndex) => (currentIndex + 1) % COMPANY_VALUES.length);
      }, COMPANY_VALUE_ROTATION_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopRotation();
        return;
      }

      startRotation();
    };

    const handleMotionPreferenceChange = () => {
      if (reducedMotionPreference?.matches) {
        stopRotation();
        return;
      }

      startRotation();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    reducedMotionPreference?.addEventListener('change', handleMotionPreferenceChange);
    startRotation();

    return () => {
      stopRotation();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      reducedMotionPreference?.removeEventListener('change', handleMotionPreferenceChange);
    };
  }, []);

  return (
    <main className="platform-shell" data-visual-contract="launcher-aplicaciones-autorizadas">
      <PlatformHeader
        isLoggingOut={isLoggingOut}
        isPlatformAdministrator={session.isPlatformAdministrator}
        showAdministrationLink
        variant="home"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
      <section className="subheader" aria-label="Información de sesión">
        <p>
          Usuario <strong>{employeeName}</strong>
        </p>
        <p>{formatCurrentDateTime()}</p>
      </section>
      <section
        className="dispatch-board"
        aria-labelledby="home-title"
        data-layout="application-launcher-grid"
      >
        <div className="launcher-heading">
          <div>
            <h1 id="home-title">Apps</h1>
            <p className="company-value" key={COMPANY_VALUES[companyValueIndex]}>
              {COMPANY_VALUES[companyValueIndex]}
            </p>
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
                <span className="application-launcher-action">Abrir</span>
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
