import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { INCOMING_REQUEST_ID_HEADER } from '@timbo/observability';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { API_GLOBAL_PREFIX, configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';
import { MetaCompanyPrismaService } from '../src/modules/meta-company/meta-company-prisma.service';
import { UserSessionsService } from '../src/modules/auth/user-sessions.service';
import { DEFAULT_CORS_ORIGIN } from '../src/runtime-config';

type StructuredLog = Record<string, unknown>;

function parseLogs(spy: jest.SpiedFunction<typeof console.log>): StructuredLog[] {
  return spy.mock.calls.map(([serialized]) => JSON.parse(serialized as string) as StructuredLog);
}

function completionLogs(spy: jest.SpiedFunction<typeof console.log>): StructuredLog[] {
  return parseLogs(spy).filter((entry) => entry.event === 'api.request.completed');
}

describe('Log operativo estructurado y X-Request-Id (e2e)', () => {
  let app: INestApplication;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;
  const userSessionsService = {
    createSession: jest.fn(),
    findActiveSession: jest.fn(),
    revokeSession: jest.fn(),
  };

  const transactionClient = {};
  const prismaService = {
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(transactionClient)),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .overrideProvider(MetaCompanyPrismaService)
      .useValue({})
      .overrideProvider(UserSessionsService)
      .useValue(userSessionsService)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, DEFAULT_CORS_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prismaService.$transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback(transactionClient),
    );
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('éxito: responde 200, conserva un X-Request-Id entrante válido y loguea exactamente una finalización', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get(`/${API_GLOBAL_PREFIX}/health`)
      .set(INCOMING_REQUEST_ID_HEADER, 'cliente-valido-123')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('cliente-valido-123');
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    const completions = completionLogs(consoleLogSpy);
    expect(completions).toHaveLength(1);
    expect(completions[0]).toMatchObject({
      level: 'info',
      service: 'api',
      operation: 'request',
      requestId: 'cliente-valido-123',
      method: 'GET',
      route: `/${API_GLOBAL_PREFIX}/health`,
      status: 200,
    });
    expect(typeof completions[0]?.durationMs).toBe('number');
    expect(typeof completions[0]?.environment).toBe('string');
  });

  it('nunca confía en un X-Request-Id entrante inválido: genera uno nuevo y lo usa en el log', async () => {
    const invalidRequestId = 'id con espacios inválido';

    const response = await request(app.getHttpServer() as Server)
      .get(`/${API_GLOBAL_PREFIX}/health`)
      .set(INCOMING_REQUEST_ID_HEADER, invalidRequestId)
      .expect(200);

    const assignedRequestId = response.headers['x-request-id'] as unknown as string;
    expect(assignedRequestId).toBeDefined();
    expect(assignedRequestId).not.toBe(invalidRequestId);

    const completions = completionLogs(consoleLogSpy);
    expect(completions[0]).toMatchObject({ requestId: assignedRequestId });
    for (const log of parseLogs(consoleLogSpy)) {
      expect(JSON.stringify(log)).not.toContain(invalidRequestId);
    }
  });

  it('error esperado: un 401 de guard conserva su status y devuelve X-Request-Id, sin diagnóstico adicional', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get(`/${API_GLOBAL_PREFIX}/auth/session`)
      .expect(401);

    expect(response.headers['x-request-id']).toBeDefined();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    const completions = completionLogs(consoleLogSpy);
    expect(completions).toHaveLength(1);
    expect(completions[0]).toMatchObject({
      status: 401,
      route: `/${API_GLOBAL_PREFIX}/auth/session`,
    });
  });

  it('error inesperado: responde 500, devuelve X-Request-Id y loguea una finalización más un diagnóstico correlacionados, sin duplicar el fallo', async () => {
    userSessionsService.revokeSession.mockRejectedValue(
      new Error('fallo de persistencia; token=secreto-no-debe-filtrarse'),
    );

    const response = await request(app.getHttpServer() as Server)
      .post(`/${API_GLOBAL_PREFIX}/auth/logout`)
      .set('Origin', DEFAULT_CORS_ORIGIN)
      .set('x-timbo-csrf', '1')
      .set('Cookie', `timbo_session=${randomUUID()}`)
      .expect(500);

    expect(response.body).toEqual({ code: 'INTERNAL_ERROR' });
    const requestId = response.headers['x-request-id'] as unknown as string;
    expect(requestId).toBeDefined();

    const completions = completionLogs(consoleErrorSpy);
    expect(completions).toHaveLength(1);
    expect(completions[0]).toMatchObject({ status: 500, requestId, level: 'error' });

    const diagnostics = parseLogs(consoleErrorSpy).filter(
      (entry) => entry.event === 'api.request.failed',
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      requestId,
      method: 'POST',
      route: `/${API_GLOBAL_PREFIX}/auth/logout`,
      name: 'Error',
    });
    expect(typeof diagnostics[0]?.message).toBe('string');
    expect(diagnostics[0]?.message as string).toContain('[REDACTED]');

    for (const [serialized] of consoleErrorSpy.mock.calls) {
      expect(serialized as string).not.toContain('secreto-no-debe-filtrarse');
    }
  });

  it('un callback OAuth con fallo inesperado registra la ruta sin exponer code ni state en ningún log', async () => {
    const secretCode = `secreto-code-${randomUUID()}`;
    const secretState = `secreto-state-${randomUUID()}`;

    await request(app.getHttpServer() as Server)
      .get(`/${API_GLOBAL_PREFIX}/auth/google/callback?state=${secretState}&code=${secretCode}`)
      .expect(500);

    const completions = completionLogs(consoleErrorSpy);
    expect(completions).toHaveLength(1);
    expect(completions[0]).toMatchObject({
      route: `/${API_GLOBAL_PREFIX}/auth/google/callback`,
      status: 500,
    });

    const allSerializedLogs = [...consoleLogSpy.mock.calls, ...consoleErrorSpy.mock.calls].map(
      ([serialized]) => serialized as string,
    );
    for (const serialized of allSerializedLogs) {
      expect(serialized).not.toContain(secretCode);
      expect(serialized).not.toContain(secretState);
    }
  });
});
