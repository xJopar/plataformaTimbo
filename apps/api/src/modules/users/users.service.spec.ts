import {
  AccessProfileKey,
  AuditActorType,
  type Prisma,
  UserStatus,
  type User,
} from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AuditEventsService } from '../audit-events/audit-events.service';
import {
  CorporateEmailAlreadyInUseError,
  GoogleSubjectAlreadyLinkedError,
  InvalidCorporateEmailError,
  InvalidUserStatusTransitionError,
  PlatformAdministratorCannotBeDeactivatedError,
  UserNotFoundError,
  ZohoCrmUserIdAlreadyInUseError,
} from './users.errors';
import { UsersService } from './users.service';

const ACTOR_USER_ID = '9c6a5e2b-2e0e-4c34-9d5a-4a7f3c9d2b41';

const createUser = (overrides: Partial<User> = {}): User => ({
  id: '64e90b9e-9701-4bdf-8949-2f0a9d1cd17c',
  corporateEmail: 'persona@example.test',
  displayName: null,
  googleSubject: null,
  zohoCrmUserId: null,
  status: UserStatus.ACTIVE,
  createdAt: new Date('2026-08-18T12:00:00.000Z'),
  updatedAt: new Date('2026-08-18T12:00:00.000Z'),
  deactivatedAt: null,
  ...overrides,
});

const createPrismaError = (
  code: string,
  target?: string[],
): Error & { code: string; meta?: unknown } =>
  Object.assign(new Error(`Prisma ${code}`), {
    code,
    ...(target === undefined ? {} : { meta: { target } }),
  });

describe('UsersService', () => {
  const userDelegate = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateManyAndReturn: jest.fn(),
  };
  const userProfileAssignmentDelegate = { findFirst: jest.fn() };
  const transactionClient = {
    user: userDelegate,
    userProfileAssignment: userProfileAssignmentDelegate,
  } as unknown as Prisma.TransactionClient;
  const prismaTransaction = jest.fn((callback: (tx: typeof transactionClient) => unknown) =>
    callback(transactionClient),
  );
  const prisma = {
    user: userDelegate,
    $transaction: prismaTransaction,
  } as unknown as PrismaService;
  const auditEventsService = { append: jest.fn() };
  let service: UsersService;

  beforeEach(() => {
    userDelegate.create.mockReset();
    userDelegate.findUnique.mockReset();
    userDelegate.update.mockReset();
    userDelegate.updateManyAndReturn.mockReset();
    userProfileAssignmentDelegate.findFirst.mockReset();
    userProfileAssignmentDelegate.findFirst.mockResolvedValue(null);
    prismaTransaction.mockClear();
    auditEventsService.append.mockReset();
    auditEventsService.append.mockResolvedValue(undefined);
    service = new UsersService(prisma, auditEventsService as unknown as AuditEventsService);
  });

  describe('preauthorizeUser', () => {
    it('normaliza el correo y conserva el nombre opcional', async () => {
      const user = createUser({
        corporateEmail: 'persona@example.test',
        displayName: 'Nombre visible',
      });
      userDelegate.create.mockResolvedValue(user);

      await expect(
        service.preauthorizeUser({
          corporateEmail: '  Persona@Example.Test  ',
          displayName: '  Nombre visible  ',
        }),
      ).resolves.toBe(user);

      expect(userDelegate.create).toHaveBeenCalledWith({
        data: {
          corporateEmail: 'persona@example.test',
          displayName: 'Nombre visible',
        },
      });
      expect(auditEventsService.append).toHaveBeenCalledWith(transactionClient, {
        eventName: 'access.user_preauthorized',
        actor: { actorType: AuditActorType.SYSTEM, systemActorKey: 'preauthorize-user-cli' },
        target: { targetType: 'user', targetId: user.id },
      });
    });

    it('trata un nombre ausente o vacío como opcional', async () => {
      userDelegate.create.mockResolvedValue(createUser());

      await service.preauthorizeUser({
        corporateEmail: 'persona@example.test',
        displayName: '   ',
      });

      expect(userDelegate.create).toHaveBeenCalledWith({
        data: {
          corporateEmail: 'persona@example.test',
          displayName: undefined,
        },
      });
    });

    it('rechaza un correo vacío luego de normalizarlo', async () => {
      await expect(service.preauthorizeUser({ corporateEmail: '  ' })).rejects.toBeInstanceOf(
        InvalidCorporateEmailError,
      );
      expect(userDelegate.create).not.toHaveBeenCalled();
    });

    it.each([['corporate_email', CorporateEmailAlreadyInUseError]])(
      'traduce P2002 del correo',
      async (target, ErrorType) => {
        const prismaError = createPrismaError('P2002', [target]);
        userDelegate.create.mockRejectedValue(prismaError);

        await expect(
          service.preauthorizeUser({ corporateEmail: 'persona@example.test' }),
        ).rejects.toEqual(
          expect.objectContaining({
            cause: prismaError,
            operation: 'preauthorizeUser',
          }),
        );
        await expect(
          service.preauthorizeUser({ corporateEmail: 'otra@example.test' }),
        ).rejects.toBeInstanceOf(ErrorType);
      },
    );

    it('propaga un fallo de auditoría sin confirmar la creación del usuario', async () => {
      const auditFailure = new Error('fallo de auditoría');
      userDelegate.create.mockResolvedValue(createUser());
      auditEventsService.append.mockRejectedValue(auditFailure);

      await expect(
        service.preauthorizeUser({ corporateEmail: 'persona@example.test' }),
      ).rejects.toBe(auditFailure);
    });
  });

  describe('findByCorporateEmail', () => {
    it('consulta por correo normalizado', async () => {
      const user = createUser();
      userDelegate.findUnique.mockResolvedValue(user);

      await expect(
        service.findByCorporateEmail({ corporateEmail: '  PERSONA@EXAMPLE.TEST ' }),
      ).resolves.toBe(user);

      expect(userDelegate.findUnique).toHaveBeenCalledWith({
        where: { corporateEmail: 'persona@example.test' },
      });
    });

    it('traduce un resultado inexistente a error de dominio', async () => {
      userDelegate.findUnique.mockResolvedValue(null);

      await expect(
        service.findByCorporateEmail({ corporateEmail: 'persona@example.test' }),
      ).rejects.toEqual(expect.objectContaining({ operation: 'findByCorporateEmail' }));
      await expect(
        service.findByCorporateEmail({ corporateEmail: 'otra@example.test' }),
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  describe('linkGoogleSubject', () => {
    it('vincula Google para un usuario que todavía no lo tiene', async () => {
      const linkedUser = createUser({ googleSubject: 'google-subject-1' });
      userDelegate.updateManyAndReturn.mockResolvedValue([linkedUser]);

      await expect(
        service.linkGoogleSubject(transactionClient, {
          corporateEmail: 'PERSONA@example.test',
          googleSubject: 'google-subject-1',
        }),
      ).resolves.toBe(linkedUser);

      expect(userDelegate.updateManyAndReturn).toHaveBeenCalledWith({
        where: {
          corporateEmail: 'persona@example.test',
          googleSubject: null,
          status: UserStatus.ACTIVE,
        },
        data: { googleSubject: 'google-subject-1' },
      });
    });

    it('devuelve la fila existente para el mismo subject sin una segunda mutación', async () => {
      const originalUpdatedAt = new Date('2026-08-18T12:00:00.000Z');
      const user = createUser({ googleSubject: 'google-subject-1', updatedAt: originalUpdatedAt });
      userDelegate.updateManyAndReturn.mockResolvedValue([]);
      userDelegate.findUnique.mockResolvedValue(user);

      const result = await service.linkGoogleSubject(transactionClient, {
        corporateEmail: user.corporateEmail,
        googleSubject: user.googleSubject ?? '',
      });

      expect(result).toBe(user);
      expect(result.updatedAt).toBe(originalUpdatedAt);
      expect(userDelegate.updateManyAndReturn).toHaveBeenCalledWith({
        where: {
          corporateEmail: user.corporateEmail,
          googleSubject: null,
          status: UserStatus.ACTIVE,
        },
        data: { googleSubject: 'google-subject-1' },
      });
      expect(userDelegate.updateManyAndReturn).toHaveBeenCalledTimes(1);
    });

    it('rechaza una carrera que intentó reemplazar un subject existente', async () => {
      userDelegate.updateManyAndReturn.mockResolvedValue([]);
      userDelegate.findUnique.mockResolvedValue(createUser({ googleSubject: 'google-subject-1' }));

      await expect(
        service.linkGoogleSubject(transactionClient, {
          corporateEmail: 'persona@example.test',
          googleSubject: 'google-subject-2',
        }),
      ).rejects.toBeInstanceOf(GoogleSubjectAlreadyLinkedError);
      expect(userDelegate.findUnique).toHaveBeenCalledWith({
        where: { corporateEmail: 'persona@example.test' },
      });
    });

    it('traduce la colisión P2002 de otra identidad Google', async () => {
      const prismaError = createPrismaError('P2002', ['google_subject']);
      userDelegate.updateManyAndReturn.mockRejectedValue(prismaError);

      await expect(
        service.linkGoogleSubject(transactionClient, {
          corporateEmail: 'persona@example.test',
          googleSubject: 'google-subject-1',
        }),
      ).rejects.toEqual(
        expect.objectContaining({ cause: prismaError, operation: 'linkGoogleSubject' }),
      );
    });

    it('traduce cero filas y una relectura inexistente a usuario no encontrado', async () => {
      userDelegate.updateManyAndReturn.mockResolvedValue([]);
      userDelegate.findUnique.mockResolvedValue(null);

      await expect(
        service.linkGoogleSubject(transactionClient, {
          corporateEmail: 'persona@example.test',
          googleSubject: 'google-subject-1',
        }),
      ).rejects.toEqual(expect.objectContaining({ operation: 'linkGoogleSubject' }));
    });
  });

  describe('saveZohoCrmUserId', () => {
    it('actualiza explícitamente Zoho y permite limpiarlo con null', async () => {
      userDelegate.update.mockResolvedValue(createUser());

      await service.saveZohoCrmUserId({
        corporateEmail: 'persona@example.test',
        zohoCrmUserId: null,
      });

      expect(userDelegate.update).toHaveBeenCalledWith({
        where: { corporateEmail: 'persona@example.test' },
        data: { zohoCrmUserId: null },
      });
    });

    it('traduce una colisión P2002 de Zoho', async () => {
      const prismaError = createPrismaError('P2002', ['zoho_crm_user_id']);
      userDelegate.update.mockRejectedValue(prismaError);

      await expect(
        service.saveZohoCrmUserId({
          corporateEmail: 'persona@example.test',
          zohoCrmUserId: 'zoho-user-1',
        }),
      ).rejects.toEqual(
        expect.objectContaining({ cause: prismaError, operation: 'saveZohoCrmUserId' }),
      );
      await expect(
        service.saveZohoCrmUserId({
          corporateEmail: 'otra@example.test',
          zohoCrmUserId: 'zoho-user-2',
        }),
      ).rejects.toBeInstanceOf(ZohoCrmUserIdAlreadyInUseError);
    });
  });

  describe('cambios de estado', () => {
    it('no desactiva a un usuario con la asignación PLATFORM_ADMIN, incluido el actor', async () => {
      userProfileAssignmentDelegate.findFirst.mockResolvedValue({ id: 'assignment-a' });

      await expect(
        service.deactivateUser({
          corporateEmail: 'persona@example.test',
          actorUserId: ACTOR_USER_ID,
        }),
      ).rejects.toBeInstanceOf(PlatformAdministratorCannotBeDeactivatedError);

      expect(userProfileAssignmentDelegate.findFirst).toHaveBeenCalledWith({
        where: {
          user: { corporateEmail: 'persona@example.test' },
          profile: { key: AccessProfileKey.PLATFORM_ADMIN },
        },
        select: { id: true },
      });
      expect(userDelegate.updateManyAndReturn).not.toHaveBeenCalled();
      expect(auditEventsService.append).not.toHaveBeenCalled();
    });

    it('desactiva un usuario activo con fecha de desactivación y audita al actor administrador', async () => {
      const deactivatedUser = createUser({
        status: UserStatus.INACTIVE,
        deactivatedAt: new Date('2026-08-18T13:00:00.000Z'),
      });
      userDelegate.updateManyAndReturn.mockResolvedValue([deactivatedUser]);

      await expect(
        service.deactivateUser({
          corporateEmail: 'persona@example.test',
          actorUserId: ACTOR_USER_ID,
        }),
      ).resolves.toBe(deactivatedUser);

      expect(userDelegate.updateManyAndReturn).toHaveBeenCalledWith({
        where: { corporateEmail: 'persona@example.test', status: UserStatus.ACTIVE },
        // expect.any(...) de Jest está tipado como "any" en @types/jest; no hay alternativa tipada.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: { status: UserStatus.INACTIVE, deactivatedAt: expect.any(Date) },
      });
      expect(auditEventsService.append).toHaveBeenCalledWith(transactionClient, {
        eventName: 'access.user_deactivated',
        actor: { actorType: AuditActorType.USER, actorUserId: ACTOR_USER_ID },
        target: { targetType: 'user', targetId: deactivatedUser.id },
      });
    });

    it('reactiva un usuario inactivo, limpia su fecha y audita al actor administrador', async () => {
      const reactivatedUser = createUser();
      userDelegate.updateManyAndReturn.mockResolvedValue([reactivatedUser]);

      await expect(
        service.reactivateUser({
          corporateEmail: 'persona@example.test',
          actorUserId: ACTOR_USER_ID,
        }),
      ).resolves.toBe(reactivatedUser);

      expect(userDelegate.updateManyAndReturn).toHaveBeenCalledWith({
        where: { corporateEmail: 'persona@example.test', status: UserStatus.INACTIVE },
        data: { status: UserStatus.ACTIVE, deactivatedAt: null },
      });
      expect(auditEventsService.append).toHaveBeenCalledWith(transactionClient, {
        eventName: 'access.user_reactivated',
        actor: { actorType: AuditActorType.USER, actorUserId: ACTOR_USER_ID },
        target: { targetType: 'user', targetId: reactivatedUser.id },
      });
    });

    it.each(['deactivateUser', 'reactivateUser'] as const)(
      'propaga un fallo de auditoría sin confirmar el %s',
      async (method) => {
        const changedUser = createUser({ status: UserStatus.INACTIVE });
        const auditFailure = new Error('fallo de auditoría');
        userDelegate.updateManyAndReturn.mockResolvedValue([changedUser]);
        auditEventsService.append.mockRejectedValue(auditFailure);

        const result =
          method === 'deactivateUser'
            ? service.deactivateUser({
                corporateEmail: 'persona@example.test',
                actorUserId: ACTOR_USER_ID,
              })
            : service.reactivateUser({
                corporateEmail: 'persona@example.test',
                actorUserId: ACTOR_USER_ID,
              });

        await expect(result).rejects.toBe(auditFailure);
      },
    );

    it.each([
      [UserStatus.INACTIVE, 'deactivateUser', 'deactivateUser'],
      [UserStatus.ACTIVE, 'reactivateUser', 'reactivateUser'],
    ] as const)(
      'rechaza la carrera con transición inválida desde %s',
      async (status, operation, method) => {
        userDelegate.updateManyAndReturn.mockResolvedValue([]);
        userDelegate.findUnique.mockResolvedValue(
          createUser({ status, deactivatedAt: status === UserStatus.INACTIVE ? new Date() : null }),
        );

        const result =
          method === 'deactivateUser'
            ? service.deactivateUser({
                corporateEmail: 'persona@example.test',
                actorUserId: ACTOR_USER_ID,
              })
            : service.reactivateUser({
                corporateEmail: 'persona@example.test',
                actorUserId: ACTOR_USER_ID,
              });

        await expect(result).rejects.toEqual(
          expect.objectContaining({ operation, name: InvalidUserStatusTransitionError.name }),
        );
        expect(userDelegate.updateManyAndReturn).toHaveBeenCalledTimes(1);
        expect(auditEventsService.append).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['deactivateUser', 'deactivateUser'],
      ['reactivateUser', 'reactivateUser'],
    ] as const)(
      'traduce una carrera que ya no encuentra usuario al %s',
      async (method, operation) => {
        userDelegate.updateManyAndReturn.mockResolvedValue([]);
        userDelegate.findUnique.mockResolvedValue(null);

        const result =
          method === 'deactivateUser'
            ? service.deactivateUser({
                corporateEmail: 'persona@example.test',
                actorUserId: ACTOR_USER_ID,
              })
            : service.reactivateUser({
                corporateEmail: 'persona@example.test',
                actorUserId: ACTOR_USER_ID,
              });

        await expect(result).rejects.toEqual(expect.objectContaining({ operation }));
      },
    );
  });

  it('traduce P2025 a usuario no encontrado', async () => {
    const prismaError = createPrismaError('P2025');
    userDelegate.findUnique.mockResolvedValue(createUser());
    userDelegate.update.mockRejectedValue(prismaError);

    await expect(
      service.saveZohoCrmUserId({
        corporateEmail: 'persona@example.test',
        zohoCrmUserId: 'zoho-user-1',
      }),
    ).rejects.toEqual(
      expect.objectContaining({ cause: prismaError, operation: 'saveZohoCrmUserId' }),
    );
  });

  it('propaga intacto un fallo Prisma desconocido', async () => {
    const unexpectedError = new Error('fallo inesperado');
    userDelegate.create.mockRejectedValue(unexpectedError);

    await expect(service.preauthorizeUser({ corporateEmail: 'persona@example.test' })).rejects.toBe(
      unexpectedError,
    );
  });

  it('propaga intacto un fallo desconocido de la mutación condicional', async () => {
    const unexpectedError = new Error('fallo condicional inesperado');
    userDelegate.updateManyAndReturn.mockRejectedValue(unexpectedError);

    await expect(
      service.deactivateUser({
        corporateEmail: 'persona@example.test',
        actorUserId: ACTOR_USER_ID,
      }),
    ).rejects.toBe(unexpectedError);
  });

  it('propaga intacto un P2002 cuyo campo no puede identificarse con certeza', async () => {
    const ambiguousConflict = createPrismaError('P2002', ['corporate_email', 'google_subject']);
    userDelegate.create.mockRejectedValue(ambiguousConflict);

    await expect(service.preauthorizeUser({ corporateEmail: 'persona@example.test' })).rejects.toBe(
      ambiguousConflict,
    );
  });
});
