import { Inject, Injectable } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { resolveCorsOriginFromEnvironment, resolveGoogleOAuthConfig } from '../../runtime-config';
import {
  GoogleSubjectAlreadyLinkedError,
  UserInactiveError,
  UserNotFoundError,
} from '../users/users.errors';
import type { UsersService } from '../users/users.service';
import { OAuthLoginAttemptUnavailableError } from './auth-persistence.errors';
import { AuthPublicError } from './auth-public.errors';
import {
  GOOGLE_OAUTH_SERVICE,
  OAUTH_LOGIN_ATTEMPTS_SERVICE,
  USERS_SERVICE,
  USER_SESSIONS_SERVICE,
} from './auth.tokens';
import type { GoogleOAuthService } from './google-oauth.service';
import type { OAuthLoginAttemptsService } from './oauth-login-attempts.service';
import type { UserSessionsService } from './user-sessions.service';

export interface CompleteGoogleLoginInput {
  state?: string;
  code?: string;
  providerError?: string;
}

export interface AuthenticatedIdentity {
  id: string;
  corporateEmail: string;
  displayName: string | null;
}

@Injectable()
export class AuthService {
  public constructor(
    @Inject(GOOGLE_OAUTH_SERVICE) private readonly googleOAuthService: GoogleOAuthService,
    @Inject(OAUTH_LOGIN_ATTEMPTS_SERVICE)
    private readonly oauthLoginAttemptsService: OAuthLoginAttemptsService,
    @Inject(USER_SESSIONS_SERVICE) private readonly userSessionsService: UserSessionsService,
    @Inject(USERS_SERVICE) private readonly usersService: UsersService,
  ) {}

  public async beginGoogleLogin(): Promise<string> {
    const loginAttempt = await this.oauthLoginAttemptsService.createLoginAttempt();
    return this.googleOAuthService.createAuthorizationUrl(loginAttempt);
  }

  public async completeGoogleLogin(input: CompleteGoogleLoginInput): Promise<{ token: string }> {
    if (input.state === undefined) {
      throw new AuthPublicError('LOGIN_ATTEMPT_INVALID', 400);
    }

    let loginAttempt;
    try {
      loginAttempt = await this.oauthLoginAttemptsService.consumeLoginAttempt(input.state);
    } catch (error) {
      if (error instanceof OAuthLoginAttemptUnavailableError) {
        throw new AuthPublicError('LOGIN_ATTEMPT_INVALID', 400);
      }
      throw error;
    }

    if (input.providerError !== undefined || input.code === undefined) {
      throw new AuthPublicError('LOGIN_RESPONSE_INVALID', 400);
    }

    const googleIdentity = await this.googleOAuthService.exchangeAuthorizationCode({
      code: input.code,
      pkceVerifier: loginAttempt.pkceVerifier,
    });
    const user = await this.linkGoogleIdentity(googleIdentity.email, googleIdentity.subject);
    const session = await this.userSessionsService.createSession({ userId: user.id });

    return { token: session.token };
  }

  public getSessionCookieConfig() {
    return resolveGoogleOAuthConfig().sessionCookie;
  }

  public getWebHomeUrl(publicErrorCode?: string): string {
    const webHomeUrl = new URL('/', resolveCorsOriginFromEnvironment());
    if (publicErrorCode !== undefined) {
      webHomeUrl.searchParams.set('auth_error', publicErrorCode);
    }
    return webHomeUrl.toString();
  }

  public async logout(sessionToken: string | undefined): Promise<void> {
    if (sessionToken !== undefined) {
      await this.userSessionsService.revokeSession(sessionToken);
    }
  }

  public toAuthenticatedIdentity(user: User): AuthenticatedIdentity {
    return {
      id: user.id,
      corporateEmail: user.corporateEmail,
      displayName: user.displayName,
    };
  }

  private async linkGoogleIdentity(corporateEmail: string, googleSubject: string): Promise<User> {
    try {
      const user = await this.usersService.linkGoogleSubject({ corporateEmail, googleSubject });

      if (user.status !== 'ACTIVE') {
        throw new AuthPublicError('USER_INACTIVE', 403);
      }

      return user;
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw new AuthPublicError('USER_NOT_AUTHORIZED', 403);
      }
      if (error instanceof UserInactiveError) {
        throw new AuthPublicError('USER_INACTIVE', 403);
      }
      if (error instanceof GoogleSubjectAlreadyLinkedError) {
        throw new AuthPublicError('GOOGLE_IDENTITY_MISMATCH', 403);
      }
      throw error;
    }
  }
}
