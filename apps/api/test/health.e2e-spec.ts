import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { API_GLOBAL_PREFIX, configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';
import { MetaCompanyPrismaService } from '../src/modules/meta-company/meta-company-prisma.service';
import { DEFAULT_CORS_ORIGIN } from '../src/runtime-config';

describe('GET /api/health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(MetaCompanyPrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, DEFAULT_CORS_ORIGIN);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 con el estado de disponibilidad', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get(`/${API_GLOBAL_PREFIX}/health`)
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      // expect.any(...) de Jest está tipado como "any" en @types/jest; no hay alternativa tipada.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      timestamp: expect.any(String),
    });
  });
});
