import { useEffect, useState } from 'react';
import { AuroraBackground } from '../home/aurora-background';
import { PlatformLoadingIndicator } from '../layout/platform-loading-indicator';

const LOADING_INDICATOR_DELAY_MS = 190;

interface PlatformStartupShellProps {
  pathname: string;
  error?: string;
  onRetry?: () => void;
}

function getStartupVariant(pathname: string): 'home' | 'administration' | 'application' {
  if (pathname.startsWith('/admin')) return 'administration';
  if (pathname.startsWith('/apps/')) return 'application';
  return 'home';
}

export function PlatformStartupShell({
  pathname,
  error,
  onRetry,
}: PlatformStartupShellProps): React.JSX.Element {
  const [isIndicatorVisible, setIsIndicatorVisible] = useState(false);
  const variant = getStartupVariant(pathname);

  useEffect(() => {
    if (error !== undefined) {
      setIsIndicatorVisible(false);
      return;
    }

    const timeoutId = window.setTimeout(
      () => setIsIndicatorVisible(true),
      LOADING_INDICATOR_DELAY_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  return (
    <main
      className={`platform-shell platform-startup-shell platform-startup-shell--${variant}`}
      aria-busy={error === undefined}
    >
      {variant === 'home' ? <AuroraBackground /> : null}
      <header
        className={`top-bar${variant === 'application' ? ' top-bar--application' : ' top-bar--home'}`}
      >
        <span className="top-bar-brand" aria-label="Plataforma Timbo">
          <img src="/marca/logotipo-timbo-blanco-transparente.png" alt="Timbo" />
        </span>
      </header>
      {variant === 'administration' ? (
        <div className="platform-startup-navigation" aria-hidden="true" />
      ) : null}
      <section className="platform-startup-content" aria-live="polite">
        {error !== undefined ? (
          <div className="platform-startup-message" role="alert">
            <h1>No pudimos preparar tu espacio</h1>
            <p>{error}</p>
            <button className="action-button" type="button" onClick={onRetry}>
              Reintentar
            </button>
          </div>
        ) : isIndicatorVisible ? (
          <div className="platform-startup-message" role="status">
            <PlatformLoadingIndicator label="Preparando tu espacio" />
          </div>
        ) : (
          <div className="platform-startup-geometry" aria-hidden="true" />
        )}
      </section>
    </main>
  );
}
