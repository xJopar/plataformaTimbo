# App Shell Plataforma Timbo

Monorepo privado de la Plataforma Timbo, administrado con **pnpm workspaces** (sin Turbo ni Nx).

Este primer incremento contiene únicamente la base ejecutable de la API: una operación de estado (`GET /api/health`) documentada con OpenAPI/Swagger. Todavía no incluye frontend, base de datos, autenticación ni módulos de negocio.

## Requisitos

- [Node.js](https://nodejs.org/) **24 o superior** (declarado en `engines.node`; probado con Node 24.13.0). Es el mínimo real que soporta toda la cadena de herramientas instalada (ESLint 10, `--env-file-if-exists`, etc.).
- [pnpm](https://pnpm.io/) **11.22.0 exacto**, fijado en `packageManager` de `package.json`. `corepack pnpm <comando>` respeta ese valor automáticamente. Además, `pnpm` está listado como devDependency (también fijado a `11.22.0`, sin rango) porque este entorno no tiene un shim global de `pnpm` en el `PATH`: los scripts raíz que delegan en `pnpm -r` / `pnpm --filter` (recursión de workspace, sin Turbo ni Nx) necesitan resolver el binario `pnpm` desde `node_modules/.bin`.

## Instalación

```bash
pnpm install
```

## Variables de entorno

Copiar `.env.example` a `.env` (en la **raíz del workspace**) y ajustar si es necesario. Ninguna de estas variables es secreta.

| Variable      | Descripción                                          | Valor por defecto       |
| ------------- | ---------------------------------------------------- | ----------------------- |
| `PORT`        | Puerto en el que escucha la API.                     | `3000`                  |
| `CORS_ORIGIN` | Origen permitido por CORS para el cliente web local. | `http://localhost:5173` |

El `.env` raíz se carga con el flag nativo de Node `--env-file-if-exists`, sin agregar `dotenv` ni `@nestjs/config`. Los scripts `dev` y `start` de `apps/api` lo invocan apuntando a `../../.env` (la ruta del `.env` raíz vista desde `apps/api`); si el archivo no existe, Node continúa sin él y la API usa los valores por defecto. Antes de crear la aplicación de Nest, `apps/api/src/runtime-config.ts` valida `PORT` (entero entre 1 y 65535) y `CORS_ORIGIN` (origen HTTP o HTTPS, sin ruta, query ni fragmento); un valor inválido aborta el arranque con un mensaje claro en español y código de salida distinto de cero, antes de levantar Nest.

## Comandos raíz

| Comando             | Descripción                                                                  |
| ------------------- | ---------------------------------------------------------------------------- |
| `pnpm dev`          | Levanta `apps/api` en modo desarrollo, con reinicio automático ante cambios. |
| `pnpm build`        | Compila todos los paquetes del workspace.                                    |
| `pnpm typecheck`    | Verifica los tipos de TypeScript sin emitir archivos.                        |
| `pnpm lint`         | Ejecuta ESLint sobre todo el repositorio.                                    |
| `pnpm test`         | Ejecuta las pruebas de todos los paquetes del workspace.                     |
| `pnpm format`       | Formatea el repositorio con Prettier.                                        |
| `pnpm format:check` | Verifica el formato sin modificar archivos.                                  |

## Estructura

```text
apps/
  api/                  # API NestJS (paquete @timbo/api)
    src/
      main.ts            # Arranque: valida configuración, crea Nest y aplica bootstrap.ts
      runtime-config.ts   # Resuelve y valida PORT y CORS_ORIGIN antes de crear Nest
      bootstrap.ts         # Configuración de la app compartida con las pruebas e2e (prefijo, CORS, Swagger)
      app.module.ts       # Módulo raíz, importa HealthModule
      health/
        health.controller.ts   # Recibe la petición HTTP
        health.service.ts      # Resuelve el estado de disponibilidad
        dto/health-response.dto.ts  # Forma documentada de la respuesta
    test/                 # Pruebas end-to-end (recorrido HTTP y documento OpenAPI)
docs/
  CODING_CONVENTIONS.md   # Convenciones de código durables del repositorio
AGENTS.md                 # Reglas durables para agentes que trabajen en este repositorio
```

## Recorrido para ejecutar y comprobar la API

1. Instalar dependencias: `pnpm install`.
2. Levantar la API en modo desarrollo: `pnpm dev` (escucha por defecto en `http://localhost:3000`).
3. Consultar el estado de disponibilidad: `GET http://localhost:3000/api/health`. Debe responder `200` con un cuerpo como:

   ```json
   { "status": "ok", "timestamp": "2026-08-17T20:36:55.847Z" }
   ```

4. Explorar la documentación navegable (Swagger UI): `http://localhost:3000/api/docs`.
5. Obtener el documento OpenAPI en JSON, insumo de la siguiente tanda (generación de contratos tipados para el cliente web): `http://localhost:3000/api/docs-json`.

## Recorrido de lectura del código

El flujo de la única operación expuesta se lee de punta a punta sin capas intermedias:

1. `apps/api/src/main.ts`: resuelve y valida la configuración de runtime, crea Nest y aplica la configuración compartida de la app.
2. `apps/api/src/runtime-config.ts`: valida `PORT` y `CORS_ORIGIN`; si son inválidos, lanza un error antes de que `main.ts` cree la aplicación de Nest.
3. `apps/api/src/bootstrap.ts`: fija el prefijo global `/api`, habilita CORS y publica el documento OpenAPI (Swagger UI y JSON). La usan tanto `main.ts` como las pruebas e2e, para no duplicar esta configuración.
4. `apps/api/src/app.module.ts`: módulo raíz que importa `HealthModule`.
5. `apps/api/src/health/health.controller.ts`: recibe la petición HTTP `GET /health` y delega en el servicio.
6. `apps/api/src/health/health.service.ts`: resuelve el estado de disponibilidad.
7. `apps/api/src/health/dto/health-response.dto.ts`: forma documentada de la respuesta, usada tanto en tiempo de ejecución como en el esquema OpenAPI.

## Pruebas

- `apps/api/src/runtime-config.spec.ts`: pruebas unitarias de `PORT` y `CORS_ORIGIN` (valores por defecto, válidos e inválidos).
- `apps/api/src/health/*.spec.ts`: pruebas unitarias del servicio y del controlador.
- `apps/api/test/health.e2e-spec.ts`: recorrido HTTP real de `GET /api/health` sobre una instancia de Nest levantada con la misma configuración (`bootstrap.ts`) que usa `main.ts`.
- `apps/api/test/openapi.e2e-spec.ts`: solicita realmente `/api/docs-json` (documento OpenAPI con la operación `getHealth`) y `/api/docs` (Swagger UI publicado).

Ejecutar todas las pruebas con `pnpm test`.
