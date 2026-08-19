import { createHash } from 'node:crypto';
import type { OAuthLoginAttempt } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OAuthLoginAttemptUnavailableError } from './auth-persistence.errors';
import {
  derivePkceCodeChallenge,
  OAUTH_LOGIN_ATTEMPT_DURATION_MS,
  OAuthLoginAttemptsService,
} from './oauth-login-attempts.service';

const createAttempt = (overrides: Partial<OAuthLoginAttempt> = {}): OAuthLoginAttempt => ({
  id: '61c586d1-fbbe-4829-b252-e98ca565af29',
  stateHash: 'a'.repeat(64),
  pkceVerifier: 'pkce-verifier',
  createdAt: new Date('2026-08-19T12:00:00.000Z'),
  expiresAt: new Date('2026-08-19T12:10:00.000Z'),
  consumedAt: null,
  ...overrides,
});

const hashValue = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('OAuthLoginAttemptsService', () => {
  const loginAttemptDelegate = {
    create: jest.fn(),
    updateManyAndReturn: jest.fn(),
  };
  const prisma = { oAuthLoginAttempt: loginAttemptDelegate } as unknown as PrismaService;
  let service: OAuthLoginAttemptsService;

  beforeEach(() => {
    loginAttemptDelegate.create.mockReset();
    loginAttemptDelegate.updateManyAndReturn.mockReset();
    service = new OAuthLoginAttemptsService(prisma);
  });

  it('deriva el code challenge S256 Base64URL sin padding para un verifier controlado', () => {
    const pkceVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

    expect(derivePkceCodeChallenge(pkceVerifier)).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('genera state y PKCE criptograficos, y persiste solamente el hash de state', async () => {
    const now = new Date('2026-08-19T12:00:00.000Z');
    const persistedAttempt = createAttempt({
      expiresAt: new Date(now.getTime() + OAUTH_LOGIN_ATTEMPT_DURATION_MS),
    });
    loginAttemptDelegate.create.mockResolvedValue(persistedAttempt);

    const result = await service.createLoginAttempt(now);

    expect(result.id).toBe(persistedAttempt.id);
    expect(result.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.expiresAt).toBe(persistedAttempt.expiresAt);
    expect(result).not.toHaveProperty('pkceVerifier');
    expect(loginAttemptDelegate.create).toHaveBeenCalledWith({
      data: {
        stateHash: hashValue(result.state),
        // expect.any(...) de Jest esta tipado como "any"; no hay alternativa tipada.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        pkceVerifier: expect.any(String),
        createdAt: now,
        expiresAt: persistedAttempt.expiresAt,
      },
    });
  });

  it('consume atomica y exactamente una vez un intento vigente', async () => {
    const now = new Date('2026-08-19T12:03:00.000Z');
    const persistedAttempt = createAttempt();
    loginAttemptDelegate.updateManyAndReturn.mockResolvedValue([persistedAttempt]);

    await expect(service.consumeLoginAttempt('state-recibido', now)).resolves.toEqual({
      id: persistedAttempt.id,
      pkceVerifier: persistedAttempt.pkceVerifier,
      expiresAt: persistedAttempt.expiresAt,
    });
    expect(loginAttemptDelegate.updateManyAndReturn).toHaveBeenCalledWith({
      where: {
        stateHash: hashValue('state-recibido'),
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
  });

  it('rechaza un state ausente, vencido o previamente consumido', async () => {
    loginAttemptDelegate.updateManyAndReturn.mockResolvedValue([]);

    await expect(service.consumeLoginAttempt('state-no-valido')).rejects.toEqual(
      expect.objectContaining({
        name: OAuthLoginAttemptUnavailableError.name,
        operation: 'consumeOAuthLoginAttempt',
      }),
    );
  });

  it('propaga intacto un fallo inesperado de Prisma', async () => {
    const unexpectedError = new Error('fallo inesperado');
    loginAttemptDelegate.create.mockRejectedValue(unexpectedError);

    await expect(service.createLoginAttempt()).rejects.toBe(unexpectedError);
  });
});
