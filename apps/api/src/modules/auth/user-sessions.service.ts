import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { UserSession } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SESSION_DURATION_MS } from '../../runtime-config';
import { UserSessionUnavailableError } from './auth-persistence.errors';

export interface CreateUserSessionInput {
  userId: string;
  now?: Date;
}

export interface CreatedUserSession {
  id: string;
  token: string;
  expiresAt: Date;
}

const OPERATION_FIND_ACTIVE = 'findActiveUserSession';

@Injectable()
export class UserSessionsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async createSession(input: CreateUserSessionInput): Promise<CreatedUserSession> {
    const now = input.now ?? new Date();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
    const session = await this.prisma.userSession.create({
      data: {
        userId: input.userId,
        tokenHash: this.hashValue(token),
        createdAt: now,
        expiresAt,
      },
    });

    return { id: session.id, token, expiresAt: session.expiresAt };
  }

  public async findActiveSession(token: string, now: Date = new Date()): Promise<UserSession> {
    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash: this.hashValue(token) },
    });

    if (session === null) {
      throw new UserSessionUnavailableError(OPERATION_FIND_ACTIVE);
    }

    if (session.revokedAt !== null || session.expiresAt <= now) {
      throw new UserSessionUnavailableError(OPERATION_FIND_ACTIVE);
    }

    return session;
  }

  public async revokeSession(token: string, now: Date = new Date()): Promise<boolean> {
    const result = await this.prisma.userSession.updateMany({
      where: { tokenHash: this.hashValue(token), revokedAt: null },
      data: { revokedAt: now },
    });

    return result.count === 1;
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
