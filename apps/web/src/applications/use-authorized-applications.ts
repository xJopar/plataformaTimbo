import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiHttpError,
  ApplicationsApiUnavailableError,
  type Api,
  type AuthorizedApplication,
} from '../api';
import { reportBrowserOperationFailed } from '../browser-diagnostics';

type AuthorizedApplicationsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; applications: AuthorizedApplication[] };

export function useAuthorizedApplications(
  api: Api,
  onSessionExpired: () => void,
): {
  state: AuthorizedApplicationsState;
  reload: () => Promise<void>;
} {
  const currentRequestId = useRef(0);
  const [state, setState] = useState<AuthorizedApplicationsState>({ status: 'loading' });

  const reload = useCallback(async (): Promise<void> => {
    const requestId = currentRequestId.current + 1;
    currentRequestId.current = requestId;
    setState({ status: 'loading' });
    try {
      const applications = await api.applications.listAuthorizedApplications();
      if (requestId === currentRequestId.current) {
        setState({ status: 'ready', applications });
      }
    } catch (error: unknown) {
      reportBrowserOperationFailed(error, {
        operation: 'applications.load-authorized',
        method: 'GET',
        route: '/api/applications',
        provider: 'api',
        ...(error instanceof ApiHttpError
          ? {
              status: error.status,
              ...(error.requestId === undefined ? {} : { requestId: error.requestId }),
            }
          : {}),
      });

      if (!(error instanceof ApiHttpError || error instanceof ApplicationsApiUnavailableError)) {
        throw error;
      }

      if (requestId !== currentRequestId.current) {
        return;
      }

      if (error instanceof ApiHttpError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setState({ status: 'error' });
    }
  }, [api, onSessionExpired]);

  useEffect(() => {
    void reload();
    return () => {
      currentRequestId.current += 1;
    };
  }, [reload]);

  return { state, reload };
}
