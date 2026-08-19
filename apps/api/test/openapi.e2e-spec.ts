import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { API_GLOBAL_PREFIX, configureApp, SWAGGER_UI_PATH } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';
import { DEFAULT_CORS_ORIGIN } from '../src/runtime-config';

describe('Documentación OpenAPI publicada (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, DEFAULT_CORS_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('publica el documento OpenAPI en /api/docs-json con la operación getHealth', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get(`/${API_GLOBAL_PREFIX}/${SWAGGER_UI_PATH}-json`)
      .expect(200);

    const document = response.body as OpenAPIObject;
    const healthOperation = document.paths[`/${API_GLOBAL_PREFIX}/health`]?.get;

    expect(healthOperation?.operationId).toBe('getHealth');
    expect(healthOperation?.responses['200']).toBeDefined();
    expect(document.paths['/api/auth/google']?.get?.operationId).toBe('startGoogleLogin');
    expect(document.paths['/api/auth/google/callback']?.get?.operationId).toBe(
      'completeGoogleLogin',
    );
    expect(document.paths['/api/auth/session']?.get?.operationId).toBe('getAuthSession');
    expect(document.paths['/api/auth/logout']?.post?.operationId).toBe('logout');
  });

  it('publica Swagger UI navegable en /api/docs', async () => {
    await request(app.getHttpServer() as Server)
      .get(`/${API_GLOBAL_PREFIX}/${SWAGGER_UI_PATH}`)
      .expect(200);
  });
});
