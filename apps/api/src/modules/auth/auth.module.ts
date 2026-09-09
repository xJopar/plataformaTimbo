import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PrismaModule } from '../../database/prisma.module';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { AccessProfilesModule } from '../access-profiles/access-profiles.module';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  AUTH_AUDIT_EVENTS_SERVICE,
  AUTH_PRISMA_SERVICE,
  GOOGLE_OAUTH_SERVICE,
  OAUTH_LOGIN_ATTEMPTS_SERVICE,
  USERS_SERVICE,
  USER_SESSIONS_SERVICE,
} from './auth.tokens';
import { CsrfProtectionGuard } from './csrf-protection.guard';
import { GoogleOAuthService } from './google-oauth.service';
import { OAuthLoginAttemptsService } from './oauth-login-attempts.service';
import { SessionAuthenticationGuard } from './session-authentication.guard';
import { UserSessionsService } from './user-sessions.service';

@Module({
  imports: [PrismaModule, UsersModule, AuditEventsModule, AccessProfilesModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    CsrfProtectionGuard,
    GoogleOAuthService,
    OAuthLoginAttemptsService,
    SessionAuthenticationGuard,
    UserSessionsService,
    { provide: GOOGLE_OAUTH_SERVICE, useExisting: GoogleOAuthService },
    { provide: OAUTH_LOGIN_ATTEMPTS_SERVICE, useExisting: OAuthLoginAttemptsService },
    { provide: USER_SESSIONS_SERVICE, useExisting: UserSessionsService },
    { provide: USERS_SERVICE, useExisting: UsersService },
    { provide: AUTH_PRISMA_SERVICE, useExisting: PrismaService },
    { provide: AUTH_AUDIT_EVENTS_SERVICE, useExisting: AuditEventsService },
  ],
  exports: [
    AuthService,
    CsrfProtectionGuard,
    OAuthLoginAttemptsService,
    SessionAuthenticationGuard,
    UserSessionsService,
    USER_SESSIONS_SERVICE,
    USERS_SERVICE,
  ],
})
export class AuthModule {}
