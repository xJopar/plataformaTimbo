import type { ReactNode } from 'react';
import './access-shell.css';

interface AccessShellProps {
  title: string;
  detail: string;
  children?: ReactNode;
  isBusy?: boolean;
}

export function AccessShell({
  title,
  detail,
  children,
  isBusy = false,
}: AccessShellProps): React.JSX.Element {
  return (
    <main className="access-page" aria-busy={isBusy}>
      <section className="access-panel" aria-labelledby="access-title">
        <div className="access-content">
          <div className="access-product-name" aria-label="Plataforma Timbo">
            <img
              className="access-product-mark"
              src="/iconos/icono-plataforma-timbo-192.png"
              width="36"
              height="36"
              alt=""
            />
            <span>Plataforma Timbo</span>
          </div>

          <div className="access-copy">
            <h1 id="access-title">{title}</h1>
            <p>{detail}</p>
          </div>

          {isBusy ? (
            <div className="access-progress" role="status">
              <span className="access-progress-indicator" aria-hidden="true" />
              <span>Validando sesión segura</span>
            </div>
          ) : null}

          {children === undefined ? null : <div className="access-actions">{children}</div>}
        </div>
      </section>

      <aside className="access-brand" aria-hidden="true">
        <picture className="access-brand-picture">
          <source
            srcSet="/marca/fotografia-sede-timbo-640.webp 640w, /marca/fotografia-sede-timbo-960.webp 960w, /marca/fotografia-sede-timbo-1600.webp 1600w"
            sizes="(max-width: 860px) 100vw, 53vw"
            type="image/webp"
          />
          <img
            src="/marca/fotografia-sede-timbo-960.webp"
            width="960"
            height="719"
            alt=""
            fetchPriority="high"
          />
        </picture>
        <div className="access-brand-overlay" />
        <div className="access-brand-statement">
          <img
            className="access-wordmark"
            src="/marca/logotipo-timbo-blanco-transparente.webp"
            width="1400"
            height="354"
            alt=""
          />
        </div>
        <div className="access-brand-cut" />
      </aside>
    </main>
  );
}
