import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../generated/prisma/client';
import type { UsersService } from '../users/users.service';
import { AuthPublicError } from './auth-public.errors';
import { UserSessionUnavailableError } from './auth-persistence.errors';
import { USERS_SERVICE, USER_SESSIONS_SERVICE } from './auth.tokens';
import { readSessionToken } from './session-cookie';
import type { UserSessionsService } from './user-sessions.service';

export interface AuthenticatedRequest extends Request {
  authenticatedUser?: User;
}

@Injectable()
export class SessionAuthenticationGuard implements CanActivate {
  public constructor(
    @Inject(USER_SESSIONS_SERVICE) private readonly userSessionsService: UserSessionsService,
    @Inject(USERS_SERVICE) private readonly usersService: UsersService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionToken = readSessionToken(request.header('cookie'));

    if (sessionToken === undefined) {
      throw new AuthPublicError('AUTHENTICATION_REQUIRED', 401);
    }

    try {
      const session = await this.userSessionsService.findActiveSession(sessionToken);
      const user = await this.usersService.findActiveUserById({ userId: session.userId });

      if (user === null) {
        throw new AuthPublicError('AUTHENTICATION_REQUIRED', 401);
      }

      request.authenticatedUser = user;
      return true;
    } catch (error) {
      if (error instanceof UserSessionUnavailableError) {
        throw new AuthPublicError('AUTHENTICATION_REQUIRED', 401);
      }
      if (error instanceof AuthPublicError) {
        throw error;
      }
      throw error;
    }
  }
}
