# App Shell Plataforma Timbo

Monorepo privado de la Plataforma Timbo, administrado con **pnpm workspaces** (sin Turbo ni Nx).

Este incremento contiene la base ejecutable de la API y una web React mínima que verifica
`GET /api/health` mediante contratos OpenAPI tipados. Todavía no incluye Home definitivo,
autenticación ni módulos de negocio; PostgreSQL queda disponible sólo como infraestructura interna.

## Requisitos

- [Node.js](https://nodejs.org/) **24 o superior** (declarado en `engines.node`; probado con Node 24.13.0). Es el mínimo real que soporta toda la cadena de herramientas instalada (ESLint 10, `--env-file-if-exists`, etc.).
- [pnpm](https://pnpm.io/) **11.22.0 exacto**, fijado en `packageManager` de `package.json`. `corepack pnpm <comando>` respeta ese valor automáticamente. Además, `pnpm` está listado como devDependency (también fijado a `11.22.0`, sin rango) porque este entorno no tiene un shim global de `pnpm` en el `PATH`: los scripts raíz que delegan en `pnpm -r` / `pnpm --filter` (recursión de workspace, sin Turbo ni Nx) necesitan resolver el binario `pnpm` desde `node_modules/.bin`.

## Instalación

```bash
pnpm install
```

## Variables de entorno

Copiar `.env.example` a `.env` (en la **raíz del workspace**) y ajustar si es necesario. `DATABASE_URL` es un secreto y no se debe copiar a documentación, logs ni control de versiones.

| Variable              | Descripción                                                                                                              | Valor por defecto       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `PORT`                | Puerto en el que escucha la API.                                                                                         | `3000`                  |
| `CORS_ORIGIN`         | Origen permitido por CORS para el cliente web local.                                                                     | `http://localhost:5173` |
| `VITE_API_BASE_URL`   | Origen que usa la web para llamar a la API.                                                                              | `http://localhost:3000` |
| `API_INTERNAL_ORIGIN` | Origen interno de la API para el gateway de `apps/web/server` (`/api/*`). Server-only; no se carga desde el `.env` raíz. | Sin valor por defecto   |
| `DATABASE_URL`        | URL de PostgreSQL para la API y las migraciones.                                                                         | Sin valor por defecto   |

El `.env` raíz se carga con el flag nativo de Node `--env-file-if-exists` para la API y Vite lo usa también como directorio de variables de la web. No se agrega `dotenv` ni `@nestjs/config`. Los scripts `dev` y `start` de `apps/api` lo invocan apuntando a `../../.env` (la ruta del `.env` raíz vista desde `apps/api`); si el archivo no existe, Node continúa sin él, pero la API aborta porque `DATABASE_URL` es obligatoria. Antes de crear la aplicación de Nest, `apps/api/src/runtime-config.ts` valida `PORT` (entero entre 1 y 65535), `CORS_ORIGIN` (origen HTTP o HTTPS, sin ruta, query ni fragmento) y `DATABASE_URL` (URL PostgreSQL sin mostrar su valor ante un error); un valor inválido aborta el arranque con un mensaje claro en español y código de salida distinto de cero, antes de levantar Nest. La web aplica la misma validación de origen a `VITE_API_BASE_URL` y representa el error como API no disponible.

## Comandos raíz

| Comando                                           | Descripción                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                        | Levanta `apps/api` en modo desarrollo, con reinicio automático ante cambios.                                            |
| `pnpm dev:web`                                    | Levanta `apps/web` con Vite.                                                                                            |
| `pnpm start:api`                                  | Inicia la API compilada; Railway usa este recorrido con su `PORT`.                                                      |
| `pnpm start:web`                                  | Sirve la SPA compilada y reenvía `/api/*` a `API_INTERNAL_ORIGIN` (gateway de mismo origen; puerto `4173` por defecto). |
| `pnpm generate:contracts`                         | Exporta OpenAPI desde Nest y regenera el documento y los tipos versionados.                                             |
| `pnpm check:contracts`                            | Comprueba en un directorio temporal que los contratos versionados están actualizados.                                   |
| `pnpm prisma:validate`                            | Valida el schema Prisma de la API.                                                                                      |
| `pnpm prisma:generate`                            | Regenera el cliente Prisma local e ignorado.                                                                            |
| `pnpm prisma:migrate:deploy`                      | Aplica migraciones versionadas pendientes; es el pre-deploy de la API.                                                  |
| `pnpm --filter @timbo/api test:users:integration` | Ejecuta la integración con escritura, opt-in y sólo para development.                                                   |
| `pnpm build`                                      | Compila todos los paquetes del workspace.                                                                               |
| `pnpm typecheck`                                  | Verifica los tipos de TypeScript sin emitir archivos.                                                                   |
| `pnpm lint`                                       | Ejecuta ESLint sobre todo el repositorio.                                                                               |
| `pnpm test`                                       | Ejecuta las pruebas de todos los paquetes del workspace.                                                                |
| `pnpm format`                                     | Formatea el repositorio con Prettier.                                                                                   |
| `pnpm format:check`                               | Verifica el formato sin modificar archivos.                                                                             |

## Prisma y migraciones

Prisma vive sólo en `apps/api`. El cliente se genera en `apps/api/src/generated/prisma`, queda fuera de Git, lint y formato, y se regenera antes de typecheck, tests y build.

Los comandos parametrizados de `migrate dev` se ejecutan directamente desde `apps/api` para evitar el forwarding ambiguo de argumentos de un script raíz:

```bash
cd apps/api
node --env-file=../../.env ./node_modules/prisma/build/index.js migrate dev --config prisma.config.ts --name <nombre> --create-only
node --env-file=../../.env ./node_modules/prisma/build/index.js migrate dev --config prisma.config.ts --name <nombre>
```

Usar esos comandos únicamente contra la base aislada de development. Producción aplica solamente las migraciones versionadas mediante `prisma migrate deploy` antes de iniciar la API. No se usa `db push`, `migrate dev` ni `migrate reset` en producción; `migrate deploy` no genera migraciones ni modifica el schema fuera de las migraciones versionadas.

`users_corporate_email_normalized_check` y `users_status_deactivated_at_check` son constraints PostgreSQL no representables declarativamente por Prisma. Se mantienen como SQL personalizado en la migración versionada y deben preservarse al revisar cambios futuros del schema.

La CLI `prisma` es una dependencia de runtime para que exista durante el pre-deploy de Railway. El cliente se genera antes de los recorridos de typecheck, pruebas y build; por tanto, el build de la API queda listo antes del pre-deploy sin versionar la salida generada.

### Integración de usuarios (opt-in)

`pnpm test` es offline y no selecciona pruebas que conecten PostgreSQL. La integración con escritura se ejecuta separadamente y sólo contra development, después de configurar `DATABASE_TEST_ENVIRONMENT=development` en el proceso:

```powershell
$env:DATABASE_TEST_ENVIRONMENT = 'development'
pnpm --filter @timbo/api test:users:integration
```

El runner dedicado establece su propia señal adicional antes de cargar Jest. La prueba se niega a ejecutar sin ambas guardas y limpia únicamente el fixture que creó por su ID; nunca usa reset, truncate ni limpieza masiva. No repetirla de forma rutinaria: los checks ordinarios validan la integración sin escribir en la base.

## Estructura

```text
apps/
  api/                  # API NestJS (paquete @timbo/api)
    src/
      main.ts            # Arranque: valida configuración, crea Nest y aplica bootstrap.ts
      runtime-config.ts   # Resuelve y valida PORT, CORS_ORIGIN y DATABASE_URL antes de crear Nest
      bootstrap.ts         # Configuración de la app compartida con las pruebas e2e (prefijo, CORS, Swagger)
      app.module.ts       # Módulo raíz, importa HealthModule
      health/
        health.controller.ts   # Recibe la petición HTTP
        health.service.ts      # Resuelve el estado de disponibilidad
        dto/health-response.dto.ts  # Forma documentada de la respuesta
    test/                 # Pruebas end-to-end (recorrido HTTP y documento OpenAPI)
  web/                  # Web React/Vite (paquete @timbo/web)
    src/
      api/              # Configuración, transporte tipado y fachada api.system, api.auth
      app.tsx           # Estados verificando, disponible y no disponible
    server/              # Gateway HTTP productivo (Node, sin bundlear): sirve la SPA y
                         # reenvía /api/* a API_INTERNAL_ORIGIN para que el navegador use
                         # siempre el origen de web (apps/web/server/start.ts es el arranque)
packages/
  contracts/            # Documento OpenAPI y tipos generados, ambos versionados
    src/generated/      # Salida de openapi-typescript; no se edita manualmente
scripts/
  check-contracts.mjs   # Regenera temporalmente y compara sin ensuciar el workspace
docs/
  CODING_CONVENTIONS.md   # Convenciones de código durables del repositorio
AGENTS.md                 # Reglas durables para agentes que trabajen en este repositorio
```

## Recorrido para ejecutar y comprobar la integración

1. Instalar dependencias: `pnpm install`.
2. Generar el contrato si cambió la API: `pnpm generate:contracts`. Para comprobar que lo versionado está actualizado sin escribir archivos: `pnpm check:contracts`.
3. Con `DATABASE_URL` secreta configurada en el `.env` local para development, levantar la API en modo desarrollo: `pnpm dev` (escucha por defecto en `http://localhost:3000`).
4. En otra terminal, levantar la web: `pnpm dev:web` (Vite escucha por defecto en `http://localhost:5173`). La pantalla muestra primero **Verificando conexión** y luego **API disponible**; ante un fallo de red, HTTP o configuración, muestra **API no disponible** con un botón nativo para reintentar.
5. Consultar el estado de disponibilidad: `GET http://localhost:3000/api/health`. Debe responder `200` con un cuerpo como:

   ```json
   { "status": "ok", "timestamp": "2026-08-17T20:36:55.847Z" }
   ```

6. Explorar la documentación navegable (Swagger UI): `http://localhost:3000/api/docs`.
7. Obtener el documento OpenAPI en JSON: `http://localhost:3000/api/docs-json`.

## Recorrido de lectura del código

El flujo de la única operación expuesta se lee de punta a punta sin capas intermedias:

1. `apps/api/src/main.ts`: resuelve y valida la configuración de runtime, crea Nest y aplica la configuración compartida de la app.
2. `apps/api/src/runtime-config.ts`: valida `PORT`, `CORS_ORIGIN` y la `DATABASE_URL` PostgreSQL obligatoria sin exponer su valor; si alguno es inválido, lanza un error antes de que `main.ts` cree la aplicación de Nest.
3. `apps/api/src/bootstrap.ts`: fija el prefijo global `/api`, habilita CORS y publica el documento OpenAPI (Swagger UI y JSON). La usan tanto `main.ts` como las pruebas e2e, para no duplicar esta configuración.
4. `apps/api/src/app.module.ts`: módulo raíz que importa `HealthModule`.
5. `apps/api/src/health/health.controller.ts`: recibe la petición HTTP `GET /health` y delega en el servicio.
6. `apps/api/src/health/health.service.ts`: resuelve el estado de disponibilidad.
7. `apps/api/src/health/dto/health-response.dto.ts`: forma documentada de la respuesta, usada tanto en tiempo de ejecución como en el esquema OpenAPI.
8. `apps/api/src/export-openapi.ts`: crea Nest sin escuchar un puerto, aplica la misma configuración y escribe el documento determinista que alimenta el paquete de contratos.
9. `packages/contracts/openapi.json` y `packages/contracts/src/generated/openapi.ts`: artefactos versionados generados desde la API; no se editan manualmente.
10. `apps/web/src/api/system.ts`: único lugar que conoce `GET /api/health`; usa `openapi-fetch` y expone `api.system.getHealth()` mediante una fachada legible.
11. `apps/web/src/app.tsx`: consume la fachada y representa los estados de conexión, sin conocer rutas ni tipos de OpenAPI.

## Pruebas

- `apps/api/src/runtime-config.spec.ts`: pruebas unitarias de `PORT`, `CORS_ORIGIN` y `DATABASE_URL` (valores por defecto, válidos, inválidos y ausencia segura de la URL obligatoria).
- `apps/api/src/health/*.spec.ts`: pruebas unitarias del servicio y del controlador.
- `apps/api/test/health.e2e-spec.ts`: recorrido HTTP real de `GET /api/health` sobre una instancia de Nest levantada con la misma configuración (`bootstrap.ts`) que usa `main.ts`.
- `apps/api/test/openapi.e2e-spec.ts`: solicita realmente `/api/docs-json` (documento OpenAPI con la operación `getHealth`) y `/api/docs` (Swagger UI publicado).
- `packages/contracts` ejecuta el chequeo de contrato actualizado, regenerando en un directorio temporal y comparando el documento y los tipos con lo versionado.
- `apps/web/src/api/*.spec.ts`: comprueba URL pública, transporte tipado y errores HTTP/red.
- `apps/web/src/app.spec.tsx`: comprueba carga, disponibilidad, fallo y reintento.
- `apps/web/server/gateway-config.spec.ts`: valida `PORT` y `API_INTERNAL_ORIGIN` (por defecto, válidos, inválidos y ausencia obligatoria).
- `apps/web/server/gateway.spec.ts`: recorrido HTTP real del gateway contra un upstream de prueba — reenvío de método/cuerpo/encabezados, `Set-Cookie` y cookie reenviada en la petición siguiente, rutas ajenas a `/api` servidas por la SPA sin tocar el upstream, y `502` explícito (nunca HTML) cuando el upstream está caído.

Ejecutar todas las pruebas con `pnpm test`.

## Despliegue

El repositorio se despliega en Railway como dos servicios llamados `api` y `web`, ambos desde la
raíz compartida del monorepo. La configuración como código vive en
`apps/api/railway.json` y `apps/web/railway.json`.

La API requiere `DATABASE_URL` y ejecuta las migraciones versionadas pendientes en el pre-deploy. Consultar
[`docs/RAILWAY_DEPLOYMENT.md`](docs/RAILWAY_DEPLOYMENT.md) para el flujo vigente de `desarrollo` hacia
development y la promoción autorizada a `main`/production, además de las referencias privadas de PostgreSQL.
