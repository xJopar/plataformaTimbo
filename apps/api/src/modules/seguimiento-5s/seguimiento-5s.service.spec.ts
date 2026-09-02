import { BadRequestException } from '@nestjs/common';
import {
  AccessProfileStatus,
  FiveSEntryValue,
  FiveSIndicatorStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { Seguimiento5sService } from './seguimiento-5s.service';

const APPLICATION_ID = 'a1a1a1a1-0000-0000-0000-000000000001';

describe('Seguimiento5sService', () => {
  const transactionClient = {
    fiveSIndicator: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    userApplicationAssignment: { findUnique: jest.fn() },
    accessProfile: { findUnique: jest.fn() },
    userProfileAssignment: { findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
    fiveSDailyEntry: { upsert: jest.fn() },
  };
  const prisma = {
    application: { findUnique: jest.fn() },
    fiveSIndicator: { findMany: jest.fn(), findUnique: jest.fn() },
    fiveSDailyEntry: { findMany: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn() },
    userApplicationAssignment: { findMany: jest.fn() },
    userProfileAssignment: { findMany: jest.fn() },
    $transaction: jest.fn(async (execute: (client: typeof transactionClient) => Promise<unknown>) =>
      execute(transactionClient),
    ),
  };
  const auditEventsService = { append: jest.fn() };
  const service = new Seguimiento5sService(
    prisma as unknown as PrismaService,
    auditEventsService as unknown as AuditEventsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.application.findUnique.mockResolvedValue({ id: APPLICATION_ID });
  });

  describe('createIndicator', () => {
    it('rechaza una clave que no sea kebab-case', async () => {
      await expect(
        service.createIndicator({
          key: 'Orden De Cables',
          name: 'Orden de cables',
          controlledSince: '2026-08-17',
          actorUserId: 'user-lider',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea el indicador y audita su creación en la misma transacción', async () => {
      const indicator = {
        id: 'indicator-1',
        key: 'orden-de-cables',
        name: 'Orden de cables',
        controlledSince: new Date('2026-08-17T00:00:00.000Z'),
        displayOrder: 0,
        status: FiveSIndicatorStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deactivatedAt: null,
      };
      transactionClient.fiveSIndicator.create.mockResolvedValue(indicator);

      await expect(
        service.createIndicator({
          key: 'orden-de-cables',
          name: 'Orden de cables',
          controlledSince: '2026-08-17',
          actorUserId: 'user-lider',
        }),
      ).resolves.toEqual(indicator);

      expect(auditEventsService.append).toHaveBeenCalledWith(
        transactionClient,
        expect.objectContaining({
          eventName: 'seguimiento-5s.indicator_created',
          target: { targetType: 'seguimiento_5s_indicator', targetId: indicator.id },
        }),
      );
    });
  });

  describe('getDailyEntries', () => {
    it('calcula puntos, evaluados, N/A, pendientes y cumplimiento por persona', async () => {
      prisma.userApplicationAssignment.findMany.mockResolvedValue([
        {
          userId: 'user-david',
          user: { displayName: 'David Villalba', corporateEmail: 'david@timbo.com' },
        },
      ]);
      prisma.userProfileAssignment.findMany.mockResolvedValue([]);
      prisma.fiveSIndicator.findMany.mockResolvedValue([
        { id: 'ind-participacion' },
        { id: 'ind-cables' },
        { id: 'ind-mesa' },
        { id: 'ind-tapete' },
        { id: 'ind-mochila' },
        { id: 'ind-notebook' },
      ]);
      // Mismo escenario que la fila de David Villalba del 17-ago en el Excel original:
      // 1 punto, 2 evaluados (1 cumple + 1 no cumple), 4 N/A, 0 pendientes, 50% de cumplimiento.
      prisma.fiveSDailyEntry.findMany.mockResolvedValue([
        { userId: 'user-david', indicatorId: 'ind-cables', value: FiveSEntryValue.NOT_MET },
        { userId: 'user-david', indicatorId: 'ind-mesa', value: FiveSEntryValue.MET },
        {
          userId: 'user-david',
          indicatorId: 'ind-participacion',
          value: FiveSEntryValue.NOT_APPLICABLE,
        },
        { userId: 'user-david', indicatorId: 'ind-tapete', value: FiveSEntryValue.NOT_APPLICABLE },
        { userId: 'user-david', indicatorId: 'ind-mochila', value: FiveSEntryValue.NOT_APPLICABLE },
        {
          userId: 'user-david',
          indicatorId: 'ind-notebook',
          value: FiveSEntryValue.NOT_APPLICABLE,
        },
      ]);

      const result = await service.getDailyEntries('2026-08-17');

      expect(result.people).toEqual([
        expect.objectContaining({
          userId: 'user-david',
          points: 1,
          evaluated: 2,
          notApplicable: 4,
          pending: 0,
          compliance: 0.5,
        }),
      ]);
    });

    it('deja pendiente un indicador sin fila registrada ese día', async () => {
      prisma.userApplicationAssignment.findMany.mockResolvedValue([
        { userId: 'user-a', user: { displayName: 'Persona A', corporateEmail: 'a@timbo.com' } },
      ]);
      prisma.userProfileAssignment.findMany.mockResolvedValue([]);
      prisma.fiveSIndicator.findMany.mockResolvedValue([{ id: 'ind-1' }]);
      prisma.fiveSDailyEntry.findMany.mockResolvedValue([]);

      const result = await service.getDailyEntries('2026-08-17');

      expect(result.people[0]).toEqual(
        expect.objectContaining({
          points: 0,
          evaluated: 0,
          notApplicable: 0,
          pending: 1,
          compliance: null,
        }),
      );
      expect(result.people[0]?.indicatorValues).toEqual([{ indicatorId: 'ind-1', value: null }]);
    });
  });

  describe('saveDailyEntries', () => {
    it('rechaza un registro de una persona sin la aplicación asignada', async () => {
      prisma.userApplicationAssignment.findMany.mockResolvedValue([]);
      prisma.fiveSIndicator.findMany.mockResolvedValue([{ id: 'ind-1' }]);

      await expect(
        service.saveDailyEntries({
          entryDate: '2026-08-17',
          entries: [
            { userId: 'user-sin-acceso', indicatorId: 'ind-1', value: FiveSEntryValue.MET },
          ],
          actorUserId: 'user-lider',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza un indicador todavía no controlado en esa fecha', async () => {
      prisma.userApplicationAssignment.findMany.mockResolvedValue([{ userId: 'user-a' }]);
      prisma.fiveSIndicator.findMany.mockResolvedValue([]);

      await expect(
        service.saveDailyEntries({
          entryDate: '2026-08-17',
          entries: [{ userId: 'user-a', indicatorId: 'ind-futuro', value: FiveSEntryValue.MET }],
          actorUserId: 'user-lider',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDashboardSummary', () => {
    it('pondera por controles realizados, no por el promedio simple de porcentajes por persona', async () => {
      // Persona A: 3 de 4 (75%). Persona B: 1 de 6 (16.7%). Promedio simple ≈ 45.8%, pero el
      // ponderado del Excel es ΣPuntos/ΣEvaluados = 4/10 = 40%.
      prisma.fiveSDailyEntry.groupBy.mockImplementation(({ by }: { by: string[] }) => {
        if (by.includes('entryDate')) {
          return Promise.resolve([
            {
              entryDate: new Date('2026-08-17T00:00:00.000Z'),
              value: FiveSEntryValue.MET,
              _count: { _all: 4 },
            },
            {
              entryDate: new Date('2026-08-17T00:00:00.000Z'),
              value: FiveSEntryValue.NOT_MET,
              _count: { _all: 6 },
            },
          ]);
        }
        // Segunda consulta: el mismo agregado, ya filtrado por `entryDate` en el `where` real.
        return Promise.resolve([
          { value: FiveSEntryValue.MET, _count: { _all: 4 } },
          { value: FiveSEntryValue.NOT_MET, _count: { _all: 6 } },
        ]);
      });
      prisma.fiveSDailyEntry.aggregate.mockResolvedValue({
        _max: { entryDate: new Date('2026-08-17T00:00:00.000Z') },
      });

      const summary = await service.getDashboardSummary({ from: '2026-08-17', to: '2026-08-17' });

      expect(summary.dailySeries).toEqual([{ entryDate: '2026-08-17', compliance: 0.4 }]);
      expect(summary.lastLoadedCompliance).toBe(0.4);
      expect(summary.controlsPerformed).toBe(10);
    });

    it('devuelve valores vacíos cuando todavía no hay ningún registro', async () => {
      prisma.fiveSDailyEntry.groupBy.mockResolvedValue([]);
      prisma.fiveSDailyEntry.aggregate.mockResolvedValue({ _max: { entryDate: null } });

      const summary = await service.getDashboardSummary({ from: '2026-08-17', to: '2026-08-18' });

      expect(summary.lastLoadedDate).toBeNull();
      expect(summary.dailySeries).toEqual([
        { entryDate: '2026-08-17', compliance: null },
        { entryDate: '2026-08-18', compliance: null },
      ]);
    });

    it('rechaza un rango con la fecha de inicio posterior a la de fin', async () => {
      await expect(
        service.getDashboardSummary({ from: '2026-08-20', to: '2026-08-17' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setParticipantRole', () => {
    it('reemplaza el rol anterior por el nuevo dentro de una única transacción auditada', async () => {
      transactionClient.userApplicationAssignment.findUnique.mockResolvedValue({ id: 'access-1' });
      transactionClient.accessProfile.findUnique.mockResolvedValue({
        id: 'profile-lider',
        status: AccessProfileStatus.ACTIVE,
      });
      transactionClient.userProfileAssignment.findMany.mockResolvedValue([
        { id: 'assignment-miembro', profileId: 'profile-miembro' },
      ]);

      await service.setParticipantRole({
        userId: 'user-a',
        roleKey: 'lider-5s',
        actorUserId: 'user-admin',
      });

      expect(transactionClient.userProfileAssignment.delete).toHaveBeenCalledWith({
        where: { id: 'assignment-miembro' },
      });
      expect(transactionClient.userProfileAssignment.create).toHaveBeenCalledWith({
        data: { userId: 'user-a', profileId: 'profile-lider' },
      });
      expect(auditEventsService.append).toHaveBeenCalledWith(
        transactionClient,
        expect.objectContaining({ eventName: 'access.user_application_profile_unassigned' }),
      );
      expect(auditEventsService.append).toHaveBeenCalledWith(
        transactionClient,
        expect.objectContaining({ eventName: 'access.user_application_profile_assigned' }),
      );
    });

    it('rechaza asignar un rol a quien no tiene la aplicación asignada', async () => {
      transactionClient.userApplicationAssignment.findUnique.mockResolvedValue(null);

      await expect(
        service.setParticipantRole({
          userId: 'user-sin-acceso',
          roleKey: 'miembro-5s',
          actorUserId: 'user-admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
