import { createHash } from 'node:crypto';
import type { Prisma, UserSession } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SESSION_DURATION_MS } from '../../runtime-config';
import { UserSessionUnavailableError } from './auth-persistence.errors';
import { UserSessionsService } from './user-sessions.service';

const createSession = (overrides: Partial<UserSession> = {}): UserSession => ({
  id: '497349ed-aac9-4a24-8efb-4612c80db6c8',
  userId: '51ce6077-4cfe-4f17-ac59-9d157b6bc916',
  tokenHash: 'a'.repeat(64),
  createdAt: new Date('2026-08-19T12:00:00.000Z'),
  expiresAt: new Date('2026-08-19T20:00:00.000Z'),
  revokedAt: null,
  ...overrides,
});

const hashValue = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('UserSessionsService', () => {
  const userSessionDelegate = {
    create: jest.fn(),
    findUnique: jest.fn(),
    updateManyAndReturn: jest.fn(),
  };
  const prisma = { userSession: userSessionDelegate } as unknown as PrismaService;
  const transactionClient = {
    userSession: userSessionDelegate,
  } as unknown as Prisma.TransactionClient;
  let service: UserSessionsService;

  beforeEach(() => {
    userSessionDelegate.create.mockReset();
    userSessionDelegate.findUnique.mockReset();
    userSessionDelegate.updateManyAndReturn.mockReset();
    service = new UserSessionsService(prisma);
  });

  it('crea una sesion opaca de ocho horas y persiste solamente su hash', async () => {
    const now = new Date('2026-08-19T12:00:00.000Z');
    const persistedSession = createSession({
      expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
    });
    userSessionDelegate.create.mockResolvedValue(persistedSession);

    const result = await service.createSession(transactionClient, {
      userId: persistedSession.userId,
      now,
    });

    expect(result.id).toBe(persistedSession.id);
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.expiresAt).toBe(persistedSession.expiresAt);
    expect(userSessionDelegate.create).toHaveBeenCalledWith({
      data: {
        userId: persistedSession.userId,
        tokenHash: hashValue(result.token),
        createdAt: now,
        expiresAt: persistedSession.expiresAt,
      },
    });
  });

  it('encuentra solamente una sesion vigente y no revocada', async () => {
    const now = new Date('2026-08-19T12:00:00.000Z');
    const persistedSession = createSession({ expiresAt: new Date('2026-08-19T20:00:00.000Z') });
    userSessionDelegate.findUnique.mockResolvedValue(persistedSession);

    await expect(service.findActiveSession('token-recibido', now)).resolves.toBe(persistedSession);
    expect(userSessionDelegate.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashValue('token-recibido') },
    });
  });

  it.each([
    ['ausente', null],
    ['vencida', createSession({ expiresAt: new Date('2026-08-19T12:00:00.000Z') })],
    ['revocada', createSession({ revokedAt: new Date('2026-08-19T11:59:00.000Z') })],
  ])('rechaza una sesion %s', async (_scenario, persistedSession) => {
    userSessionDelegate.findUnique.mockResolvedValue(persistedSession);

    await expect(
      service.findActiveSession('token-recibido', new Date('2026-08-19T12:00:00.000Z')),
    ).rejects.toEqual(
      expect.objectContaining({
        name: UserSessionUnavailableError.name,
        operation: 'findActiveUserSession',
      }),
    );
  });

  it('revoca una sesion activa y permite que el logout futuro sea repetible', async () => {
    const now = new Date('2026-08-19T12:05:00.000Z');
    const revokedSession = createSession({ revokedAt: now });
    userSessionDelegate.updateManyAndReturn.mockResolvedValue([revokedSession]);

    await expect(service.revokeSession(transactionClient, 'token-recibido', now)).resolves.toBe(
      revokedSession,
    );
    expect(userSessionDelegate.updateManyAndReturn).toHaveBeenCalledWith({
      where: { tokenHash: hashValue('token-recibido'), revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });

    userSessionDelegate.updateManyAndReturn.mockResolvedValue([]);
    await expect(
      service.revokeSession(transactionClient, 'token-recibido'),
    ).resolves.toBeUndefined();
  });

  it('no revoca ni devuelve una sesion vencida: la condiciona igual que una lectura activa', async () => {
    const now = new Date('2026-08-19T20:00:00.000Z');
    userSessionDelegate.updateManyAndReturn.mockResolvedValue([]);

    await expect(
      service.revokeSession(transactionClient, 'token-recibido', now),
    ).resolves.toBeUndefined();
    expect(userSessionDelegate.updateManyAndReturn).toHaveBeenCalledWith({
      where: { tokenHash: hashValue('token-recibido'), revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
  });

  it('propaga intacto un fallo inesperado de Prisma', async () => {
    const unexpectedError = new Error('fallo inesperado');
    userSessionDelegate.findUnique.mockRejectedValue(unexpectedError);

    await expect(service.findActiveSession('token-recibido')).rejects.toBe(unexpectedError);
  });
});
