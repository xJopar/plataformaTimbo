import { Buffer } from 'node:buffer';
import { Prisma, type UsageEvent } from '../../generated/prisma/client';
import {
  type UsageEventAppendFailureFields,
  OperationalLoggerService,
} from '../observability/operational-logger.service';
import { RequestContextService } from '../observability/request-context.service';
import { USAGE_EVENTS_TEST_CATALOG } from '../../../test/usage-events-test-catalog';
import { PrismaService } from '../../database/prisma.service';
import { PRODUCT_USAGE_EVENT_CATALOG } from './usage-event-catalog';
import {
  addCalendarMonthsUtc,
  type AppendUsageEventInput,
  USAGE_EVENT_INPUT_METADATA_MAX_BYTES,
  UsageEventsService,
} from './usage-events.service';

const EVENT_ID = '737c5ac8-9385-4ae3-9ac7-f16622a8d1fc';
const ACTOR_USER_ID = '7f025649-8238-4958-97a8-f49ea0cd6759';
const VISIT_ID = 'a75a9b36-fcb4-4489-a3ea-f1e9a8d5d398';

const createUsageEvent = (overrides: Partial<UsageEvent> = {}): UsageEvent => ({
  id: 'f3b8edf2-b074-4b4d-a814-e86fc1b580b3',
  eventId: EVENT_ID,
  actorUserId: ACTOR_USER_ID,
  appKey: 'test-app',
  eventName: 'test.screen_opened',
  visitId: VISIT_ID,
  targetType: null,
  targetId: null,
  requestId: 'request-a',
  metadata: { screen: 'home' },
  occurredAt: new Date('2026-08-21T12:00:00.000Z'),
  expiresAt: new Date('2027-08-21T12:00:00.000Z'),
  ...overrides,
});

const createInput = (overrides: Partial<AppendUsageEventInput> = {}): AppendUsageEventInput => ({
  eventId: EVENT_ID,
  actorUserId: ACTOR_USER_ID,
  eventName: 'test.screen_opened',
  visitId: VISIT_ID,
  metadata: { screen: 'home' },
  ...overrides,
});

const metadataBytes = (payload: string): number =>
  Buffer.byteLength(JSON.stringify({ screen: 'home', payload }), 'utf8');

const payloadForMetadataBytes = (targetBytes: number): string => {
  const metadataWithoutPayloadBytes = metadataBytes('');
  return 'x'.repeat(targetBytes - metadataWithoutPayloadBytes);
};

describe('UsageEventsService', () => {
  const usageEventCreate = jest.fn<Promise<UsageEvent>, [Prisma.UsageEventCreateArgs]>();
  const prismaService = { usageEvent: { create: usageEventCreate } } as unknown as PrismaService;
  const logUsageEventAppendFailed = jest.fn<undefined, [unknown, UsageEventAppendFailureFields]>();
  const operationalLogger = {
    logUsageEventAppendFailed,
  } as unknown as OperationalLoggerService;
  let requestContext: RequestContextService;
  let service: UsageEventsService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));
    usageEventCreate.mockReset();
    logUsageEventAppendFailed.mockReset();
    requestContext = new RequestContextService();
    service = new UsageEventsService(
      prismaService,
      requestContext,
      operationalLogger,
      USAGE_EVENTS_TEST_CATALOG,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('mantiene el catálogo de prueba aislado de los eventos productivos', () => {
    expect(PRODUCT_USAGE_EVENT_CATALOG['hello-world.joke_requested']?.appKey).toBe('hello-world');
    expect(USAGE_EVENTS_TEST_CATALOG['test.screen_opened']?.appKey).toBe('test-app');
  });

  it('rechaza un catálogo inyectado con campos o reglas sin tipo y límite válidos', () => {
    expect(
      () =>
        new UsageEventsService(prismaService, requestContext, operationalLogger, {
          'invalid.catalog': {
            appKey: 'test-app',
            target: { targetType: 'screen', required: 'yes', maxIdLength: 64 },
            metadataFields: [
              { name: 'invalid', required: true, type: 'unsupported', maxLength: 20 },
            ],
          },
        } as unknown as typeof USAGE_EVENTS_TEST_CATALOG),
    ).toThrow('catálogo');
  });

  it('persiste una definición inyectada y devuelve recorded', async () => {
    usageEventCreate.mockResolvedValue(createUsageEvent());

    await expect(
      requestContext.run({ requestId: 'request-a' }, () => service.append(createInput())),
    ).resolves.toEqual({
      status: 'recorded',
      id: 'f3b8edf2-b074-4b4d-a814-e86fc1b580b3',
      eventId: EVENT_ID,
    });

    expect(usageEventCreate).toHaveBeenCalledWith({
      data: {
        eventId: EVENT_ID,
        actorUserId: ACTOR_USER_ID,
        appKey: 'test-app',
        eventName: 'test.screen_opened',
        visitId: VISIT_ID,
        targetType: null,
        targetId: null,
        requestId: 'request-a',
        metadata: { screen: 'home' },
        occurredAt: new Date('2026-08-21T12:00:00.000Z'),
        expiresAt: new Date('2027-08-21T12:00:00.000Z'),
      },
    });
  });

  it('falla antes de escribir cuando el evento no está registrado o la entrada es inválida', async () => {
    await expect(service.append(createInput({ eventName: 'unregistered.event' }))).rejects.toThrow(
      'no está registrado',
    );
    await expect(service.append(createInput({ eventId: 'not-a-uuid' }))).rejects.toThrow(
      'deben ser UUID',
    );
    await expect(service.append(createInput({ metadata: { screen: 'outside' } }))).rejects.toThrow(
      'valores permitidos',
    );
    await expect(service.append(createInput({ metadata: { unexpected: true } }))).rejects.toThrow(
      'campo no permitido',
    );
    expect(usageEventCreate).not.toHaveBeenCalled();
  });

  it('valida tipos, tamaños y campos requeridos de metadata antes de escribir', async () => {
    await expect(service.append(createInput({ metadata: {} }))).rejects.toThrow('campo requerido');
    await expect(
      service.append(
        createInput({ metadata: { screen: 'home', sequence: Number.POSITIVE_INFINITY } }),
      ),
    ).rejects.toThrow('número finito');
    await expect(
      service.append(createInput({ metadata: { screen: 'home', confirmed: 'yes' } })),
    ).rejects.toThrow('booleano');
    await expect(
      service.append(createInput({ metadata: { screen: 'x'.repeat(17) } })),
    ).rejects.toThrow('límites');
    expect(usageEventCreate).not.toHaveBeenCalled();
  });

  it('acepta el borde de metadata de entrada, rechaza el excedente y mide UTF-8 multibyte', async () => {
    const payloadAtLimit = payloadForMetadataBytes(USAGE_EVENT_INPUT_METADATA_MAX_BYTES);
    const payloadAboveLimit = `${payloadAtLimit}x`;
    const multibytePayload = 'ñ'.repeat(1530);
    usageEventCreate.mockResolvedValue(createUsageEvent());

    expect(metadataBytes(payloadAtLimit)).toBe(USAGE_EVENT_INPUT_METADATA_MAX_BYTES);
    await expect(
      service.append(createInput({ metadata: { screen: 'home', payload: payloadAtLimit } })),
    ).resolves.toMatchObject({ status: 'recorded' });
    await expect(
      service.append(createInput({ metadata: { screen: 'home', payload: payloadAboveLimit } })),
    ).rejects.toThrow('máximo de entrada de 3 KiB');
    expect(metadataBytes(multibytePayload)).toBeGreaterThan(USAGE_EVENT_INPUT_METADATA_MAX_BYTES);
    await expect(
      service.append(createInput({ metadata: { screen: 'home', payload: multibytePayload } })),
    ).rejects.toThrow('máximo de entrada de 3 KiB');
  });

  it('trata exclusivamente P2002 del eventId como duplicate, incluso con payload distinto', async () => {
    usageEventCreate.mockRejectedValue({ code: 'P2002', meta: { target: ['event_id'] } });

    await expect(
      service.append(createInput({ metadata: { screen: 'details', sequence: 2 } })),
    ).resolves.toEqual({ status: 'duplicate', eventId: EVENT_ID });

    expect(usageEventCreate).toHaveBeenCalledTimes(1);
    expect(usageEventCreate.mock.calls[0]?.[0].data.metadata).toEqual({
      screen: 'details',
      sequence: 2,
    });
    expect(logUsageEventAppendFailed).not.toHaveBeenCalled();
  });

  it('reconoce el P2002 real de Prisma 7 cuando el adaptador no expone meta.target', async () => {
    const prisma7EventIdError = Object.assign(
      new Error('Unique constraint failed on the fields: (`event_id`)'),
      { code: 'P2002' },
    );
    usageEventCreate.mockRejectedValue(prisma7EventIdError);

    await expect(service.append(createInput())).resolves.toEqual({
      status: 'duplicate',
      eventId: EVENT_ID,
    });
    expect(logUsageEventAppendFailed).not.toHaveBeenCalled();
  });

  it('diagnostica y devuelve failed ante P2002 ambiguo o una falla de infraestructura', async () => {
    const persistenceError = new Error('fallo token=secreto');
    usageEventCreate.mockRejectedValueOnce({ code: 'P2002', meta: { target: ['other_unique'] } });
    usageEventCreate.mockRejectedValueOnce(persistenceError);

    await expect(service.append(createInput())).resolves.toEqual({
      status: 'failed',
      eventId: EVENT_ID,
    });
    await expect(
      service.append(createInput({ eventId: 'b7ac46c5-8cb6-4c42-b687-9e1f1b32ad82' })),
    ).resolves.toEqual({ status: 'failed', eventId: 'b7ac46c5-8cb6-4c42-b687-9e1f1b32ad82' });

    expect(logUsageEventAppendFailed).toHaveBeenNthCalledWith(
      2,
      persistenceError,
      expect.objectContaining({
        eventId: 'b7ac46c5-8cb6-4c42-b687-9e1f1b32ad82',
        appKey: 'test-app',
        eventName: 'test.screen_opened',
        actorUserId: ACTOR_USER_ID,
      }),
    );
  });

  it('devuelve failed aunque el logger operativo también falle', async () => {
    const persistenceError = new Error('fallo token=secreto');
    usageEventCreate.mockRejectedValue(persistenceError);
    logUsageEventAppendFailed.mockImplementation(() => {
      throw new Error('logger no disponible');
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(service.append(createInput())).resolves.toEqual({
        status: 'failed',
        eventId: EVENT_ID,
      });
      expect(logUsageEventAppendFailed).toHaveBeenCalledWith(persistenceError, expect.any(Object));
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('api.usage-event.append_failed_logger_failed'),
      );
      expect(consoleErrorSpy.mock.calls[0]?.[0]).not.toContain('secreto');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('conserva doce meses calendario, incluso en el borde de febrero', () => {
    expect(addCalendarMonthsUtc(new Date('2024-02-29T18:05:00.000Z'), 12)).toEqual(
      new Date('2025-02-28T18:05:00.000Z'),
    );
  });
});
