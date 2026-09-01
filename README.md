# App Shell Plataforma Timbo

Monorepo privado de la Plataforma Timbo, administrado con **pnpm workspaces** (sin Turbo ni Nx).

Plataforma Timbo es un App Shell empresarial que centraliza identidad, seguridad, administración
y experiencia para las aplicaciones internas de Timbo. El estado vigente incluye acceso con
Google para usuarios preautorizados, sesiones persistentes, administración de usuarios, rol de
administrador de plataforma, observabilidad operativa, auditoría, eventos de uso y consulta
administrativa de actividad y catálogo gobernado de aplicaciones internas.

El catálogo incluye `Hello World` como integración técnica en `/apps/hello-world`: su acción
principal registra el uso idempotente `hello-world.joke_requested`, obtiene un chiste en inglés
desde icanhazdadjoke y lo traduce al español con MyMemory, sin claves de API.
También incluye `Lista de Precios` en `/apps/lista-precios`: consulta el catálogo autorizado de
vehículos; el modelo HOWO NX de SINOTRUK permite elegir la suspensión antes de consultar sus
variantes. Registra aperturas, vistas únicas de modelo por visita e inicios de consulta, sin
persistir unidades de stock, filtros, precios ni mensajes de WhatsApp.
`Meta Company` en `/apps/meta-company` administra las metas comerciales que consume Power BI. Sus
perfiles permiten editar metas y, para administradores, crear y activar o desactivar marcas y
negocios. La aplicación usa temporalmente un proveedor PostgreSQL aislado; sus auditorías se
conservan en la base central de la plataforma.
Administración permite asignar aplicaciones a empleados y gestionar sus perfiles y permisos
funcionales. El Home autenticado presenta solamente las aplicaciones activas asignadas al usuario
y abre sus rutas internas. Consultar [`docs/PLATFORM_ARCHITECTURE.md`](docs/PLATFORM_ARCHITECTURE.md)
para el alcance y los recorridos vigentes.

## Estado funcional

- **Identidad:** OAuth con Google, preautorización corporativa, sesiones y logout.
- **Administración:** usuarios, aplicaciones internas, asignaciones, perfiles y permisos
  funcionales, activación/desactivación y actividad consolidada.
- **Acceso:** perfil de sistema `PLATFORM_ADMIN`, autorización funcional por aplicación y launcher
  filtrado por asignaciones activas.
- **Observabilidad:** logs JSON de API y gateway, diagnósticos estructurados en el navegador,
  redacción segura y correlación por `X-Request-Id`.
- **Datos de actividad:** auditoría persistente para operaciones administrativas, incluidas las de
  Meta Company, y eventos de uso idempotentes para Hello World y Lista de Precios; la exportación
  CSV entrega visita, objetivo, marca y modelo en columnas separadas cuando corresponden.
- **Experiencia:** acceso corporativo, launcher de aplicaciones autorizadas, superficies de
  Administración, `Hello World`, `Lista de Precios` y `Meta Company`.

## Documentación

- [`docs/PLATFORM_ARCHITECTURE.md`](docs/PLATFORM_ARCHITECTURE.md): alcance vigente, componentes y
  recorridos principales.
- [`docs/USING_REPOSITORY_DOCUMENTATION.md`](docs/USING_REPOSITORY_DOCUMENTATION.md): mapa de
  lectura para elegir las fuentes y propietarios correctos antes de cambiar algo.
- [`docs/OBSERVABILITY_LOGGING.md`](docs/OBSERVABILITY_LOGGING.md): logs operativos, auditoría,
  eventos de uso y guía para agregar nuevas señales.
- [`docs/MIGRATING_STANDALONE_APPS.md`](docs/MIGRATING_STANDALONE_APPS.md): receta operativa para
  agregar una aplicación nueva o migrar una standalone al App Shell.
- [`docs/CODING_CONVENTIONS.md`](docs/CODING_CONVENTIONS.md): reglas de implementación.
- [`docs/RAILWAY_DEPLOYMENT.md`](docs/RAILWAY_DEPLOYMENT.md): despliegue y promoción de entornos.

## Requisitos

- [Node.js](https://nodejs.org/) **24 o superior** (declarado en `engines.node`; probado con Node 24.13.0). Es el mínimo real que soporta toda la cadena de herramientas instalada (ESLint 10, `--env-file-if-exists`, etc.).
- [pnpm](https://pnpm.io/) **11.22.0 exacto**, fijado en `packageManager` de `package.json`. `corepack pnpm <comando>` respeta ese valor automáticamente. Además, `pnpm` está listado como devDependency (también fijado a `11.22.0`, sin rango) porque este entorno no tiene un shim global de `pnpm` en el `PATH`: los scripts raíz que delegan en `pnpm -r` / `pnpm --filter` (recursión de workspace, sin Turbo ni Nx) necesitan resolver el binario `pnpm` desde `node_modules/.bin`.

## Instalación

```bash
pnpm install
```

## Variables de entorno

Copiar `.env.example` a `.env` (en la **raíz del workspace**) y ajustar si es necesario. `DATABASE_URL` es un secreto y no se debe copiar a documentación, logs ni control de versiones.

| Variable                      | Descripción                                                                                                              | Valor por defecto       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `PORT`                        | Puerto de la API o del gateway, según el proceso.                                                                        | API `3000`, Web `4173`  |
| `CORS_ORIGIN`                 | Origen permitido por CORS para el cliente web local.                                                                     | `http://localhost:5173` |
| `VITE_API_BASE_URL`           | Origen que usa la web local para llamar a la API.                                                                        | `http://localhost:3000` |
| `API_INTERNAL_ORIGIN`         | Origen interno de la API para el gateway de `apps/web/server` (`/api/*`). Server-only; no se carga desde el `.env` raíz. | Sin valor por defecto   |
| `DATABASE_URL`                | URL secreta de PostgreSQL para la API y las migraciones.                                                                 | Sin valor por defecto   |
| `GOOGLE_OAUTH_CLIENT_ID`      | Identificador del cliente OAuth de Google.                                                                               | Sin valor por defecto   |
| `GOOGLE_OAUTH_CLIENT_SECRET`  | Secreto del cliente OAuth de Google.                                                                                     | Sin valor por defecto   |
| `GOOGLE_OAUTH_REDIRECT_URI`   | Callback exacto `/api/auth/google/callback`; HTTPS fuera de localhost.                                                   | Sin valor por defecto   |
| `NODE_ENV`                    | Etiqueta del entorno incluida en logs; no decide controles de seguridad.                                                 | `development`           |
| `CORPORATE_EMAIL_DOMAIN`      | Dominio corporativo exigido al preautorizar y vincular identidad Google.                                                 | `timbo.com.py`          |
| `VITE_CORPORATE_EMAIL_DOMAIN` | Dominio corporativo mostrado y validado previamente por la Web; debe coincidir con `CORPORATE_EMAIL_DOMAIN` de la API.   | `timbo.com.py`          |

El `.env` raíz se carga con el flag nativo de Node `--env-file-if-exists` para la API y Vite lo usa también como directorio de variables de la web. No se agrega `dotenv` ni `@nestjs/config`. Los scripts `dev` y `start` de `apps/api` lo invocan apuntando a `../../.env` (la ruta del `.env` raíz vista desde `apps/api`); si el archivo no existe, Node continúa sin él, pero la API aborta porque la base y OAuth son obligatorios. Antes de crear Nest, `apps/api/src/runtime-config.ts` valida puerto, origen CORS, URL PostgreSQL y configuración de Google sin mostrar secretos ante un error. La web valida `VITE_API_BASE_URL`; el gateway productivo valida `API_INTERNAL_ORIGIN` y nunca lo expone al navegador.

## Comandos raíz

| Comando                                                                        | Descripción                                                                                                             |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                                     | Levanta `apps/api` en modo desarrollo, con reinicio automático ante cambios.                                            |
| `pnpm dev:web`                                                                 | Levanta `apps/web` con Vite.                                                                                            |
| `pnpm start:api`                                                               | Inicia la API compilada; Railway usa este recorrido con su `PORT`.                                                      |
| `pnpm start:web`                                                               | Sirve la SPA compilada y reenvía `/api/*` a `API_INTERNAL_ORIGIN` (gateway de mismo origen; puerto `4173` por defecto). |
| `pnpm generate:contracts`                                                      | Exporta OpenAPI desde Nest y regenera el documento y los tipos versionados.                                             |
| `pnpm check:contracts`                                                         | Comprueba en un directorio temporal que los contratos versionados están actualizados.                                   |
| `pnpm prisma:validate`                                                         | Valida el schema Prisma de la API.                                                                                      |
| `pnpm prisma:generate`                                                         | Regenera el cliente Prisma local e ignorado.                                                                            |
| `pnpm prisma:migrate:deploy`                                                   | Aplica migraciones versionadas pendientes; es el pre-deploy de la API.                                                  |
| `pnpm --filter @timbo/api preauthorize-user -- --corporate-email <correo>`     | Preautoriza un usuario corporativo mediante el comando auditado.                                                        |
| `pnpm --filter @timbo/api assign-platform-admin -- --corporate-email <correo>` | Asigna el primer administrador; luego Administración puede gestionar administradores adicionales.                       |
| `pnpm --filter @timbo/api test:users:integration`                              | Ejecuta la integración con escritura, opt-in y sólo para development.                                                   |
| `pnpm build`                                                                   | Compila todos los paquetes del workspace.                                                                               |
| `pnpm typecheck`                                                               | Verifica los tipos de TypeScript sin emitir archivos.                                                                   |
| `pnpm lint`                                                                    | Ejecuta ESLint sobre todo el repositorio.                                                                               |
| `pnpm test`                                                                    | Ejecuta las pruebas de todos los paquetes del workspace.                                                                |
| `pnpm format`                                                                  | Formatea el repositorio con Prettier.                                                                                   |
| `pnpm format:check`                                                            | Verifica el formato sin modificar archivos.                                                                             |

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
    prisma/              # Schema y migraciones versionadas de PostgreSQL
    src/
      main.ts            # Valida configuración, crea Nest y aplica bootstrap.ts
      runtime-config.ts  # Configuración validada de API, base, OAuth y sesión
      bootstrap.ts       # Prefijo, CORS, Swagger y configuración compartida con e2e
      health/            # Disponibilidad de la API
      modules/
        access-profiles/ # Perfil de administrador de plataforma
        administration/ # Usuarios, catálogo de aplicaciones y actividad unificada
        audit-events/    # Catálogo y persistencia transaccional de auditoría
        auth/            # Google OAuth, sesiones, cookie, CSRF y guards
        hello-world/     # Endpoint protegido y proveedores externos del ejemplo
        lista-precios/   # Catálogo Zoho protegido y analítica de recorrido comercial
        observability/   # Contexto de petición y log operativo de API
        usage-events/    # Catálogo y persistencia idempotente de uso
        users/           # Usuarios preautorizados y estado de acceso
    test/                # Pruebas e2e e integración opt-in
  web/                  # Web React/Vite (paquete @timbo/web)
    src/
      api/              # Transporte tipado para auth, applications, administration y system
      browser-diagnostics.ts # Diagnóstico seguro y estructurado de operaciones de interfaz
      applications/     # Registro, autorización de rutas y aplicaciones internas
        hello-world/    # Interfaz y estilos propios del ejemplo Hello World
        lista-precios/  # Catálogo, rutas internas y recorrido comercial de vehículos
      home/             # Launcher de aplicaciones autorizadas
      app.tsx           # Acceso, sesión y navegación principal
      applications-panel.tsx # Catálogo administrativo de aplicaciones
    server/              # Gateway HTTP productivo (Node, sin bundlear): sirve la SPA y
                         # reenvía /api/* a API_INTERNAL_ORIGIN para que el navegador use
                         # siempre el origen de web (apps/web/server/start.ts es el arranque)
packages/
  contracts/            # Documento OpenAPI y tipos generados, ambos versionados
    src/generated/      # Salida de openapi-typescript; no se edita manualmente
  observability/        # Funciones puras compartidas de correlación y redacción
scripts/
  check-contracts.mjs   # Regenera temporalmente y compara sin ensuciar el workspace
docs/
  PLATFORM_ARCHITECTURE.md  # Alcance y recorridos vigentes
  OBSERVABILITY_LOGGING.md  # Logs, auditoría y analítica de uso
  CODING_CONVENTIONS.md     # Convenciones de código durables
  MIGRATING_STANDALONE_APPS.md # Guía para integrar aplicaciones internas
  RAILWAY_DEPLOYMENT.md     # Despliegue y promoción de entornos
AGENTS.md                 # Reglas durables para agentes que trabajen en este repositorio
```

## Recorrido para ejecutar y comprobar la integración

1. Instalar dependencias: `pnpm install`.
2. Generar el contrato si cambió la API: `pnpm generate:contracts`. Para comprobar que lo versionado está actualizado sin escribir archivos: `pnpm check:contracts`.
3. Configurar en el `.env` local `DATABASE_URL` y las variables de Google OAuth. El callback local debe terminar en `/api/auth/google/callback`.
4. Levantar la API en modo desarrollo: `pnpm dev` (por defecto, `http://localhost:3000`).
5. En otra terminal, levantar la web: `pnpm dev:web` (por defecto, `http://localhost:5173`). La pantalla verifica la sesión y, si no existe, ofrece el acceso con Google.
6. Preautorizar el usuario corporativo con `pnpm --filter @timbo/api preauthorize-user -- --corporate-email <correo>` y asignar el primer administrador con `pnpm --filter @timbo/api assign-platform-admin -- --corporate-email <correo>`. Los administradores posteriores se gestionan desde Administración. Estos comandos no deben apuntar a una base ajena al entorno autorizado.
7. Ingresar con la misma cuenta de Google preautorizada. El Home muestra las aplicaciones activas
   asignadas a esa cuenta. `/admin`, `/admin/applications` y `/admin/activity` quedan protegidos por
   el perfil de administrador; desde Usuarios se administran asignaciones y perfiles funcionales.
   `/apps/hello-world` sólo se presenta cuando está asignada. Su botón llama al endpoint protegido
   `GET /api/applications/hello-world/joke`, que vuelve a validar la asignación en la API antes de
   consultar icanhazdadjoke. La Web envía únicamente el texto público obtenido a MyMemory desde el
   navegador, con credenciales y referrer omitidos, para no depender de la cuota del IP de salida
   compartido del servidor. Ninguno de los dos proveedores requiere clave; sus límites o
   indisponibilidad se presentan como un error recuperable y no se registra el contenido del
   chiste. `/apps/lista-precios` también requiere asignación: carga el catálogo desde el endpoint
   protegido de la aplicación y registra sólo apertura, vistas deduplicadas de modelo e inicio de
   consulta. Administración muestra y exporta marca y modelo en columnas separadas.
8. Consultar el estado de disponibilidad: `GET http://localhost:3000/api/health`. Debe responder `200` con un cuerpo como:

   ```json
   { "status": "ok", "timestamp": "2026-08-17T20:36:55.847Z" }
   ```

9. Explorar la documentación navegable (Swagger UI): `http://localhost:3000/api/docs`.
10. Obtener el documento OpenAPI en JSON: `http://localhost:3000/api/docs-json`.

## Recorrido de lectura del código

Para una visión de conjunto, empezar por
[`docs/PLATFORM_ARCHITECTURE.md`](docs/PLATFORM_ARCHITECTURE.md). Los recorridos concretos son:

1. **Arranque y configuración:** `main.ts` → `runtime-config.ts` → `bootstrap.ts` → `app.module.ts`.
2. **Identidad:** `modules/auth/auth.controller.ts` → `auth.service.ts` → usuarios, intentos OAuth y sesiones.
3. **Administración:** controllers de `modules/administration` → `UsersService`,
   `ApplicationsService`, `AccessProfilesService` o `ActivityService`.
4. **Auditoría:** operación propietaria → transacción Prisma → `AuditEventsService` → `AUDIT_EVENT_CATALOG`.
5. **Uso:** productor de aplicación → `UsageEventsService` → catálogo tipado → persistencia idempotente.
6. **Observabilidad:** middleware, gateway o frontera de interfaz → contexto seguro y `requestId` cuando existe → emisor propio → funciones puras de `@timbo/observability`.
7. **Contrato Web/API:** controller y DTO → `export-openapi.ts` → `packages/contracts` → fachada de `apps/web/src/api`.

## Pruebas

- La API cubre configuración, health, identidad, sesiones, guards, administración, perfiles,
  Hello World, Lista de Precios, observabilidad, auditoría y eventos de uso con pruebas unitarias
  y e2e offline; los proveedores externos se sustituyen por respuestas controladas en la suite.
- Las integraciones que escriben en PostgreSQL usan runners separados y guardas explícitas de
  development. La suite ordinaria no abre conexiones a la base.
- La Web cubre transporte tipado, autenticación, Home, gestión de usuarios, catálogo de
  aplicaciones, asignaciones, perfiles, permisos, Hello World, Lista de Precios y actividad,
  incluidos estados de carga, acceso denegado, error y vacío.
- El gateway se prueba contra upstreams locales para reenvío de método, cuerpo, headers, cookies,
  correlación, estáticos, timeout y respuesta `502` explícita.
- `packages/observability` prueba generación y validación de `requestId`, normalización de rutas,
  diagnósticos y redacción de secretos y PII.
- `packages/contracts` regenera en un directorio temporal y compara OpenAPI y tipos con los
  artefactos versionados.

Ejecutar todas las pruebas con `pnpm test`.

## Despliegue

El repositorio se despliega en Railway como dos servicios llamados `api` y `web`, ambos desde la
raíz compartida del monorepo. La configuración como código vive en
`apps/api/railway.json` y `apps/web/railway.json`.

La API requiere `DATABASE_URL` y ejecuta las migraciones versionadas pendientes en el pre-deploy. Consultar
[`docs/RAILWAY_DEPLOYMENT.md`](docs/RAILWAY_DEPLOYMENT.md) para el flujo vigente de `desarrollo` hacia
development y la promoción autorizada a `main`/production, además de las referencias privadas de PostgreSQL.
