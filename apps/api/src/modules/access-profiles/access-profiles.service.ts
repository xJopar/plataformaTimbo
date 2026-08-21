import { Injectable } from '@nestjs/common';
import { AccessProfileKey, AuditActorType, Prisma, type User } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { UserNotFoundError } from '../users/users.errors';
import { FirstPlatformAdministratorAlreadyAssignedError } from './access-profiles.errors';

const ASSIGN_PLATFORM_ADMIN_CLI_SYSTEM_ACTOR_KEY = 'assign-platform-admin-cli';
const OPERATION_ASSIGN_FIRST_PLATFORM_ADMINISTRATOR = 'assignFirstPlatformAdministrator';

export interface AssignFirstPlatformAdministratorInput {
  corporateEmail: string;
}

@Injectable()
export class AccessProfilesService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditEventsService: AuditEventsService,
  ) {}

  public async hasActivePlatformAdministratorAssignment(userId: string): Promise<boolean> {
    const assignment = await this.prisma.userProfileAssignment.findFirst({
      where: {
        userId,
        profile: { key: AccessProfileKey.PLATFORM_ADMIN },
      },
      select: { id: true },
    });

    return assignment !== null;
  }

  public async assignFirstPlatformAdministrator(
    input: AssignFirstPlatformAdministratorInput,
  ): Promise<User> {
    const corporateEmail = normalizeCorporateEmail(input.corporateEmail);

    try {
      return await this.assignFirstPlatformAdministratorInTransaction(corporateEmail);
    } catch (error) {
      // PostgreSQL puede devolver P2002 en el upsert simultáneo del perfil antes de que exista una
      // fila que bloquear. Se reintenta una vez: la segunda transacción encuentra y bloquea la fila.
      if (!isAccessProfileKeyUniqueViolation(error)) {
        throw error;
      }
      return this.assignFirstPlatformAdministratorInTransaction(corporateEmail);
    }
  }

  private async assignFirstPlatformAdministratorInTransaction(
    corporateEmail: string,
  ): Promise<User> {
    return this.prisma.$transaction(async (transactionClient) => {
      const profile = await transactionClient.accessProfile.upsert({
        where: { key: AccessProfileKey.PLATFORM_ADMIN },
        create: { key: AccessProfileKey.PLATFORM_ADMIN },
        update: {},
      });
      await transactionClient.$queryRaw(
        Prisma.sql`
          SELECT "id"
          FROM "access_profiles"
          WHERE "id" = ${profile.id}::uuid
          FOR UPDATE
        `,
      );
      const existingAssignment = await transactionClient.userProfileAssignment.findFirst({
        where: { profileId: profile.id },
        select: { id: true },
      });
      if (existingAssignment !== null) {
        throw new FirstPlatformAdministratorAlreadyAssignedError();
      }

      const user = await transactionClient.user.findUnique({ where: { corporateEmail } });
      if (user === null) {
        throw new UserNotFoundError(OPERATION_ASSIGN_FIRST_PLATFORM_ADMINISTRATOR);
      }

      await transactionClient.userProfileAssignment.create({
        data: { userId: user.id, profileId: profile.id },
      });
      await this.auditEventsService.append(transactionClient, {
        eventName: 'access.platform_admin_assigned',
        actor: {
          actorType: AuditActorType.SYSTEM,
          systemActorKey: ASSIGN_PLATFORM_ADMIN_CLI_SYSTEM_ACTOR_KEY,
        },
        target: { targetType: 'user', targetId: user.id },
      });

      return user;
    });
  }
}

function isAccessProfileKeyUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'P2002') {
    return false;
  }
  if ('meta' in error && typeof error.meta === 'object' && error.meta !== null) {
    const target = 'target' in error.meta ? error.meta.target : undefined;
    if (
      (Array.isArray(target) && target.length === 1 && target[0] === 'key') ||
      target === 'key' ||
      target === 'access_profiles_key_key'
    ) {
      return true;
    }
  }
  return (
    error instanceof Error &&
    (error.message.includes('access_profiles_key_key') || error.message.includes('(`key`)'))
  );
}

function normalizeCorporateEmail(corporateEmail: string): string {
  const normalizedCorporateEmail = corporateEmail.trim().toLowerCase();
  if (normalizedCorporateEmail.length === 0) {
    throw new Error('Debe indicarse un correo corporativo.');
  }
  return normalizedCorporateEmail;
}
