import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { OAuthLoginAttempt } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OAuthLoginAttemptUnavailableError } from './auth-persistence.errors';

export const OAUTH_LOGIN_ATTEMPT_DURATION_MS = 10 * 60 * 1000;

export interface CreatedOAuthLoginAttempt {
  id: string;
  state: string;
  codeChallenge: string;
  expiresAt: Date;
}

export interface ConsumedOAuthLoginAttempt {
  id: string;
  pkceVerifier: string;
  expiresAt: Date;
}

const OPERATION_CONSUME = 'consumeOAuthLoginAttempt';

export function derivePkceCodeChallenge(pkceVerifier: string): string {
  return createHash('sha256').update(pkceVerifier).digest('base64url');
}

@Injectable()
export class OAuthLoginAttemptsService {
  public constructor(private readonly prisma: PrismaService) {}

  public async createLoginAttempt(now: Date = new Date()): Promise<CreatedOAuthLoginAttempt> {
    const state = randomBytes(32).toString('base64url');
    const pkceVerifier = randomBytes(64).toString('base64url');
    const codeChallenge = derivePkceCodeChallenge(pkceVerifier);
    const expiresAt = new Date(now.getTime() + OAUTH_LOGIN_ATTEMPT_DURATION_MS);
    const attempt = await this.prisma.oAuthLoginAttempt.create({
      data: {
        stateHash: this.hashValue(state),
        pkceVerifier,
        createdAt: now,
        expiresAt,
      },
    });

    return { id: attempt.id, state, codeChallenge, expiresAt: attempt.expiresAt };
  }

  public async consumeLoginAttempt(
    state: string,
    now: Date = new Date(),
  ): Promise<ConsumedOAuthLoginAttempt> {
    const attempts = await this.prisma.oAuthLoginAttempt.updateManyAndReturn({
      where: {
        stateHash: this.hashValue(state),
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    const attempt = attempts[0];

    if (attempt === undefined) {
      throw new OAuthLoginAttemptUnavailableError(OPERATION_CONSUME);
    }

    return this.toConsumedAttempt(attempt);
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private toConsumedAttempt(attempt: OAuthLoginAttempt): ConsumedOAuthLoginAttempt {
    return {
      id: attempt.id,
      pkceVerifier: attempt.pkceVerifier,
      expiresAt: attempt.expiresAt,
    };
  }
}
