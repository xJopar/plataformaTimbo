import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiHttpError, ApplicationsApiUnavailableError, type HelloWorldJoke } from '../../api';
import {
  reportBrowserOperationFailed,
  type BrowserOperationFailureContext,
} from '../../browser-diagnostics';
import type { ApplicationComponentProps } from '../application-component';
import './hello-world-application.css';
import { MyMemoryTranslationError, translateEnglishToSpanish } from './mymemory-translation';

type JokeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; joke: HelloWorldJoke; translatedText: string }
  | { status: 'error' };

export function HelloWorldApplication({
  api,
  session,
  isLoggingOut,
  logoutFailure,
  onNavigate,
  onLogout,
}: ApplicationComponentProps): React.JSX.Element {
  const currentRequestSequence = useRef(0);
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
      operation: 'hello-world.fetch-joke',
      method: 'GET',
      route: '/api/applications/hello-world/joke',
      provider: 'api',
    };

    try {
      const joke = await api.applications.getHelloWorldJoke();
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
      <header className="top-bar">
        <p className="product-name">Plataforma Timbo</p>
        <a
          className="top-navigation-link"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('/');
          }}
        >
          Inicio
        </a>
        <button className="logout-button" type="button" disabled={isLoggingOut} onClick={onLogout}>
          {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </header>
      <section className="subheader" aria-label="Información de la aplicación">
        <p>
          Aplicación <strong>Hello World</strong>
        </p>
        <p>{session.displayName ?? session.corporateEmail}</p>
      </section>
      <section className="application-stage" aria-labelledby="hello-world-title">
        <h1 id="hello-world-title">Hello World</h1>
        <p>
          Un ejemplo de aplicación interna: consume un chiste en inglés y muestra su traducción al
          español.
        </p>
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
        {logoutFailure === undefined ? null : (
          <p role="alert">No se pudo cerrar la sesión. Intentá nuevamente.</p>
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
    </main>
  );
}
