import { useEffect, useRef, useState } from 'react';
import type { Api, AuthSession } from '../api';
import { useAuthorizedApplications } from '../applications/use-authorized-applications';
import { PlatformHeader } from '../layout/platform-header';
import { PlatformSessionBar } from '../layout/platform-session-bar';

const COMPANY_VALUES = [
  {
    title: 'Proactividad y liderar con el ejemplo',
  },
  {
    title: 'Pasión por el cliente',
  },
  {
    title: 'Respeto por las personas y el medio ambiente',
  },
  {
    title: 'Evolución continua',
  },
] as const;

const COMPANY_VALUE_ROTATION_INTERVAL_MS = 5_600;
const COMPANY_VALUE_TRANSITION_DURATION_MS = 560;

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

function CompanyValueMessage({ valueIndex }: { valueIndex: number }): React.JSX.Element {
  const [displayedValueIndex, setDisplayedValueIndex] = useState(valueIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const displayedValueIndexRef = useRef(valueIndex);

  useEffect(() => {
    const previousValueIndex = displayedValueIndexRef.current;
    if (valueIndex === previousValueIndex) {
      return;
    }

    setIsTransitioning(true);

    const transitionTimeout = window.setTimeout(() => {
      setDisplayedValueIndex(valueIndex);
      displayedValueIndexRef.current = valueIndex;
      setIsTransitioning(false);
    }, COMPANY_VALUE_TRANSITION_DURATION_MS);

    return () => {
      window.clearTimeout(transitionTimeout);
    };
  }, [valueIndex]);

  const getValue = (index: number): CompanyValue =>
    COMPANY_VALUES[(index + COMPANY_VALUES.length) % COMPANY_VALUES.length] ?? COMPANY_VALUES[0];
  const visibleValues = isTransitioning
    ? [
        getValue(displayedValueIndex - 1),
        getValue(displayedValueIndex),
        getValue(displayedValueIndex + 1),
        getValue(displayedValueIndex + 2),
      ]
    : [
        getValue(displayedValueIndex - 1),
        getValue(displayedValueIndex),
        getValue(displayedValueIndex + 1),
      ];
  const activeValuePosition = isTransitioning ? 2 : 1;
  const activeValue = getValue(valueIndex);

  return (
    <div className="company-value">
      <div className="company-value-loop" aria-hidden="true">
        <div
          className={`company-value-track${isTransitioning ? ' company-value-track--advancing' : ''}`}
        >
          {visibleValues.map((companyValue, index) => (
            <span
              className={`company-value-loop-item${
                index === activeValuePosition ? ' company-value-loop-item--active' : ''
              }${isTransitioning && index === 1 ? ' company-value-loop-item--outgoing' : ''}`}
              key={`${companyValue.title}-${index}`}
            >
              <span className="company-value-loop-label">{companyValue.title}</span>
            </span>
          ))}
        </div>
      </div>
      <p aria-label={activeValue.title} aria-live="polite" className="visually-hidden">
        {activeValue.title}
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
            <CompanyValueMessage valueIndex={companyValueIndex} />
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
