import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { Api, AuthSession } from './api';
import { ApiHttpError } from './api';
import './app.css';

interface AppProps {
  api?: Api;
  configurationError?: Error;
}

type OAuthErrorCode =
  | 'GOOGLE_IDENTITY_INVALID'
  | 'GOOGLE_IDENTITY_MISMATCH'
  | 'LOGIN_ATTEMPT_INVALID'
  | 'LOGIN_RESPONSE_INVALID'
  | 'USER_INACTIVE'
  | 'USER_NOT_AUTHORIZED';

type AuthenticationState =
  | { status: 'checking' }
  | { status: 'signed-out' }
  | { status: 'rejected'; code: OAuthErrorCode }
  | { status: 'technical-failure'; error: Error }
  | { status: 'signed-in'; session: AuthSession }
  | { status: 'logging-out'; session: AuthSession }
  | { status: 'logout-failed'; session: AuthSession; error: Error };

const oauthErrorMessages: Record<OAuthErrorCode, string> = {
  GOOGLE_IDENTITY_INVALID: 'No fue posible validar la cuenta de Google. Volvé a intentarlo.',
  GOOGLE_IDENTITY_MISMATCH: 'La cuenta de Google no coincide con la cuenta autorizada.',
  LOGIN_ATTEMPT_INVALID: 'El intento de acceso venció o ya fue utilizado. Iniciá nuevamente.',
  LOGIN_RESPONSE_INVALID: 'El acceso con Google fue cancelado o no pudo completarse.',
  USER_INACTIVE: 'Tu acceso a Plataforma Timbo se encuentra inactivo.',
  USER_NOT_AUTHORIZED: 'Tu cuenta no está autorizada para ingresar a Plataforma Timbo.',
};

function readOAuthErrorFromUrl(): OAuthErrorCode | undefined {
  const rawCode = new URLSearchParams(window.location.search).get('auth_error');
  if (rawCode === null) {
    return undefined;
  }

  const acceptedCode = Object.hasOwn(oauthErrorMessages, rawCode) ? rawCode : undefined;
  const cleanUrl = `${window.location.pathname}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', cleanUrl);
  return acceptedCode as OAuthErrorCode | undefined;
}

function formatCurrentDateTime(): string {
  return new Intl.DateTimeFormat('es-PY', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date());
}

export function App({ api, configurationError }: AppProps): React.JSX.Element {
  const currentRequestId = useRef(0);
  const oauthOutcomeRead = useRef(false);
  const oauthOutcome = useRef<OAuthErrorCode | undefined>(undefined);
  const [authenticationState, setAuthenticationState] = useState<AuthenticationState>(() => {
    if (configurationError !== undefined) {
      return { status: 'technical-failure', error: configurationError };
    }
    return { status: 'checking' };
  });

  const loadSession = useCallback(async (): Promise<void> => {
    const requestId = currentRequestId.current + 1;
    currentRequestId.current = requestId;

    if (api === undefined) {
      setAuthenticationState({
        status: 'technical-failure',
        error: configurationError ?? new Error('No se pudo configurar la conexión con la API.'),
      });
      return;
    }

    setAuthenticationState({ status: 'checking' });
    try {
      const session = await api.auth.getSession();
      if (requestId === currentRequestId.current) {
        setAuthenticationState({ status: 'signed-in', session });
      }
    } catch (error) {
      if (requestId !== currentRequestId.current) {
        return;
      }
      if (error instanceof ApiHttpError && error.status === 401) {
        setAuthenticationState({ status: 'signed-out' });
        return;
      }
      setAuthenticationState({
        status: 'technical-failure',
        error: new Error('No se pudo verificar tu sesión. Intentá nuevamente.'),
      });
    }
  }, [api, configurationError]);

  useEffect(() => {
    if (!oauthOutcomeRead.current) {
      oauthOutcomeRead.current = true;
      const oauthErrorCode = readOAuthErrorFromUrl();
      if (oauthErrorCode !== undefined) {
        oauthOutcome.current = oauthErrorCode;
        setAuthenticationState({ status: 'rejected', code: oauthErrorCode });
        return;
      }
    }
    if (oauthOutcome.current !== undefined) {
      setAuthenticationState({ status: 'rejected', code: oauthOutcome.current });
      return;
    }
    void loadSession();

    return () => {
      currentRequestId.current += 1;
    };
  }, [loadSession]);

  const beginGoogleLogin = useCallback((): void => {
    if (api === undefined) {
      setAuthenticationState({
        status: 'technical-failure',
        error: configurationError ?? new Error('No se pudo iniciar el acceso corporativo.'),
      });
      return;
    }
    window.location.assign(api.auth.getGoogleLoginUrl());
  }, [api, configurationError]);

  const logout = useCallback(
    async (session: AuthSession): Promise<void> => {
      if (api === undefined) {
        setAuthenticationState({
          status: 'logout-failed',
          session,
          error: configurationError ?? new Error('No se pudo cerrar la sesión.'),
        });
        return;
      }

      const requestId = currentRequestId.current + 1;
      currentRequestId.current = requestId;
      setAuthenticationState({ status: 'logging-out', session });
      try {
        await api.auth.logout();
        if (requestId === currentRequestId.current) {
          setAuthenticationState({ status: 'signed-out' });
        }
      } catch (error) {
        if (requestId === currentRequestId.current) {
          setAuthenticationState({
            status: 'logout-failed',
            session,
            error: new Error('No se pudo cerrar la sesión. Intentá nuevamente.'),
          });
        }
      }
    },
    [api, configurationError],
  );

  if (authenticationState.status === 'checking') {
    return <AccessShell title="Verificando sesión" detail="Comprobando tu acceso corporativo." />;
  }

  if (authenticationState.status === 'signed-out' || authenticationState.status === 'rejected') {
    const rejectionMessage =
      authenticationState.status === 'rejected'
        ? oauthErrorMessages[authenticationState.code]
        : undefined;
    return (
      <AccessShell
        title="Acceso corporativo"
        detail="Ingresá con tu cuenta corporativa autorizada."
      >
        {rejectionMessage === undefined ? null : <p role="alert">{rejectionMessage}</p>}
        <button className="action-button" type="button" onClick={beginGoogleLogin}>
          Ingresar con Google
        </button>
      </AccessShell>
    );
  }

  if (authenticationState.status === 'technical-failure') {
    return (
      <AccessShell
        title="No pudimos verificar tu acceso"
        detail="La sesión no pudo consultarse en este momento."
      >
        <p role="alert">{authenticationState.error.message}</p>
        <button className="action-button" type="button" onClick={() => void loadSession()}>
          Reintentar
        </button>
      </AccessShell>
    );
  }

  const { session } = authenticationState;
  const isLoggingOut = authenticationState.status === 'logging-out';
  const logoutFailure =
    authenticationState.status === 'logout-failed' ? authenticationState.error : undefined;
  const employeeName = session.displayName ?? session.corporateEmail;

  return (
    <main className="platform-shell" data-visual-contract="matriz-continua-tablero-despacho">
      <header className="top-bar">
        <p className="product-name">Plataforma Timbo</p>
        <button
          className="logout-button"
          type="button"
          disabled={isLoggingOut}
          onClick={() => void logout(session)}
        >
          {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </header>
      <section className="subheader" aria-label="Información de sesión">
        <p>
          Empleado <strong>{employeeName}</strong>
        </p>
        <p>{formatCurrentDateTime()}</p>
      </section>
      <section
        className="dispatch-board"
        aria-labelledby="home-title"
        data-layout="continuous-empty-surface"
      >
        <p className="eyebrow">Inicio</p>
        <h1 id="home-title">Tablero de despacho</h1>
        {logoutFailure === undefined ? null : <p role="alert">{logoutFailure.message}</p>}
        <div className="empty-surface">
          <h2>Sin aplicaciones asignadas</h2>
          <p>Cuando tengas una aplicación asignada, aparecerá en este tablero.</p>
          {logoutFailure === undefined ? null : (
            <button className="text-button" type="button" onClick={() => void logout(session)}>
              Reintentar cierre de sesión
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

interface AccessShellProps {
  title: string;
  detail: string;
  children?: ReactNode;
}

function AccessShell({ title, detail, children }: AccessShellProps): React.JSX.Element {
  return (
    <main className="platform-shell" data-visual-contract="matriz-continua-tablero-despacho">
      <header className="top-bar">
        <p className="product-name">Plataforma Timbo</p>
      </header>
      <section className="subheader" aria-label="Estado de acceso">
        <p>Acceso corporativo</p>
      </section>
      <section className="access-surface" aria-labelledby="access-title">
        <p className="eyebrow">Plataforma Timbo</p>
        <h1 id="access-title">{title}</h1>
        <p>{detail}</p>
        {children}
      </section>
    </main>
  );
}
