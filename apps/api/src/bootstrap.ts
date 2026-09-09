import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const API_GLOBAL_PREFIX = 'api';
export const SWAGGER_UI_PATH = 'docs';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const openApiConfig = new DocumentBuilder()
    .setTitle('Plataforma Timbo — API')
    .setDescription('Documentación de las operaciones expuestas por la API de Plataforma Timbo.')
    .setVersion('0.1.0')
    .build();

  return SwaggerModule.createDocument(app, openApiConfig);
}

/**
 * Configuración de la aplicación compartida entre el arranque real (`main.ts`)
 * y las pruebas e2e, para que ambos verifiquen exactamente el mismo prefijo,
 * CORS y documento OpenAPI publicado.
 */
export function configureApp(app: INestApplication, corsOrigin: string): OpenAPIObject {
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.enableCors({
    credentials: true,
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, origin === undefined || origin === corsOrigin);
    },
  });
  // El filtro global de excepciones se registra vía DI (APP_FILTER en AppModule): necesita
  // RequestContextService y OperationalLoggerService, no puede instanciarse con `new`.

  const openApiDocument = createOpenApiDocument(app);
  SwaggerModule.setup(SWAGGER_UI_PATH, app, openApiDocument, {
    useGlobalPrefix: true,
  });

  return openApiDocument;
}
