import { Inject, Injectable } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import type { Prisma, User } from '../../generated/prisma/client';
import { resolveCorsOriginFromEnvironment, resolveGoogleOAuthConfig } from '../../runtime-config';
import type { AuditEventsService } from '../audit-events/audit-events.service';
import { ACCESS_PROFILES_SERVICE } from '../access-profiles/access-profiles.tokens';
import type { AccessProfilesService } from '../access-profiles/access-profiles.service';
import {
  GoogleSubjectAlreadyLinkedError,
  UserInactiveError,
  UserNotFoundError,
} from '../users/users.errors';
import type { UsersService } from '../users/users.service';
import { OAuthLoginAttemptUnavailableError } from './auth-persistence.errors';
import { AuthPublicError, type AuthPublicErrorCode } from './auth-public.errors';
import {
  AUTH_AUDIT_EVENTS_SERVICE,
  AUTH_PRISMA_SERVICE,
  GOOGLE_OAUTH_SERVICE,
  OAUTH_LOGIN_ATTEMPTS_SERVICE,
  USERS_SERVICE,
  USER_SESSIONS_SERVICE,
} from './auth.tokens';
import type { GoogleOAuthService } from './google-oauth.service';
import type { OAuthLoginAttemptsService } from './oauth-login-attempts.service';
import type { UserSessionsService } from './user-sessions.service';

// PrismaService y AuditEventsService se inyectan por token (en vez de la clase concreta) para que
// este archivo nunca importe por valor el cliente Prisma generado: export-openapi.ts construye
// AuthService como token stubeado sin base de datos real, y ts-node (a diferencia de ts-jest) no
// resuelve los imports internos ".js" del cliente generado por Prisma 7.
const USER_ACTOR_TYPE = 'USER';
const ANONYMOUS_ACTOR_TYPE = 'ANONYMOUS';

export interface CompleteGoogleLoginInput {
  state?: string;
  code?: string;
  providerError?: string;
}

export interface AuthenticatedIdentity {
  id: string;
  corporateEmail: string;
  displayName: string | null;
  isPlatformAdministrator: boolean;
}

const LOGIN_DENIED_REASON_CODES = [
  'USER_NOT_AUTHORIZED',
  'USER_INACTIVE',
  'GOOGLE_IDENTITY_MISMATCH',
  'GOOGLE_IDENTITY_INVALID',
] as const;

type LoginDeniedReasonCode = (typeof LOGIN_DENIED_REASON_CODES)[number];

function isLoginDeniedReasonCode(code: AuthPublicErrorCode): code is LoginDeniedReasonCode {
  return (LOGIN_DENIED_REASON_CODES as readonly string[]).includes(code);
}

@Injectable()
export class AuthService {
  public constructor(
    @Inject(GOOGLE_OAUTH_SERVICE) private readonly googleOAuthService: GoogleOAuthService,
    @Inject(OAUTH_LOGIN_ATTEMPTS_SERVICE)
    private readonly oauthLoginAttemptsService: OAuthLoginAttemptsService,
    @Inject(USER_SESSIONS_SERVICE) private readonly userSessionsService: UserSessionsService,
    @Inject(USERS_SERVICE) private readonly usersService: UsersService,
    @Inject(AUTH_PRISMA_SERVICE) private readonly prisma: PrismaService,
    @Inject(AUTH_AUDIT_EVENTS_SERVICE) private readonly auditEventsService: AuditEventsService,
    @Inject(ACCESS_PROFILES_SERVICE)
    private readonly accessProfilesService: AccessProfilesService,
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

    try {
      const googleIdentity = await this.googleOAuthService.exchangeAuthorizationCode({
        code: input.code,
        pkceVerifier: loginAttempt.pkceVerifier,
      });

      return await this.prisma.$transaction(async (transactionClient) => {
        const user = await this.linkGoogleIdentity(
          transactionClient,
          googleIdentity.email,
          googleIdentity.subject,
        );
        const session = await this.userSessionsService.createSession(transactionClient, {
          userId: user.id,
        });
        await this.auditEventsService.append(transactionClient, {
          eventName: 'security.login_succeeded',
          actor: { actorType: USER_ACTOR_TYPE, actorUserId: user.id },
        });

        return { token: session.token };
      });
    } catch (error) {
      if (error instanceof AuthPublicError && isLoginDeniedReasonCode(error.code)) {
        await this.recordLoginDenied(error.code);
      }
      throw error;
    }
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
    if (sessionToken === undefined) {
      return;
    }

    await this.prisma.$transaction(async (transactionClient) => {
      const revokedSession = await this.userSessionsService.revokeSession(
        transactionClient,
        sessionToken,
      );

      if (revokedSession === undefined) {
        return;
      }

      await this.auditEventsService.append(transactionClient, {
        eventName: 'security.logout',
        actor: { actorType: USER_ACTOR_TYPE, actorUserId: revokedSession.userId },
      });
    });
  }

  public async toAuthenticatedIdentity(user: User): Promise<AuthenticatedIdentity> {
    return {
      id: user.id,
      corporateEmail: user.corporateEmail,
      displayName: user.displayName,
      isPlatformAdministrator:
        await this.accessProfilesService.hasActivePlatformAdministratorAssignment(user.id),
    };
  }

  private async linkGoogleIdentity(
    transactionClient: Prisma.TransactionClient,
    corporateEmail: string,
    googleSubject: string,
  ): Promise<User> {
    try {
      const user = await this.usersService.linkGoogleSubject(transactionClient, {
        corporateEmail,
        googleSubject,
      });

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

  private async recordLoginDenied(reasonCode: LoginDeniedReasonCode): Promise<void> {
    await this.prisma.$transaction((transactionClient) =>
      this.auditEventsService.append(transactionClient, {
        eventName: 'security.login_denied',
        actor: { actorType: ANONYMOUS_ACTOR_TYPE },
        metadata: { reasonCode },
      }),
    );
  }
}
