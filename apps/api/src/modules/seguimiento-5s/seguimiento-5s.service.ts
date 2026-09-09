import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessProfileStatus,
  AuditActorType,
  FiveSEntryValue,
  FiveSIndicatorStatus,
  UserStatus,
  type FiveSIndicator,
} from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { SEGUIMIENTO_5S_APPLICATION_KEY } from './seguimiento-5s-application-access.guard';
import { FIVE_S_ROLE_KEYS, type FiveSRoleKey } from './dto/participant.dto';

export interface FiveSParticipant {
  userId: string;
  displayName: string;
  corporateEmail: string;
  roleKey: FiveSRoleKey | null;
}

export interface FiveSDailyIndicatorValue {
  indicatorId: string;
  value: FiveSEntryValue | null;
}

export interface FiveSDailyPersonSummary {
  userId: string;
  displayName: string;
  roleKey: FiveSRoleKey | null;
  indicatorValues: FiveSDailyIndicatorValue[];
  points: number;
  evaluated: number;
  notApplicable: number;
  pending: number;
  compliance: number | null;
}

export interface FiveSDailyEntriesResult {
  entryDate: string;
  people: FiveSDailyPersonSummary[];
}

export interface FiveSDashboardDailyPoint {
  entryDate: string;
  compliance: number | null;
}

export interface FiveSDashboardSummary {
  lastLoadedDate: string | null;
  lastLoadedCompliance: number | null;
  controlsPerformed: number;
  markedNotApplicable: number;
  dailySeries: FiveSDashboardDailyPoint[];
}

export interface CreateFiveSIndicatorInput {
  key: string;
  name: string;
  controlledSince: string;
  displayOrder?: number;
  actorUserId: string;
}

export interface UpdateFiveSIndicatorInput {
  indicatorId: string;
  name?: string;
  controlledSince?: string;
  displayOrder?: number;
  actorUserId: string;
}

export interface SetFiveSIndicatorActiveInput {
  indicatorId: string;
  active: boolean;
  actorUserId: string;
}

export interface SaveFiveSDailyEntryItemInput {
  userId: string;
  indicatorId: string;
  value: FiveSEntryValue;
}

export interface SaveFiveSDailyEntriesInput {
  entryDate: string;
  entries: SaveFiveSDailyEntryItemInput[];
  actorUserId: string;
}

export interface SetFiveSParticipantRoleInput {
  userId: string;
  roleKey: FiveSRoleKey;
  actorUserId: string;
}

const INDICATOR_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_DASHBOARD_RANGE_DAYS = 366;

interface PrismaKnownRequestError {
  code?: unknown;
}

@Injectable()
export class Seguimiento5sService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly auditEventsService: AuditEventsService,
  ) {}

  public async listIndicators(includeInactive: boolean): Promise<FiveSIndicator[]> {
    return this.prisma.fiveSIndicator.findMany({
      where: includeInactive ? undefined : { status: FiveSIndicatorStatus.ACTIVE },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  public async createIndicator(input: CreateFiveSIndicatorInput): Promise<FiveSIndicator> {
    const data = {
      key: this.normalizeIndicatorKey(input.key),
      name: this.normalizeIndicatorName(input.name),
      controlledSince: parseIsoDate(input.controlledSince, 'La fecha de control'),
      displayOrder: this.normalizeDisplayOrder(input.displayOrder ?? 0),
    };

    return this.translatePrismaErrors(() =>
      this.prisma.$transaction(async (transactionClient) => {
        const indicator = await transactionClient.fiveSIndicator.create({ data });
        await this.auditEventsService.append(transactionClient, {
          eventName: 'seguimiento-5s.indicator_created',
          actor: { actorType: AuditActorType.USER, actorUserId: input.actorUserId },
          target: { targetType: 'seguimiento_5s_indicator', targetId: indicator.id },
        });
        return indicator;
      }),
    );
  }

  public async updateIndicator(input: UpdateFiveSIndicatorInput): Promise<FiveSIndicator> {
    const hasEditableField = ['name', 'controlledSince', 'displayOrder'].some((field) =>
      Object.hasOwn(input, field),
    );
    if (!hasEditableField) {
      throw new BadRequestException('Se debe indicar al menos un campo editable.');
    }

    const data: { name?: string; controlledSince?: Date; displayOrder?: number } = {};
    if (input.name !== undefined) data.name = this.normalizeIndicatorName(input.name);
    if (input.controlledSince !== undefined) {
      data.controlledSince = parseIsoDate(input.controlledSince, 'La fecha de control');
    }
    if (input.displayOrder !== undefined) {
      data.displayOrder = this.normalizeDisplayOrder(input.displayOrder);
    }

    return this.translatePrismaErrors(() =>
      this.prisma.$transaction(async (transactionClient) => {
        const indicator = await transactionClient.fiveSIndicator.update({
          where: { id: input.indicatorId },
          data,
        });
        await this.auditEventsService.append(transactionClient, {
          eventName: 'seguimiento-5s.indicator_updated',
          actor: { actorType: AuditActorType.USER, actorUserId: input.actorUserId },
          target: { targetType: 'seguimiento_5s_indicator', targetId: indicator.id },
        });
        return indicator;
      }),
    );
  }

  public async setIndicatorActive(input: SetFiveSIndicatorActiveInput): Promise<void> {
    const currentStatus = input.active
      ? FiveSIndicatorStatus.INACTIVE
      : FiveSIndicatorStatus.ACTIVE;
    const requestedStatus = input.active
      ? FiveSIndicatorStatus.ACTIVE
      : FiveSIndicatorStatus.INACTIVE;

    await this.translatePrismaErrors(() =>
      this.prisma.$transaction(async (transactionClient) => {
        const result = await transactionClient.fiveSIndicator.updateMany({
          where: { id: input.indicatorId, status: currentStatus },
          data: {
            status: requestedStatus,
            deactivatedAt: requestedStatus === FiveSIndicatorStatus.INACTIVE ? new Date() : null,
          },
        });
        if (result.count === 0) {
          const indicator = await transactionClient.fiveSIndicator.findUnique({
            where: { id: input.indicatorId },
            select: { status: true },
          });
          if (indicator === null) {
            throw new NotFoundException('No se encontró el indicador solicitado.');
          }
          throw new ConflictException('El indicador ya se encuentra en el estado solicitado.');
        }
        await this.auditEventsService.append(transactionClient, {
          eventName:
            requestedStatus === FiveSIndicatorStatus.ACTIVE
              ? 'seguimiento-5s.indicator_reactivated'
              : 'seguimiento-5s.indicator_deactivated',
          actor: { actorType: AuditActorType.USER, actorUserId: input.actorUserId },
          target: { targetType: 'seguimiento_5s_indicator', targetId: input.indicatorId },
        });
      }),
    );
  }

  public async listParticipants(): Promise<FiveSParticipant[]> {
    const application = await this.requireApplication();
    const assignments = await this.prisma.userApplicationAssignment.findMany({
      where: { applicationId: application.id, user: { status: UserStatus.ACTIVE } },
      include: { user: true },
      orderBy: { user: { corporateEmail: 'asc' } },
    });
    const userIds = assignments.map((assignment) => assignment.userId);
    const roleAssignments = await this.prisma.userProfileAssignment.findMany({
      where: {
        userId: { in: userIds },
        profile: { applicationId: application.id, key: { in: [...FIVE_S_ROLE_KEYS] } },
      },
      include: { profile: true },
    });
    const roleByUserId = new Map(
      roleAssignments.map((assignment) => [
        assignment.userId,
        assignment.profile.key as FiveSRoleKey,
      ]),
    );

    return assignments.map((assignment) => ({
      userId: assignment.userId,
      displayName: assignment.user.displayName ?? assignment.user.corporateEmail,
      corporateEmail: assignment.user.corporateEmail,
      roleKey: roleByUserId.get(assignment.userId) ?? null,
    }));
  }

  public async setParticipantRole(input: SetFiveSParticipantRoleInput): Promise<void> {
    const application = await this.requireApplication();

    await this.prisma.$transaction(async (transactionClient) => {
      const access = await transactionClient.userApplicationAssignment.findUnique({
        where: { userId_applicationId: { userId: input.userId, applicationId: application.id } },
      });
      if (access === null) {
        throw new BadRequestException('El usuario debe tener asignada la aplicación.');
      }

      const targetProfile = await transactionClient.accessProfile.findUnique({
        where: { applicationId_key: { applicationId: application.id, key: input.roleKey } },
      });
      if (targetProfile?.status !== AccessProfileStatus.ACTIVE) {
        throw new Error(`No se encontró el perfil activo "${input.roleKey}" de Seguimiento 5S.`);
      }

      const existingAssignments = await transactionClient.userProfileAssignment.findMany({
        where: {
          userId: input.userId,
          profile: { applicationId: application.id, key: { in: [...FIVE_S_ROLE_KEYS] } },
        },
      });
      const alreadyHasTargetRole = existingAssignments.some(
        (assignment) => assignment.profileId === targetProfile.id,
      );

      for (const assignment of existingAssignments) {
        if (assignment.profileId === targetProfile.id) continue;
        await transactionClient.userProfileAssignment.delete({ where: { id: assignment.id } });
        await this.auditEventsService.append(transactionClient, {
          eventName: 'access.user_application_profile_unassigned',
          actor: { actorType: AuditActorType.USER, actorUserId: input.actorUserId },
          target: { targetType: 'user', targetId: input.userId },
          metadata: { profileId: assignment.profileId },
        });
      }

      if (!alreadyHasTargetRole) {
        await transactionClient.userProfileAssignment.create({
          data: { userId: input.userId, profileId: targetProfile.id },
        });
        await this.auditEventsService.append(transactionClient, {
          eventName: 'access.user_application_profile_assigned',
          actor: { actorType: AuditActorType.USER, actorUserId: input.actorUserId },
          target: { targetType: 'user', targetId: input.userId },
          metadata: { profileId: targetProfile.id },
        });
      }
    });
  }

  public async getDailyEntries(entryDateInput: string): Promise<FiveSDailyEntriesResult> {
    const entryDate = parseIsoDate(entryDateInput, 'La fecha');
    const [participants, indicators, entries] = await Promise.all([
      this.listParticipants(),
      this.prisma.fiveSIndicator.findMany({
        where: { status: FiveSIndicatorStatus.ACTIVE, controlledSince: { lte: entryDate } },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.fiveSDailyEntry.findMany({ where: { entryDate } }),
    ]);

    const entryByKey = new Map(
      entries.map((entry) => [`${entry.userId}:${entry.indicatorId}`, entry]),
    );

    const people = participants.map((participant) => {
      let points = 0;
      let evaluated = 0;
      let notApplicable = 0;
      const indicatorValues = indicators.map((indicator) => {
        const entry = entryByKey.get(`${participant.userId}:${indicator.id}`);
        const value = entry?.value ?? null;
        if (value === FiveSEntryValue.MET) {
          points += 1;
          evaluated += 1;
        } else if (value === FiveSEntryValue.NOT_MET) {
          evaluated += 1;
        } else if (value === FiveSEntryValue.NOT_APPLICABLE) {
          notApplicable += 1;
        }
        return { indicatorId: indicator.id, value };
      });

      return {
        userId: participant.userId,
        displayName: participant.displayName,
        roleKey: participant.roleKey,
        indicatorValues,
        points,
        evaluated,
        notApplicable,
        pending: indicators.length - evaluated - notApplicable,
        compliance: evaluated === 0 ? null : points / evaluated,
      };
    });

    return { entryDate: formatIsoDate(entryDate), people };
  }

  public async saveDailyEntries(
    input: SaveFiveSDailyEntriesInput,
  ): Promise<FiveSDailyEntriesResult> {
    const entryDate = parseIsoDate(input.entryDate, 'La fecha');
    if (input.entries.length === 0) {
      throw new BadRequestException('Se debe indicar al menos un registro.');
    }

    const application = await this.requireApplication();
    const [assignedUsers, indicators] = await Promise.all([
      this.prisma.userApplicationAssignment.findMany({
        where: { applicationId: application.id },
        select: { userId: true },
      }),
      this.prisma.fiveSIndicator.findMany({
        where: { status: FiveSIndicatorStatus.ACTIVE, controlledSince: { lte: entryDate } },
        select: { id: true },
      }),
    ]);
    const assignedUserIds = new Set(assignedUsers.map((assignment) => assignment.userId));
    const indicatorIds = new Set(indicators.map((indicator) => indicator.id));

    for (const item of input.entries) {
      if (!assignedUserIds.has(item.userId)) {
        throw new BadRequestException('Todas las personas deben tener asignada la aplicación.');
      }
      if (!indicatorIds.has(item.indicatorId)) {
        throw new BadRequestException(
          'Todos los indicadores deben estar activos y controlados desde esa fecha.',
        );
      }
    }

    await this.translatePrismaErrors(() =>
      this.prisma.$transaction((transactionClient) =>
        Promise.all(
          input.entries.map((item) =>
            transactionClient.fiveSDailyEntry.upsert({
              where: {
                entryDate_userId_indicatorId: {
                  entryDate,
                  userId: item.userId,
                  indicatorId: item.indicatorId,
                },
              },
              create: {
                entryDate,
                userId: item.userId,
                indicatorId: item.indicatorId,
                value: item.value,
                recordedByUserId: input.actorUserId,
              },
              update: { value: item.value, recordedByUserId: input.actorUserId },
            }),
          ),
        ),
      ),
    );

    return this.getDailyEntries(input.entryDate);
  }

  public async getDashboardSummary(input: {
    from: string;
    to: string;
  }): Promise<FiveSDashboardSummary> {
    const from = parseIsoDate(input.from, 'La fecha de inicio');
    const to = parseIsoDate(input.to, 'La fecha de fin');
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('La fecha de inicio debe ser anterior o igual a la de fin.');
    }
    const rangeDays = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (rangeDays > MAX_DASHBOARD_RANGE_DAYS) {
      throw new BadRequestException(
        `El rango del dashboard no puede superar ${String(MAX_DASHBOARD_RANGE_DAYS)} días.`,
      );
    }

    const [rangeRows, lastLoadedDateRow] = await Promise.all([
      this.prisma.fiveSDailyEntry.groupBy({
        by: ['entryDate', 'value'],
        where: { entryDate: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      this.prisma.fiveSDailyEntry.aggregate({ _max: { entryDate: true } }),
    ]);

    const totalsByDate = new Map<string, { points: number; evaluated: number }>();
    for (const row of rangeRows) {
      const dateKey = formatIsoDate(row.entryDate);
      const totals = totalsByDate.get(dateKey) ?? { points: 0, evaluated: 0 };
      accumulateEntryValue(totals, row.value, row._count._all);
      totalsByDate.set(dateKey, totals);
    }

    const dailySeries: FiveSDashboardDailyPoint[] = [];
    for (
      const cursor = new Date(from);
      cursor.getTime() <= to.getTime();
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const dateKey = formatIsoDate(cursor);
      const totals = totalsByDate.get(dateKey);
      dailySeries.push({
        entryDate: dateKey,
        compliance:
          totals === undefined || totals.evaluated === 0 ? null : totals.points / totals.evaluated,
      });
    }

    const lastLoadedDate = lastLoadedDateRow._max.entryDate;
    if (lastLoadedDate === null) {
      return {
        lastLoadedDate: null,
        lastLoadedCompliance: null,
        controlsPerformed: 0,
        markedNotApplicable: 0,
        dailySeries,
      };
    }

    const lastDayRows = await this.prisma.fiveSDailyEntry.groupBy({
      by: ['value'],
      where: { entryDate: lastLoadedDate },
      _count: { _all: true },
    });
    const lastDayTotals = { points: 0, evaluated: 0, notApplicable: 0 };
    for (const row of lastDayRows) {
      accumulateEntryValue(lastDayTotals, row.value, row._count._all);
    }

    return {
      lastLoadedDate: formatIsoDate(lastLoadedDate),
      lastLoadedCompliance:
        lastDayTotals.evaluated === 0 ? null : lastDayTotals.points / lastDayTotals.evaluated,
      controlsPerformed: lastDayTotals.evaluated,
      markedNotApplicable: lastDayTotals.notApplicable,
      dailySeries,
    };
  }

  private async requireApplication(): Promise<{ id: string }> {
    const application = await this.prisma.application.findUnique({
      where: { key: SEGUIMIENTO_5S_APPLICATION_KEY },
      select: { id: true },
    });
    if (application === null) {
      throw new Error('No se encontró la aplicación Seguimiento 5S en el catálogo.');
    }
    return application;
  }

  private normalizeIndicatorKey(key: string): string {
    if (typeof key !== 'string') throw new BadRequestException('La clave debe ser texto.');
    const normalized = key.trim().toLowerCase();
    if (!INDICATOR_KEY_PATTERN.test(normalized) || normalized.length > 64) {
      throw new BadRequestException('La clave debe usar minúsculas, números y guiones simples.');
    }
    return normalized;
  }

  private normalizeIndicatorName(name: string): string {
    if (typeof name !== 'string') throw new BadRequestException('El nombre debe ser texto.');
    const normalized = name.trim();
    if (normalized.length === 0 || normalized.length > 120) {
      throw new BadRequestException('El nombre debe contener entre 1 y 120 caracteres.');
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
        throw new ConflictException('Ya existe un indicador con esa clave.', { cause: error });
      }
      if (this.isPrismaKnownRequestError(error) && error.code === 'P2025') {
        throw new NotFoundException('No se encontró el indicador solicitado.', { cause: error });
      }
      throw error;
    }
  }

  private isPrismaKnownRequestError(error: unknown): error is PrismaKnownRequestError {
    return typeof error === 'object' && error !== null && 'code' in error;
  }
}

function accumulateEntryValue(
  totals: { points: number; evaluated: number; notApplicable?: number },
  value: FiveSEntryValue,
  count: number,
): void {
  if (value === FiveSEntryValue.MET) {
    totals.points += count;
    totals.evaluated += count;
  } else if (value === FiveSEntryValue.NOT_MET) {
    totals.evaluated += count;
  } else if (totals.notApplicable !== undefined) {
    totals.notApplicable += count;
  }
}

function parseIsoDate(value: string, fieldLabel: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${fieldLabel} debe tener el formato AAAA-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${fieldLabel} no es una fecha válida.`);
  }
  return date;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
