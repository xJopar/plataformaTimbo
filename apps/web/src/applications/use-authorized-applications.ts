import { useCallback, useEffect, useRef, useState } from 'react';
import type { Api, AuthorizedApplication } from '../api';

type AuthorizedApplicationsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; applications: AuthorizedApplication[] };

export function useAuthorizedApplications(api: Api): {
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
    } catch {
      if (requestId === currentRequestId.current) {
        setState({ status: 'error' });
      }
    }
  }, [api]);

  useEffect(() => {
    void reload();
    return () => {
      currentRequestId.current += 1;
    };
  }, [reload]);

  return { state, reload };
}
