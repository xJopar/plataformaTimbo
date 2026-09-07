import { useEffect, useRef, useState } from 'react';
import type { Api, AuthSession } from '../api';
import { useAuthorizedApplications } from '../applications/use-authorized-applications';
import { PlatformHeader } from '../layout/platform-header';
import { PlatformSessionBar } from '../layout/platform-session-bar';

const COMPANY_VALUES = [
  {
    title: 'Pasión por el cliente',
    description: 'Cada solución empieza por las personas que la usan.',
  },
  {
    title: 'Proactividad que lidera',
    description: 'Actuamos con iniciativa y damos el ejemplo todos los días.',
  },
  {
    title: 'Evolución continua',
    description: 'Aprendemos, mejoramos y avanzamos juntos.',
  },
  {
    title: 'Cuidamos lo que importa',
    description: 'Las personas y el medio ambiente guían cada decisión.',
  },
] as const;

const COMPANY_VALUE_ROTATION_INTERVAL_MS = 6_400;
const COMPANY_VALUE_TRANSITION_DURATION_MS = 480;

interface HomeLauncherProps {
  api: Api;
  session: AuthSession;
  isLoggingOut: boolean;
  logoutFailure: Error | undefined;
  onNavigate: (pathname: string) => void;
  onLogout: () => void;
  onSessionExpired: () => void;
}

type CompanyValue = (typeof COMPANY_VALUES)[number];

function CompanyValueMessage({ value }: { value: CompanyValue }): React.JSX.Element {
  const [visibleValue, setVisibleValue] = useState(value);
  const [outgoingValue, setOutgoingValue] = useState<CompanyValue | undefined>(undefined);
  const visibleValueRef = useRef(value);

  useEffect(() => {
    const previousValue = visibleValueRef.current;
    if (value === previousValue) {
      return;
    }

    setOutgoingValue(previousValue);
    setVisibleValue(value);
    visibleValueRef.current = value;

    const transitionTimeout = window.setTimeout(() => {
      setOutgoingValue(undefined);
    }, COMPANY_VALUE_TRANSITION_DURATION_MS);

    return () => {
      window.clearTimeout(transitionTimeout);
    };
  }, [value]);

  return (
    <div className="company-value">
      <p className="company-value-loop" aria-hidden="true">
        {outgoingValue === undefined ? null : (
          <span className="company-value-loop-item company-value-loop-item--outgoing">
            {outgoingValue.title}
          </span>
        )}
        <span className="company-value-loop-item" key={visibleValue.title}>
          {visibleValue.title}
        </span>
      </p>
      <p className="company-value-detail">{visibleValue.description}</p>
      <p
        aria-label={`${visibleValue.title}. ${visibleValue.description}`}
        aria-live="polite"
        className="visually-hidden"
      >
        {visibleValue.title}. {visibleValue.description}
      </p>
    </div>
  );
}

export function HomeLauncher({
  api,
  session,
  isLoggingOut,
  logoutFailure,
  onNavigate,
  onLogout,
  onSessionExpired,
}: HomeLauncherProps): React.JSX.Element {
  const { state, reload } = useAuthorizedApplications(api, onSessionExpired);
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
      <PlatformSessionBar session={session} />
      <section
        className="dispatch-board"
        aria-labelledby="home-title"
        data-layout="application-launcher-grid"
      >
        <div className="launcher-heading">
          <div>
            <h1 className="visually-hidden" id="home-title">
              Plataforma Timbo
            </h1>
            <p className="company-value-kicker">Valores que nos mueven</p>
            <CompanyValueMessage value={COMPANY_VALUES[companyValueIndex] ?? COMPANY_VALUES[0]} />
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
