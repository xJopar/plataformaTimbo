import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
const COMPANY_VALUE_EXIT_DURATION_MS = 460;
const COMPANY_VALUE_FRAME_DELAY_MS = 80;
const COMPANY_VALUE_FRAME_INLINE_PADDING_PX = 36;
const COMPANY_VALUE_FRAME_BLOCK_PADDING_PX = 18;

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

function getCompanyValue(index: number): CompanyValue {
  return (
    COMPANY_VALUES[(index + COMPANY_VALUES.length) % COMPANY_VALUES.length] ?? COMPANY_VALUES[0]
  );
}

function CompanyValueMessage({ valueIndex }: { valueIndex: number }): React.JSX.Element {
  const [visibleValueIndex, setVisibleValueIndex] = useState(valueIndex);
  const [outgoingValue, setOutgoingValue] = useState<CompanyValue | undefined>(undefined);
  const visibleValueIndexRef = useRef(valueIndex);
  const activeValueRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<HTMLSpanElement>(null);
  const previousFrameSizeRef = useRef<{ blockSize: number; inlineSize: number } | undefined>(
    undefined,
  );

  useEffect(() => {
    const previousValueIndex = visibleValueIndexRef.current;
    if (valueIndex === previousValueIndex) {
      return;
    }

    setOutgoingValue(getCompanyValue(previousValueIndex));
    setVisibleValueIndex(valueIndex);
    visibleValueIndexRef.current = valueIndex;

    const transitionTimeout = window.setTimeout(() => {
      setOutgoingValue(undefined);
    }, COMPANY_VALUE_EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(transitionTimeout);
    };
  }, [valueIndex]);

  useLayoutEffect(() => {
    const activeValueElement = activeValueRef.current;
    const frameElement = frameRef.current;
    if (!activeValueElement || !frameElement) {
      return;
    }

    const resizeFrame = () => {
      const valueBounds = activeValueElement.getBoundingClientRect();
      if (valueBounds.width === 0 || valueBounds.height === 0) {
        return;
      }

      const nextFrameSize = {
        inlineSize: valueBounds.width + COMPANY_VALUE_FRAME_INLINE_PADDING_PX,
        blockSize: valueBounds.height + COMPANY_VALUE_FRAME_BLOCK_PADDING_PX,
      };
      const previousFrameSize = previousFrameSizeRef.current;

      frameElement.style.inlineSize = `${nextFrameSize.inlineSize}px`;
      frameElement.style.blockSize = `${nextFrameSize.blockSize}px`;

      if (
        previousFrameSize !== undefined &&
        typeof frameElement.animate === 'function' &&
        !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ) {
        frameElement.getAnimations().forEach((animation) => animation.cancel());
        frameElement.animate(
          [
            {
              transform: `translate(-50%, -50%) scale(${previousFrameSize.inlineSize / nextFrameSize.inlineSize}, ${previousFrameSize.blockSize / nextFrameSize.blockSize})`,
            },
            { transform: 'translate(-50%, -50%) scale(1)' },
          ],
          {
            delay: COMPANY_VALUE_FRAME_DELAY_MS,
            duration: COMPANY_VALUE_TRANSITION_DURATION_MS,
            easing: 'cubic-bezier(0.34, 1.22, 0.64, 1)',
            fill: 'backwards',
          },
        );
      }

      previousFrameSizeRef.current = nextFrameSize;
    };

    resizeFrame();
    const resizeObserver =
      typeof ResizeObserver === 'function' ? new ResizeObserver(resizeFrame) : undefined;
    resizeObserver?.observe(activeValueElement);
    window.addEventListener('resize', resizeFrame);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resizeFrame);
    };
  }, [visibleValueIndex]);

  const activeValue = getCompanyValue(visibleValueIndex);

  return (
    <div className="company-value">
      <div className="company-value-stage" aria-hidden="true">
        {outgoingValue === undefined ? null : (
          <span className="company-value-copy company-value-copy--outgoing">
            {outgoingValue.title}
          </span>
        )}
        <span
          className={`company-value-copy${
            outgoingValue === undefined ? '' : ' company-value-copy--incoming'
          }`}
          key={activeValue.title}
          ref={activeValueRef}
        >
          {activeValue.title}
        </span>
        <span className="company-value-frame" ref={frameRef}>
          <span className="company-value-corner company-value-corner--top-left" />
          <span className="company-value-corner company-value-corner--top-right" />
          <span className="company-value-corner company-value-corner--bottom-left" />
          <span className="company-value-corner company-value-corner--bottom-right" />
        </span>
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
          <h1 className="visually-hidden" id="home-title">
            Plataforma Timbo
          </h1>
          <CompanyValueMessage valueIndex={companyValueIndex} />
        </div>
        {state.status === 'ready' && state.applications.length > 0 ? (
          <div className="launcher-meta-row">
            <p className="launcher-count" aria-live="polite">
              {state.applications.length}{' '}
              {state.applications.length === 1
                ? 'aplicación disponible'
                : 'aplicaciones disponibles'}
            </p>
          </div>
        ) : null}
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
