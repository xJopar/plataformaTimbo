import { PrismaService } from '../../database/prisma.service';
import { MAX_ACTIVITY_EXPORT_ROWS, parseActivityQuery } from './activity.contracts';
import { ActivityService } from './activity.service';

const query = parseActivityQuery({ limit: '25', offset: '50', source: 'AUDIT' });

describe('ActivityService', () => {
  const prismaService = { $queryRaw: jest.fn() };
  const service = new ActivityService(prismaService as unknown as PrismaService);

  beforeEach(() => prismaService.$queryRaw.mockReset());

  it('aplica filtros y paginación acotada sin consultas por fila', async () => {
    prismaService.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'event-a',
          source: 'AUDIT',
          actor: 'Persona Timbo',
          appKey: 'platform',
          eventName: 'security.login_denied',
          outcome: 'DENIED',
          targetType: null,
          targetId: null,
          metadata: { reasonCode: 'USER_INACTIVE', token: 'secret' },
          occurredAt: new Date('2026-08-21T12:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([{ total: '51' }]);

    await expect(service.list(query)).resolves.toEqual({
      items: [expect.objectContaining({ metadata: { reasonCode: 'USER_INACTIVE' } })],
      total: 51,
      limit: 25,
      offset: 50,
    });
    expect(prismaService.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('redacta metadata fuera de la lista segura', async () => {
    prismaService.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'event-b',
          source: 'USAGE',
          actor: 'Persona Timbo',
          appKey: 'other-app',
          eventName: 'catalog.opened',
          outcome: 'SUCCESS',
          targetType: 'item',
          targetId: 'item-a',
          metadata: { email: 'persona@example.test', accessToken: 'not-safe' },
          occurredAt: new Date('2026-08-21T12:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }]);

    const result = await service.list(parseActivityQuery({}));
    expect(result.items[0]).toMatchObject({ target: 'item:item-a', metadata: {} });
  });

  it('expone sólo marca y modelo aprobados de los eventos de Lista de Precios', async () => {
    prismaService.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'event-price-list',
          source: 'USAGE',
          actor: 'Persona Timbo',
          appKey: 'lista-precios',
          eventName: 'lista-precios.model_viewed',
          outcome: 'SUCCESS',
          visitId: 'a75a9b36-fcb4-4489-a3ea-f1e9a8d5d398',
          targetType: 'vehicle_model',
          targetId: 'facchini|granelero',
          metadata: {
            brand: 'FACCHINI',
            model: 'GRANELERO',
            whatsappMessage: 'No debe exponerse',
          },
          occurredAt: new Date('2026-08-21T12:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }]);

    const result = await service.list(parseActivityQuery({}));
    expect(result.items[0]).toMatchObject({
      visitId: 'a75a9b36-fcb4-4489-a3ea-f1e9a8d5d398',
      targetType: 'vehicle_model',
      targetId: 'facchini|granelero',
      metadata: { brand: 'FACCHINI', model: 'GRANELERO' },
    });
  });

  it('exporta el filtro completo como CSV UTF-8 y neutraliza fórmulas aun con espacios o controles', async () => {
    const unsafeActors = [
      '=directo',
      '+directo',
      '-42',
      '@directo',
      '  =espaciado',
      '\t@tab',
      '\r+retorno',
      '\n-formula',
      '\u0001=control',
    ];
    prismaService.$queryRaw
      .mockResolvedValueOnce([{ total: unsafeActors.length }])
      .mockResolvedValueOnce(
        unsafeActors.map((actor, index) => ({
          id: `event-${index.toString()}`,
          source: 'AUDIT',
          actor,
          appKey: 'texto, "con comillas"',
          eventName: 'security.login_succeeded',
          outcome: 'SUCCESS',
          targetType: null,
          targetId: null,
          metadata: {},
          occurredAt: new Date('2026-08-21T12:00:00.000Z'),
        })),
      );

    const csv = await service.exportCsv(
      parseActivityQuery({ eventName: 'security.login_succeeded' }),
    );
    expect(csv.startsWith('\uFEFF"Fecha",')).toBe(true);
    expect(csv).toContain("'=directo");
    expect(csv).toContain("'+directo");
    expect(csv).toContain("'-42");
    expect(csv).toContain("'@directo");
    expect(csv).toContain("'  =espaciado");
    expect(csv).toContain("'\t@tab");
    expect(csv).toContain("'\r+retorno");
    expect(csv).toContain("'\n-formula");
    expect(csv).toContain("'\u0001=control");
    expect(csv).toContain('"texto, ""con comillas"""');
    expect(prismaService.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('exporta visita, objetivo, marca y modelo en columnas separadas', async () => {
    prismaService.$queryRaw.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([
      {
        id: 'event-price-list',
        source: 'USAGE',
        actor: 'Persona Timbo',
        appKey: 'lista-precios',
        eventName: 'lista-precios.model_viewed',
        outcome: 'SUCCESS',
        visitId: 'a75a9b36-fcb4-4489-a3ea-f1e9a8d5d398',
        targetType: 'vehicle_model',
        targetId: 'facchini|granelero',
        metadata: { brand: 'FACCHINI', model: 'GRANELERO' },
        occurredAt: new Date('2026-08-21T12:00:00.000Z'),
      },
    ]);

    const csv = await service.exportCsv(parseActivityQuery({}));
    expect(csv).toContain('"Visita","Tipo de objetivo","Id objetivo","Marca","Modelo"');
    expect(csv).toContain(
      '"a75a9b36-fcb4-4489-a3ea-f1e9a8d5d398","vehicle_model","facchini|granelero","FACCHINI","GRANELERO"',
    );
  });

  it('rechaza explícitamente una exportación superior al límite', async () => {
    prismaService.$queryRaw.mockResolvedValue([{ total: MAX_ACTIVITY_EXPORT_ROWS + 1 }]);

    await expect(service.exportCsv(parseActivityQuery({}))).rejects.toEqual(
      expect.objectContaining({ total: MAX_ACTIVITY_EXPORT_ROWS + 1 }),
    );
    expect(prismaService.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('ancla lista, estadísticas y CSV al asOf histórico compartido, no al reloj actual', async () => {
    const historicalQuery = parseActivityQuery({
      datePreset: 'today',
      asOf: '2020-07-14T15:30:00.000Z',
    });
    prismaService.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ eventsToday: 0, activePeopleToday: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);

    await service.list(historicalQuery);
    await service.getStatistics(historicalQuery);
    await service.exportCsv(historicalQuery);

    expect(historicalQuery.windowStart.toISOString()).toBe('2020-07-14T04:00:00.000Z');
    expect(historicalQuery.windowEnd.toISOString()).toBe('2020-07-14T15:30:00.000Z');
    const queryValues = prismaService.$queryRaw.mock.calls.map(([rawQuery]) =>
      getRawQueryValues(rawQuery),
    );
    for (const values of queryValues) {
      expect(values).toEqual(
        expect.arrayContaining([historicalQuery.windowStart, historicalQuery.windowEnd]),
      );
    }
    expect(queryValues[2]).toEqual(expect.arrayContaining([new Date('2020-07-14T04:00:00.000Z')]));
  });

  it('usa Este mes por defecto y rechaza rangos inválidos, parciales o mayores a 366 días', () => {
    expect(parseActivityQuery({})).toMatchObject({ datePreset: 'month' });
    expect(() => parseActivityQuery({ dateFrom: '2026-08-22', dateTo: '2026-08-21' })).toThrow(
      'desde',
    );
    expect(() => parseActivityQuery({ dateFrom: '2026-08-21' })).toThrow('requiere');
    expect(() => parseActivityQuery({ dateFrom: '2025-01-01', dateTo: '2026-01-02' })).toThrow(
      '366',
    );
    expect(() =>
      parseActivityQuery({ datePreset: 'today', dateFrom: '2026-08-21', dateTo: '2026-08-21' }),
    ).toThrow('período rápido');
    expect(() => parseActivityQuery({ source: 'OTHER' })).toThrow('source');
  });
});

function getRawQueryValues(rawQuery: unknown): readonly unknown[] {
  if (typeof rawQuery !== 'object' || rawQuery === null || !('values' in rawQuery)) return [];
  const values = rawQuery.values;
  return Array.isArray(values) ? values : [];
}
