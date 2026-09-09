import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  AuditActorType,
  Prisma,
  UserStatus,
  type Application,
} from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';

export type AdministrativeApplication = Application;
export type AuthorizedApplication = Pick<
  Application,
  'key' | 'name' | 'description' | 'launchPath' | 'displayOrder'
>;

export interface CreateAdministrativeApplicationInput {
  key: string;
  name: string;
  description?: string | null;
  launchPath: string;
  displayOrder: number;
  actorUserId: string;
}

export interface UpdateAdministrativeApplicationInput {
  applicationId: string;
  name?: string;
  description?: string | null;
  launchPath?: string;
  displayOrder?: number;
  actorUserId: string;
}

export interface ChangeApplicationStatusInput {
  applicationId: string;
  actorUserId: string;
}

interface PrismaKnownRequestError {
  code?: unknown;
}

const APPLICATION_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INTERNAL_APPLICATION_PATH_PATTERN =
  /^\/apps\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

@Injectable()
export class ApplicationsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditEventsService: AuditEventsService,
  ) {}

  public async listAdministrativeApplications(): Promise<AdministrativeApplication[]> {
    return this.prisma.application.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  public async listAuthorizedApplications(userId: string): Promise<AuthorizedApplication[]> {
    return this.prisma.application.findMany({
      where: {
        status: ApplicationStatus.ACTIVE,
        userAssignments: {
          some: {
            userId,
            user: { status: UserStatus.ACTIVE },
          },
        },
      },
      select: {
        key: true,
        name: true,
        description: true,
        launchPath: true,
        displayOrder: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  public async createAdministrativeApplication(
    input: CreateAdministrativeApplicationInput,
  ): Promise<AdministrativeApplication> {
    const data = {
      key: this.normalizeKey(input.key),
      name: this.normalizeName(input.name),
      description: this.normalizeDescription(input.description),
      launchPath: this.normalizeLaunchPath(input.launchPath),
      displayOrder: this.normalizeDisplayOrder(input.displayOrder),
    };

    return this.translatePrismaErrors(() =>
      this.prisma.$transaction(async (transactionClient) => {
        const application = await transactionClient.application.create({ data });
        await this.auditEventsService.append(transactionClient, {
          eventName: 'access.application_created',
          actor: { actorType: AuditActorType.USER, actorUserId: input.actorUserId },
          target: { targetType: 'application', targetId: application.id },
        });
        return application;
      }),
    );
  }

  public async updateAdministrativeApplication(
    input: UpdateAdministrativeApplicationInput,
  ): Promise<AdministrativeApplication> {
    const hasEditableField = ['name', 'description', 'launchPath', 'displayOrder'].some((field) =>
      Object.hasOwn(input, field),
    );
    if (!hasEditableField) {
      throw new BadRequestException('Se debe indicar al menos un campo editable.');
    }

    const data: Prisma.ApplicationUpdateInput = {};
    if (input.name !== undefined) data.name = this.normalizeName(input.name);
    if (Object.hasOwn(input, 'description')) {
      data.description = this.normalizeDescription(input.description);
    }
    if (input.launchPath !== undefined) {
      data.launchPath = this.normalizeLaunchPath(input.launchPath);
    }
    if (input.displayOrder !== undefined) {
      data.displayOrder = this.normalizeDisplayOrder(input.displayOrder);
    }

    return this.translatePrismaErrors(() =>
      this.prisma.$transaction(async (transactionClient) => {
        const application = await transactionClient.application.update({
          where: { id: input.applicationId },
          data,
        });
        await this.auditEventsService.append(transactionClient, {
          eventName: 'access.application_updated',
          actor: { actorType: AuditActorType.USER, actorUserId: input.actorUserId },
          target: { targetType: 'application', targetId: application.id },
        });
        return application;
      }),
    );
  }

  public async deactivateAdministrativeApplication(
    input: ChangeApplicationStatusInput,
  ): Promise<void> {
    await this.changeStatus(input, ApplicationStatus.ACTIVE, ApplicationStatus.INACTIVE);
  }

  public async reactivateAdministrativeApplication(
    input: ChangeApplicationStatusInput,
  ): Promise<void> {
    await this.changeStatus(input, ApplicationStatus.INACTIVE, ApplicationStatus.ACTIVE);
  }

  private async changeStatus(
    input: ChangeApplicationStatusInput,
    currentStatus: ApplicationStatus,
    requestedStatus: ApplicationStatus,
  ): Promise<void> {
    await this.translatePrismaErrors(() =>
      this.prisma.$transaction(async (transactionClient) => {
        const result = await transactionClient.application.updateMany({
          where: { id: input.applicationId, status: currentStatus },
          data: {
            status: requestedStatus,
            deactivatedAt: requestedStatus === ApplicationStatus.INACTIVE ? new Date() : null,
          },
        });
        if (result.count === 0) {
          const application = await transactionClient.application.findUnique({
            where: { id: input.applicationId },
            select: { status: true },
          });
          if (application === null) {
            throw new NotFoundException('No se encontró la aplicación solicitada.');
          }
          throw new ConflictException('La aplicación ya se encuentra en el estado solicitado.');
        }
        await this.auditEventsService.append(transactionClient, {
          eventName:
            requestedStatus === ApplicationStatus.ACTIVE
              ? 'access.application_reactivated'
              : 'access.application_deactivated',
          actor: { actorType: AuditActorType.USER, actorUserId: input.actorUserId },
          target: { targetType: 'application', targetId: input.applicationId },
        });
      }),
    );
  }

  private normalizeKey(key: string): string {
    if (typeof key !== 'string') throw new BadRequestException('La clave debe ser texto.');
    const normalized = key.trim().toLowerCase();
    if (!APPLICATION_KEY_PATTERN.test(normalized) || normalized.length > 64) {
      throw new BadRequestException('La clave debe usar minúsculas, números y guiones simples.');
    }
    return normalized;
  }

  private normalizeName(name: string): string {
    if (typeof name !== 'string') throw new BadRequestException('El nombre debe ser texto.');
    const normalized = name.trim();
    if (normalized.length === 0 || normalized.length > 120) {
      throw new BadRequestException('El nombre debe contener entre 1 y 120 caracteres.');
    }
    return normalized;
  }

  private normalizeDescription(description: string | null | undefined): string | null {
    if (description === undefined || description === null) return null;
    if (typeof description !== 'string') {
      throw new BadRequestException('La descripción debe ser texto o null.');
    }
    const normalized = description.trim();
    if (normalized.length === 0) return null;
    if (normalized.length > 500) {
      throw new BadRequestException('La descripción no puede superar 500 caracteres.');
    }
    return normalized;
  }

  private normalizeLaunchPath(launchPath: string): string {
    if (typeof launchPath !== 'string') throw new BadRequestException('La ruta debe ser texto.');
    const normalized = launchPath.trim();
    if (!INTERNAL_APPLICATION_PATH_PATTERN.test(normalized) || normalized.length > 200) {
      throw new BadRequestException('La ruta debe ser interna y comenzar con /apps/.');
    }
    return normalized;
  }

  private normalizeDisplayOrder(displayOrder: number): number {
    if (!Number.isSafeInteger(displayOrder) || displayOrder < 0) {
      throw new BadRequestException('El orden debe ser un número entero mayor o igual a cero.');
    }
    return displayOrder;
  }

  private async translatePrismaErrors<T>(execute: () => Promise<T>): Promise<T> {
    try {
      return await execute();
    } catch (error) {
      if (this.isPrismaKnownRequestError(error) && error.code === 'P2002') {
        throw new ConflictException('Ya existe una aplicación con esa clave o ruta.', {
          cause: error,
        });
      }
      if (this.isPrismaKnownRequestError(error) && error.code === 'P2025') {
        throw new NotFoundException('No se encontró la aplicación solicitada.', { cause: error });
      }
      throw error;
    }
  }

  private isPrismaKnownRequestError(error: unknown): error is PrismaKnownRequestError {
    return typeof error === 'object' && error !== null && 'code' in error;
  }
}
