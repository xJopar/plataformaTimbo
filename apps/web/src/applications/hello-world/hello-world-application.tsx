import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiHttpError, ApplicationsApiUnavailableError, type HelloWorldJoke } from '../../api';
import {
  reportBrowserOperationFailed,
  type BrowserOperationFailureContext,
} from '../../browser-diagnostics';
import type { ApplicationComponentProps } from '../application-component';
import { PlatformHeader } from '../../layout/platform-header';
import './hello-world-application.css';
import { MyMemoryTranslationError, translateEnglishToSpanish } from './mymemory-translation';

type JokeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; joke: HelloWorldJoke; translatedText: string }
  | { status: 'error' };

export function HelloWorldApplication({
  api,
  application,
  session,
  isLoggingOut,
  logoutFailure,
  onNavigate,
  onLogout,
}: ApplicationComponentProps): React.JSX.Element {
  const currentRequestSequence = useRef(0);
  const visitId = useRef(crypto.randomUUID());
  const [jokeState, setJokeState] = useState<JokeState>({ status: 'idle' });

  useEffect(
    () => () => {
      currentRequestSequence.current += 1;
    },
    [],
  );

  const loadJoke = useCallback(async (): Promise<void> => {
    const requestSequence = currentRequestSequence.current + 1;
    currentRequestSequence.current = requestSequence;
    setJokeState({ status: 'loading' });
    let failureContext: BrowserOperationFailureContext = {
      operation: 'hello-world.request-joke',
      method: 'POST',
      route: '/api/applications/hello-world/joke',
      provider: 'api',
    };

    try {
      const joke = await api.applications.requestHelloWorldJoke({
        eventId: crypto.randomUUID(),
        visitId: visitId.current,
      });
      failureContext = {
        operation: 'hello-world.translate-joke',
        method: 'GET',
        route: 'https://api.mymemory.translated.net/get',
        provider: 'mymemory',
        sensitiveValues: [joke.originalText],
      };
      const translatedText = await translateEnglishToSpanish(joke.originalText);
      if (requestSequence === currentRequestSequence.current) {
        setJokeState({ status: 'ready', joke, translatedText });
      }
    } catch (error: unknown) {
      reportBrowserOperationFailed(error, {
        ...failureContext,
        ...(error instanceof ApiHttpError
          ? {
              status: error.status,
              ...(error.requestId === undefined ? {} : { requestId: error.requestId }),
            }
          : error instanceof MyMemoryTranslationError && error.status !== undefined
            ? { status: error.status }
            : {}),
      });

      const isRecoverableProviderFailure =
        error instanceof ApiHttpError ||
        error instanceof ApplicationsApiUnavailableError ||
        error instanceof MyMemoryTranslationError;
      if (!isRecoverableProviderFailure) {
        throw error;
      }

      if (requestSequence === currentRequestSequence.current) {
        setJokeState({ status: 'error' });
      }
    }
  }, [api]);

  return (
    <main className="platform-shell hello-world-shell">
      <PlatformHeader
        applicationName={application.name}
        isLoggingOut={isLoggingOut}
        isPlatformAdministrator={session.isPlatformAdministrator}
        showAdministrationLink={false}
        variant="application"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
      <section className="subheader" aria-label="Información de la aplicación">
        <p>Herramienta de demostración</p>
        <p>{session.displayName ?? session.corporateEmail}</p>
      </section>
      <section className="application-stage" aria-labelledby="hello-world-title">
        <div className="hello-world-introduction">
          <h1 id="hello-world-title">Un chiste, en dos idiomas.</h1>
          <p>
            Pedí un chiste en inglés y recibí su traducción al español en el mismo espacio de
            trabajo.
          </p>
        </div>
        <section className="joke-tool" aria-labelledby="joke-tool-title">
          <div className="joke-tool-actions">
            <h2 id="joke-tool-title">Contá un chiste</h2>
            <p>La herramienta consulta una fuente pública y prepara la traducción para vos.</p>
            <button
              className="action-button"
              type="button"
              disabled={jokeState.status === 'loading'}
              onClick={() => void loadJoke()}
            >
              {jokeState.status === 'loading'
                ? 'Buscando chiste…'
                : jokeState.status === 'ready'
                  ? 'Contar otro'
                  : 'Contar un chiste'}
            </button>
          </div>
          {logoutFailure === undefined ? null : (
            <p className="joke-error" role="alert">
              No se pudo cerrar la sesión. Intentá nuevamente.
            </p>
          )}
          {jokeState.status === 'loading' ? (
            <p className="joke-status" role="status">
              Consultando el chiste y preparando la traducción…
            </p>
          ) : null}
          {jokeState.status === 'error' ? (
            <div className="joke-error" role="alert">
              <strong>No pudimos obtener y traducir el chiste.</strong>
              <span>Intentá nuevamente.</span>
            </div>
          ) : null}
          {jokeState.status === 'ready' ? (
            <section className="joke-result" aria-live="polite" aria-label="Chiste traducido">
              <div>
                <h2>English</h2>
                <p lang="en">{jokeState.joke.originalText}</p>
              </div>
              <div>
                <h2>Español</h2>
                <p lang="es">{jokeState.translatedText}</p>
              </div>
            </section>
          ) : null}
        </section>
      </section>
    </main>
  );
}
