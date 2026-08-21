import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '../src/generated/prisma/client';
import { PrismaModule } from '../src/database/prisma.module';
import { PrismaService } from '../src/database/prisma.service';
import { USAGE_EVENT_CATALOG } from '../src/modules/usage-events/usage-event-catalog';
import { UsageEventsModule } from '../src/modules/usage-events/usage-events.module';
import { UsageEventsService } from '../src/modules/usage-events/usage-events.service';
import { USAGE_EVENT_INPUT_METADATA_MAX_BYTES } from '../src/modules/usage-events/usage-events.service';
import { USAGE_EVENTS_TEST_CATALOG } from './usage-events-test-catalog';

interface IntegrationEnvironment {
  USAGE_EVENTS_INTEGRATION_TEST_RUN?: string;
  DATABASE_TEST_ENVIRONMENT?: string;
  DATABASE_URL?: string;
}

const requireDedicatedIntegrationTestRun = (environment: IntegrationEnvironment): void => {
  if (environment.USAGE_EVENTS_INTEGRATION_TEST_RUN !== '1') {
    throw new Error(
      'La prueba de integración de uso sólo puede ejecutarse mediante test:usage-events:integration.',
    );
  }
};

const requireDevelopmentIntegrationEnvironment = (environment: IntegrationEnvironment): void => {
  if (environment.DATABASE_TEST_ENVIRONMENT !== 'development') {
    throw new Error('La prueba de integración requiere DATABASE_TEST_ENVIRONMENT=development.');
  }
  if (environment.DATABASE_URL === undefined || environment.DATABASE_URL.length === 0) {
    throw new Error('La prueba de integración requiere DATABASE_URL.');
  }
};

const metadataBytes = (payload: string): number =>
  Buffer.byteLength(JSON.stringify({ screen: 'home', payload }), 'utf8');

const payloadForMetadataBytes = (targetBytes: number): string => {
  const metadataWithoutPayloadBytes = metadataBytes('');
  return 'x'.repeat(targetBytes - metadataWithoutPayloadBytes);
};

const createDirectUsageEvent = (
  prismaService: PrismaService,
  data: Prisma.UsageEventUncheckedCreateInput,
) => prismaService.usageEvent.create({ data });

const toError = (error: unknown, fallbackMessage: string): Error =>
  error instanceof Error ? error : new Error(fallbackMessage, { cause: error });

requireDedicatedIntegrationTestRun(process.env);

describe('guardia de integración de analítica de uso', () => {
  it('requiere el runner dedicado antes de construir Nest', () => {
    expect(() => {
      requireDedicatedIntegrationTestRun({});
    }).toThrow('test:usage-events:integration');
  });

  it('requiere la confirmación explícita de development y DATABASE_URL', () => {
    expect(() => {
      requireDevelopmentIntegrationEnvironment({ DATABASE_URL: 'configured' });
    }).toThrow('DATABASE_TEST_ENVIRONMENT=development');
    expect(() => {
      requireDevelopmentIntegrationEnvironment({ DATABASE_TEST_ENVIRONMENT: 'development' });
    }).toThrow('DATABASE_URL');
  });
});

describe('UsageEventsService contra PostgreSQL development', () => {
  let moduleFixture: TestingModule | undefined;
  let usageEventsService: UsageEventsService;
  let prismaService: PrismaService;

  beforeAll(async () => {
    requireDevelopmentIntegrationEnvironment(process.env);
    moduleFixture = await Test.createTestingModule({
      imports: [PrismaModule, UsageEventsModule],
    })
      .overrideProvider(USAGE_EVENT_CATALOG)
      .useValue(USAGE_EVENTS_TEST_CATALOG)
      .compile();
    await moduleFixture.init();
    usageEventsService = moduleFixture.get(UsageEventsService);
    prismaService = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    if (moduleFixture !== undefined) {
      await moduleFixture.close();
    }
  });

  it('persiste una sola fila ante dos writers concurrentes y verifica restricciones relevantes', async () => {
    const userId = randomUUID();
    const eventId = randomUUID();
    const visitId = randomUUID();
    const directUsageEvents = {
      invalidText: { id: randomUUID(), eventId: randomUUID(), visitId: randomUUID() },
      invalidForeignKey: { id: randomUUID(), eventId: randomUUID(), visitId: randomUUID() },
      invalidExpiration: { id: randomUUID(), eventId: randomUUID(), visitId: randomUUID() },
      targetWithoutId: { id: randomUUID(), eventId: randomUUID(), visitId: randomUUID() },
      targetWithoutType: { id: randomUUID(), eventId: randomUUID(), visitId: randomUUID() },
      metadataArray: { id: randomUUID(), eventId: randomUUID(), visitId: randomUUID() },
      metadataTooLarge: { id: randomUUID(), eventId: randomUUID(), visitId: randomUUID() },
      metadataNearLimit: { id: randomUUID(), eventId: randomUUID(), visitId: randomUUID() },
    };
    const missingActorUserId = randomUUID();
    const occurredAt = new Date('2026-08-21T12:00:00.000Z');
    const expiresAt = new Date('2027-08-21T12:00:00.000Z');
    const nearLimitPayload = payloadForMetadataBytes(USAGE_EVENT_INPUT_METADATA_MAX_BYTES);
    let primaryError: unknown;
    let hasPrimaryError = false;

    try {
      await prismaService.user.create({
        data: { id: userId, corporateEmail: `usage-events-integration-${userId}@example.test` },
      });

      const results = await Promise.all([
        usageEventsService.append({
          eventId,
          actorUserId: userId,
          eventName: 'test.screen_opened',
          visitId,
          metadata: { screen: 'home' },
        }),
        usageEventsService.append({
          eventId,
          actorUserId: userId,
          eventName: 'test.screen_opened',
          visitId,
          metadata: { screen: 'details', sequence: 2 },
        }),
      ]);

      expect(results.map((result) => result.status).sort()).toEqual(['duplicate', 'recorded']);
      const recorded = results.find(
        (result): result is Extract<(typeof results)[number], { status: 'recorded' }> =>
          result.status === 'recorded',
      );
      if (recorded === undefined) {
        throw new Error('La prueba no obtuvo la fila de uso registrada.');
      }
      await expect(prismaService.usageEvent.count({ where: { eventId } })).resolves.toBe(1);

      await expect(
        createDirectUsageEvent(prismaService, {
          id: directUsageEvents.invalidText.id,
          eventId: directUsageEvents.invalidText.eventId,
          actorUserId: userId,
          appKey: ' ',
          eventName: 'invalid-check',
          visitId: directUsageEvents.invalidText.visitId,
          requestId: `usage-check-${userId}`,
          metadata: {},
          occurredAt,
          expiresAt,
        }),
      ).rejects.toBeDefined();

      await expect(
        createDirectUsageEvent(prismaService, {
          id: directUsageEvents.invalidForeignKey.id,
          eventId: directUsageEvents.invalidForeignKey.eventId,
          actorUserId: missingActorUserId,
          appKey: 'test-app',
          eventName: 'invalid-foreign-key',
          visitId: directUsageEvents.invalidForeignKey.visitId,
          requestId: `usage-fk-${userId}`,
          metadata: {},
          occurredAt,
          expiresAt,
        }),
      ).rejects.toBeDefined();

      await expect(
        createDirectUsageEvent(prismaService, {
          id: directUsageEvents.invalidExpiration.id,
          eventId: directUsageEvents.invalidExpiration.eventId,
          actorUserId: userId,
          appKey: 'test-app',
          eventName: 'invalid-expiration',
          visitId: directUsageEvents.invalidExpiration.visitId,
          requestId: `usage-expiration-${userId}`,
          metadata: {},
          occurredAt,
          expiresAt: occurredAt,
        }),
      ).rejects.toBeDefined();

      await expect(
        createDirectUsageEvent(prismaService, {
          id: directUsageEvents.targetWithoutId.id,
          eventId: directUsageEvents.targetWithoutId.eventId,
          actorUserId: userId,
          appKey: 'test-app',
          eventName: 'invalid-target-without-id',
          visitId: directUsageEvents.targetWithoutId.visitId,
          targetType: 'screen',
          targetId: null,
          requestId: `usage-target-type-${userId}`,
          metadata: {},
          occurredAt,
          expiresAt,
        }),
      ).rejects.toBeDefined();

      await expect(
        createDirectUsageEvent(prismaService, {
          id: directUsageEvents.targetWithoutType.id,
          eventId: directUsageEvents.targetWithoutType.eventId,
          actorUserId: userId,
          appKey: 'test-app',
          eventName: 'invalid-target-without-type',
          visitId: directUsageEvents.targetWithoutType.visitId,
          targetType: null,
          targetId: 'screen-a',
          requestId: `usage-target-id-${userId}`,
          metadata: {},
          occurredAt,
          expiresAt,
        }),
      ).rejects.toBeDefined();

      await expect(
        createDirectUsageEvent(prismaService, {
          id: directUsageEvents.metadataArray.id,
          eventId: directUsageEvents.metadataArray.eventId,
          actorUserId: userId,
          appKey: 'test-app',
          eventName: 'invalid-metadata-array',
          visitId: directUsageEvents.metadataArray.visitId,
          requestId: `usage-metadata-array-${userId}`,
          metadata: [],
          occurredAt,
          expiresAt,
        }),
      ).rejects.toBeDefined();

      await expect(
        createDirectUsageEvent(prismaService, {
          id: directUsageEvents.metadataTooLarge.id,
          eventId: directUsageEvents.metadataTooLarge.eventId,
          actorUserId: userId,
          appKey: 'test-app',
          eventName: 'invalid-metadata-size',
          visitId: directUsageEvents.metadataTooLarge.visitId,
          requestId: `usage-metadata-size-${userId}`,
          metadata: { payload: 'x'.repeat(4096) },
          occurredAt,
          expiresAt,
        }),
      ).rejects.toBeDefined();

      expect(metadataBytes(nearLimitPayload)).toBe(USAGE_EVENT_INPUT_METADATA_MAX_BYTES);
      await createDirectUsageEvent(prismaService, {
        id: directUsageEvents.metadataNearLimit.id,
        eventId: directUsageEvents.metadataNearLimit.eventId,
        actorUserId: userId,
        appKey: 'test-app',
        eventName: 'valid-metadata-near-limit',
        visitId: directUsageEvents.metadataNearLimit.visitId,
        requestId: `usage-metadata-near-limit-${userId}`,
        metadata: { screen: 'home', payload: nearLimitPayload },
        occurredAt,
        expiresAt,
      });
      const metadataSize = await prismaService.$queryRaw<{ size: number }[]>`
        SELECT pg_column_size(metadata) AS size FROM usage_events
        WHERE id = ${directUsageEvents.metadataNearLimit.id}::uuid
      `;
      expect(metadataSize).toHaveLength(1);
      const storedMetadataSize = metadataSize[0]?.size;
      if (storedMetadataSize === undefined) {
        throw new Error('La prueba no obtuvo el tamaño de metadata persistida.');
      }
      expect(storedMetadataSize).toBeLessThanOrEqual(4096);

      const indexes = await prismaService.$queryRaw<{ indexname: string }[]>`
        SELECT indexname FROM pg_indexes WHERE tablename = 'usage_events'
      `;
      expect(indexes.map(({ indexname }) => indexname)).toEqual(
        expect.arrayContaining([
          'usage_events_event_id_key',
          'usage_events_expires_at_idx',
          'usage_events_occurred_at_idx',
          'usage_events_actor_user_id_occurred_at_idx',
          'usage_events_app_key_occurred_at_idx',
          'usage_events_event_name_occurred_at_idx',
          'usage_events_visit_id_occurred_at_idx',
        ]),
      );
    } catch (error: unknown) {
      primaryError = error;
      hasPrimaryError = true;
    }

    let cleanupError: unknown;
    try {
      const fixtureEventIds = [
        eventId,
        ...Object.values(directUsageEvents).map(({ eventId: directEventId }) => directEventId),
      ];
      const usageEvents = await prismaService.usageEvent.findMany({
        where: {
          OR: [{ actorUserId: userId }, { eventId: { in: fixtureEventIds } }],
        },
        select: { id: true },
      });
      for (const usageEvent of usageEvents) {
        await prismaService.usageEvent.delete({ where: { id: usageEvent.id } });
      }
      const user = await prismaService.user.findUnique({ where: { id: userId } });
      if (user !== null) {
        await prismaService.user.delete({ where: { id: userId } });
      }
    } catch (error: unknown) {
      cleanupError = error;
    }

    if (hasPrimaryError && cleanupError !== undefined) {
      throw new AggregateError(
        [primaryError, cleanupError],
        'La prueba falló y su limpieza exacta también falló.',
      );
    }
    if (hasPrimaryError) {
      throw toError(primaryError, 'La prueba de integración falló con un valor no Error.');
    }
    if (cleanupError !== undefined) {
      throw toError(cleanupError, 'La limpieza de la prueba falló con un valor no Error.');
    }
  }, 30_000);
});
