import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessProfileScope,
  AccessProfileStatus,
  AuditActorType,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';

export type BulkApplicationAccessResult =
  | { userId: string; status: 'ASSIGNED' | 'UNASSIGNED' }
  | { userId: string; status: 'FAILED'; message: string };

@Injectable()
export class ApplicationAccessService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditEventsService,
  ) {}

  public async assignApplication(
    actorUserId: string,
    userId: string,
    applicationId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.requireActiveUserAndApplication(tx, userId, applicationId);
      try {
        await tx.userApplicationAssignment.create({ data: { userId, applicationId } });
      } catch (error) {
        if (isUnique(error))
          throw new ConflictException('El usuario ya tiene asignada la aplicación.');
        throw error;
      }
      await this.audit.append(tx, {
        eventName: 'access.user_application_assigned',
        actor: { actorType: AuditActorType.USER, actorUserId },
        target: { targetType: 'user', targetId: userId },
        metadata: { applicationId },
      });
    });
  }

  public async unassignApplication(
    actorUserId: string,
    userId: string,
    applicationId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.userApplicationAssignment.findUnique({
        where: { userId_applicationId: { userId, applicationId } },
      });
      if (assignment === null)
        throw new NotFoundException('No se encontró la asignación de aplicación.');
      const profiles = await tx.accessProfile.findMany({
        where: { scope: AccessProfileScope.APPLICATION, applicationId },
        select: { id: true },
      });
      await tx.userProfileAssignment.deleteMany({
        where: { userId, profileId: { in: profiles.map((profile) => profile.id) } },
      });
      await tx.userApplicationAssignment.delete({ where: { id: assignment.id } });
      await this.audit.append(tx, {
        eventName: 'access.user_application_unassigned',
        actor: { actorType: AuditActorType.USER, actorUserId },
        target: { targetType: 'user', targetId: userId },
        metadata: { applicationId },
      });
    });
  }

  public async assignApplicationToUsers(
    actorUserId: string,
    applicationId: string,
    userIds: string[],
  ): Promise<BulkApplicationAccessResult[]> {
    const results: BulkApplicationAccessResult[] = [];
    for (const userId of userIds) {
      try {
        await this.assignApplication(actorUserId, userId, applicationId);
        results.push({ userId, status: 'ASSIGNED' });
      } catch (error) {
        results.push({ userId, status: 'FAILED', message: bulkErrorMessage(error) });
      }
    }
    return results;
  }

  public async unassignApplicationFromUsers(
    actorUserId: string,
    applicationId: string,
    userIds: string[],
  ): Promise<BulkApplicationAccessResult[]> {
    const results: BulkApplicationAccessResult[] = [];
    for (const userId of userIds) {
      try {
        await this.unassignApplication(actorUserId, userId, applicationId);
        results.push({ userId, status: 'UNASSIGNED' });
      } catch (error) {
        results.push({ userId, status: 'FAILED', message: bulkErrorMessage(error) });
      }
    }
    return results;
  }

  public async listPermissions(applicationId: string) {
    return this.prisma.applicationPermission.findMany({
      where: { applicationId },
      orderBy: { name: 'asc' },
    });
  }
  public async listUserApplicationAccesses(
    userId: string,
  ): Promise<{ applicationId: string; assignedAt: Date; profileIds: string[] }[]> {
    const assignments = await this.prisma.userApplicationAssignment.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(
      assignments.map(async (assignment) => ({
        applicationId: assignment.applicationId,
        assignedAt: assignment.createdAt,
        profileIds: (
          await this.prisma.userProfileAssignment.findMany({
            where: {
              userId,
              profile: {
                scope: AccessProfileScope.APPLICATION,
                applicationId: assignment.applicationId,
              },
            },
            select: { profileId: true },
          })
        ).map((profile) => profile.profileId),
      })),
    );
  }
  public async listProfiles(applicationId: string) {
    return this.prisma.accessProfile.findMany({
      where: { applicationId, scope: AccessProfileScope.APPLICATION },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  public async createProfile(
    actorUserId: string,
    input: { applicationId: string; key: string; name: string; description?: string | null },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const application = await this.requireApplication(tx, input.applicationId);
        if (application.status !== 'ACTIVE')
          throw new BadRequestException('La aplicación debe estar activa.');
        const profile = await tx.accessProfile.create({
          data: {
            applicationId: input.applicationId,
            key: normalizeKey(input.key),
            name: normalizeName(input.name),
            description: normalizeDescription(input.description),
            scope: AccessProfileScope.APPLICATION,
          },
        });
        await this.audit.append(tx, {
          eventName: 'access.application_profile_created',
          actor: { actorType: AuditActorType.USER, actorUserId },
          target: { targetType: 'application', targetId: input.applicationId },
          metadata: { profileId: profile.id },
        });
        return profile;
      });
    } catch (error) {
      if (isUnique(error))
        throw new ConflictException('Ya existe un perfil con esa clave para la aplicación.');
      throw error;
    }
  }
  public async updateProfile(
    actorUserId: string,
    profileId: string,
    input: { name?: string; description?: string | null },
  ) {
    if (input.name === undefined && !Object.hasOwn(input, 'description'))
      throw new BadRequestException('Se debe indicar al menos un campo editable.');
    return this.prisma.$transaction(async (tx) => {
      const profile = await this.requireApplicationProfile(tx, profileId);
      const updated = await tx.accessProfile.update({
        where: { id: profileId },
        data: {
          ...(input.name === undefined ? {} : { name: normalizeName(input.name) }),
          ...(Object.hasOwn(input, 'description')
            ? { description: normalizeDescription(input.description) }
            : {}),
        },
        include: { permissions: { select: { permissionId: true } } },
      });
      await this.audit.append(tx, {
        eventName: 'access.application_profile_updated',
        actor: { actorType: AuditActorType.USER, actorUserId },
        target: { targetType: 'application', targetId: profile.applicationId },
        metadata: { profileId },
      });
      return updated;
    });
  }
  public async setProfileStatus(
    actorUserId: string,
    profileId: string,
    active: boolean,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const profile = await this.requireApplicationProfile(tx, profileId);
      if ((profile.status === AccessProfileStatus.ACTIVE) !== active) {
        await tx.accessProfile.update({
          where: { id: profileId },
          data: {
            status: active ? AccessProfileStatus.ACTIVE : AccessProfileStatus.INACTIVE,
            deactivatedAt: active ? null : new Date(),
          },
        });
      } else throw new ConflictException('El perfil ya se encuentra en el estado solicitado.');
      await this.audit.append(tx, {
        eventName: active
          ? 'access.application_profile_reactivated'
          : 'access.application_profile_deactivated',
        actor: { actorType: AuditActorType.USER, actorUserId },
        target: { targetType: 'application', targetId: profile.applicationId },
        metadata: { profileId },
      });
    });
  }
  public async addPermission(
    actorUserId: string,
    profileId: string,
    permissionId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const profile = await this.requireApplicationProfile(tx, profileId);
      if (profile.status !== AccessProfileStatus.ACTIVE)
        throw new BadRequestException('El perfil debe estar activo.');
      const permission = await tx.applicationPermission.findUnique({ where: { id: permissionId } });
      if (permission?.applicationId !== profile.applicationId || permission.status !== 'ACTIVE')
        throw new BadRequestException('El permiso debe pertenecer a la misma aplicación.');
      try {
        await tx.accessProfilePermission.create({ data: { profileId, permissionId } });
      } catch (error) {
        if (isUnique(error)) throw new ConflictException('El permiso ya está asociado al perfil.');
        throw error;
      }
      await this.audit.append(tx, {
        eventName: 'access.application_profile_permission_added',
        actor: { actorType: AuditActorType.USER, actorUserId },
        target: { targetType: 'application', targetId: profile.applicationId },
        metadata: { profileId, permissionId },
      });
    });
  }
  public async removePermission(
    actorUserId: string,
    profileId: string,
    permissionId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const profile = await this.requireApplicationProfile(tx, profileId);
      if (profile.status !== AccessProfileStatus.ACTIVE)
        throw new BadRequestException('El perfil debe estar activo.');
      const result = await tx.accessProfilePermission.deleteMany({
        where: { profileId, permissionId },
      });
      if (result.count === 0)
        throw new NotFoundException('No se encontró la asociación de permiso.');
      await this.audit.append(tx, {
        eventName: 'access.application_profile_permission_removed',
        actor: { actorType: AuditActorType.USER, actorUserId },
        target: { targetType: 'application', targetId: profile.applicationId },
        metadata: { profileId, permissionId },
      });
    });
  }
  public async assignProfile(
    actorUserId: string,
    userId: string,
    profileId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const profile = await this.requireApplicationProfile(tx, profileId);
      if (profile.status !== AccessProfileStatus.ACTIVE)
        throw new BadRequestException('El perfil debe estar activo.');
      await this.requireActiveUserAndApplication(tx, userId, profile.applicationId);
      const access = await tx.userApplicationAssignment.findUnique({
        where: { userId_applicationId: { userId, applicationId: profile.applicationId } },
      });
      if (access === null)
        throw new BadRequestException('El usuario debe tener asignada la aplicación.');
      try {
        await tx.userProfileAssignment.create({ data: { userId, profileId } });
      } catch (error) {
        if (isUnique(error)) throw new ConflictException('El perfil ya está asignado al usuario.');
        throw error;
      }
      await this.audit.append(tx, {
        eventName: 'access.user_application_profile_assigned',
        actor: { actorType: AuditActorType.USER, actorUserId },
        target: { targetType: 'user', targetId: userId },
        metadata: { profileId },
      });
    });
  }
  public async unassignProfile(
    actorUserId: string,
    userId: string,
    profileId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.requireApplicationProfile(tx, profileId);
      const result = await tx.userProfileAssignment.deleteMany({ where: { userId, profileId } });
      if (result.count === 0)
        throw new NotFoundException('No se encontró la asignación de perfil.');
      await this.audit.append(tx, {
        eventName: 'access.user_application_profile_unassigned',
        actor: { actorType: AuditActorType.USER, actorUserId },
        target: { targetType: 'user', targetId: userId },
        metadata: { profileId },
      });
    });
  }
  private async requireApplication(tx: Prisma.TransactionClient, applicationId: string) {
    const application = await tx.application.findUnique({ where: { id: applicationId } });
    if (application === null)
      throw new NotFoundException('No se encontró la aplicación solicitada.');
    return application;
  }
  private async requireActiveUserAndApplication(
    tx: Prisma.TransactionClient,
    userId: string,
    applicationId: string,
  ) {
    const [user, application] = await Promise.all([
      tx.user.findUnique({ where: { id: userId } }),
      this.requireApplication(tx, applicationId),
    ]);
    if (user === null) throw new NotFoundException('No se encontró el usuario solicitado.');
    if (user.status !== 'ACTIVE' || application.status !== 'ACTIVE')
      throw new BadRequestException('El usuario y la aplicación deben estar activos.');
  }
  private async requireApplicationProfile(
    tx: Prisma.TransactionClient,
    profileId: string,
  ): Promise<{ id: string; applicationId: string; status: AccessProfileStatus }> {
    const profile = await tx.accessProfile.findUnique({ where: { id: profileId } });
    if (profile?.scope !== AccessProfileScope.APPLICATION || profile.applicationId === null)
      throw new NotFoundException('No se encontró el perfil funcional solicitado.');
    return { id: profile.id, applicationId: profile.applicationId, status: profile.status };
  }
}
function normalizeKey(value: string): string {
  const key = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(key) || key.length > 64)
    throw new BadRequestException('La clave debe usar minúsculas, números y guiones simples.');
  return key;
}
function normalizeName(value: string): string {
  const name = value.trim();
  if (name.length === 0 || name.length > 120)
    throw new BadRequestException('El nombre debe contener entre 1 y 120 caracteres.');
  return name;
}
function normalizeDescription(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const description = value.trim();
  if (description.length > 500)
    throw new BadRequestException('La descripción no puede superar 500 caracteres.');
  return description || null;
}
function isUnique(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
function bulkErrorMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if ('message' in response && typeof response.message === 'string') return response.message;
  }
  return 'No se pudo completar la operación.';
}
