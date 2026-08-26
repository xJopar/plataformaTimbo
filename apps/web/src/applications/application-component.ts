import type { Api, AuthSession, AuthorizedApplication } from '../api';

export interface ApplicationComponentProps {
  api: Api;
  application: AuthorizedApplication;
  availableApplications: readonly AuthorizedApplication[];
  session: AuthSession;
  isLoggingOut: boolean;
  logoutFailure: Error | undefined;
  onNavigate: (pathname: string) => void;
  onLogout: () => void;
}
