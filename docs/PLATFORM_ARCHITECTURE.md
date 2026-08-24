# Arquitectura vigente de Plataforma Timbo

Este documento describe el sistema que existe hoy. No es un roadmap ni presupone módulos
futuros. Su objetivo es orientar cambios de producto y dar a los agentes un recorrido confiable
antes de modificar identidad, acceso, persistencia, contratos u observabilidad.

## Propósito y límites actuales

Plataforma Timbo es un App Shell empresarial: centraliza identidad, seguridad, administración y
experiencia para las aplicaciones internas de Timbo. El incremento vigente incluye:

- acceso con Google para usuarios previamente autorizados;
- sesiones persistentes mediante cookie segura;
- administración de usuarios y asignación inicial del administrador de plataforma;
- catálogo administrativo de aplicaciones internas, sin borrado físico;
- log operativo estructurado y correlación por `X-Request-Id`;
- auditoría persistente de operaciones de identidad y acceso;
- persistencia validada e idempotente de eventos de uso;
- consulta administrativa unificada de auditoría y uso, con filtros, métricas y exportación CSV;
- contratos OpenAPI generados y consumidos de forma tipada por la Web;
- aplicación `Hello World` en `/apps/hello-world` como comprobación mínima del App Shell.

Todavía no existen los perfiles y permisos funcionales completos, las asignaciones de aplicaciones
a empleados ni una aplicación de negocio migrada al App Shell. `Hello World` es una comprobación
técnica, no una aplicación de negocio. El Home autenticado representa ese límite con un estado vacío; la
infraestructura de eventos de uso existe, pero el catálogo productivo permanece vacío hasta que
se incorpore el primer productor real.

## Componentes del workspace

### `apps/api`

API NestJS y única propietaria de PostgreSQL y Prisma. Sus módulos vigentes son:

- `health`: disponibilidad de la API;
- `auth`: OAuth con Google, cookie de sesión, logout, CSRF y traducción de errores públicos;
- `users`: preautorización, consulta y cambios administrativos de usuarios;
- `access-profiles`: perfil de sistema `PLATFORM_ADMIN` y su asignación inicial;
- `administration`: endpoints protegidos para usuarios, aplicaciones y actividad;
- `observability`: contexto de petición y log operativo de la API;
- `audit-events`: catálogo y persistencia transaccional de auditoría;
- `usage-events`: catálogo y persistencia idempotente de analítica de uso.

Controllers y guards traducen HTTP y acceso; los services coordinan las operaciones. Prisma vive
sólo en esta aplicación. No se agregan capas genéricas entre esas responsabilidades.

### `apps/web`

SPA React/Vite que presenta acceso corporativo, Home, administración de usuarios y aplicaciones,
consulta de actividad y `Hello World`. `src/api/` encapsula rutas y tipos generados: los
componentes no escriben endpoints HTTP manualmente.

En producción, `server/` sirve la SPA y actúa como gateway de mismo origen para `/api/*`. El
gateway reenvía cookies y preserva el `X-Request-Id` resuelto, pero no contiene lógica de negocio
ni consulta PostgreSQL.

### `packages/contracts`

Contiene `openapi.json` y los tipos TypeScript generados desde la API. Ambos artefactos se
versionan y nunca se editan manualmente. Un cambio de contrato se realiza en los controllers o
DTOs de Nest, se regenera y se comprueba con `pnpm check:contracts`.

### `packages/observability`

Contiene funciones puras compartidas para `requestId`, rutas seguras y redacción de diagnósticos.
No contiene servidores, middlewares ni loggers: API y gateway conservan emisores propios porque
sus ciclos de vida y dependencias son distintos.

## Recorridos principales

### Petición y correlación

En desarrollo, el navegador servido por Vite llama a la API usando `VITE_API_BASE_URL`. En
producción, el navegador llama al gateway Web en el mismo origen y éste reenvía `/api/*` al origen
interno configurado.

El gateway y la API validan `X-Request-Id`. Si el valor entrante no cumple el contrato seguro, lo
reemplazan por un UUID. La API publica el identificador mediante `RequestContextService`, por lo
que services de auditoría, uso y diagnóstico pueden correlacionar una operación sin depender del
objeto HTTP.

### Identidad y sesión

1. La Web dirige al navegador a `GET /api/auth/google`.
2. La API crea un intento OAuth de un solo uso y redirige a Google.
3. El callback valida estado, PKCE e identidad corporativa.
4. El usuario debe existir, estar activo y coincidir con la identidad previamente autorizada.
5. La API crea una sesión persistente, emite la cookie y registra la auditoría correspondiente.
6. `SessionAuthenticationGuard` resuelve la identidad en las rutas protegidas; las mutaciones
   basadas en cookie también usan `CsrfProtectionGuard`.

### Administración y autorización vigente

`PlatformAdministratorGuard` comprueba en PostgreSQL que el usuario autenticado y activo tenga
asignado el perfil de sistema `PLATFORM_ADMIN`. Ese guard protege la gestión de usuarios, el
catálogo de aplicaciones y la consulta de actividad. La Web puede adaptar la experiencia, pero la
autorización efectiva siempre pertenece a la API.

El catálogo persiste `key`, nombre, descripción opcional, ruta interna, estado y orden. `key` es
inmutable, toda ruta comienza con `/apps/`, y las aplicaciones se activan o desactivan sin borrado.
Cada mutación se audita dentro de la misma transacción. El catálogo todavía no concede acceso: esa
decisión corresponde al incremento de asignaciones.

El modelo actual no representa acceso por aplicación ni permisos funcionales. Agregar esas
capacidades requiere un incremento explícito y no debe inferirse a partir de `PLATFORM_ADMIN`.

### Auditoría, uso y actividad

Los eventos de auditoría se validan contra `AUDIT_EVENT_CATALOG` y se escriben con la misma
transacción Prisma que la operación relevante. Así no existe un cambio administrativo confirmado
sin su evidencia de auditoría, ni auditoría de un cambio que finalmente hizo rollback.

Los eventos de uso se validan contra el catálogo inyectado en `UsageEventsModule`. `eventId`
permite reintentos idempotentes y un fallo inesperado de persistencia se convierte en resultado
`failed`, acompañado por un diagnóstico operativo seguro. El catálogo productivo está vacío hasta
incorporar una aplicación que defina eventos concretos.

Administración consulta ambas tablas mediante una proyección unificada. La respuesta redacta la
metadata por allowlist y la exportación CSV protege contra fórmulas; no expone la metadata cruda
persistida.

## Persistencia y contratos

PostgreSQL guarda usuarios, aplicaciones, intentos OAuth, sesiones, perfiles, asignaciones de
perfil, auditoría y uso. Las migraciones versionadas son la única forma de cambiar producción. Algunas invariantes
viven como `CHECK` SQL porque Prisma no puede expresarlas declarativamente; deben preservarse al
revisar una migración.

La API es la fuente del contrato HTTP. El flujo correcto es:

1. modificar controller, DTO y comportamiento;
2. agregar o actualizar pruebas;
3. ejecutar `pnpm generate:contracts`;
4. consumir los tipos generados desde `apps/web/src/api/`;
5. comprobar el resultado con `pnpm check:contracts` y los checks obligatorios.

## Dónde leer antes de cambiar

Las asignaciones de aplicación determinan si una persona puede verla y entrar. Los perfiles y
permisos funcionales determinan qué acciones puede realizar dentro de ella. `PLATFORM_ADMIN` es
un perfil de sistema y no omite esa autorización funcional; la API valida siempre usuario,
aplicación, asignación, perfil y permiso activos.

| Cambio                     | Recorrido inicial                                                              |
| -------------------------- | ------------------------------------------------------------------------------ |
| Identidad o sesión         | `modules/auth` → `modules/users` → modelos `OAuthLoginAttempt` y `UserSession` |
| Administración             | `modules/administration` → aplicaciones, perfiles y usuarios                   |
| Persistencia               | `prisma/schema.prisma` → migraciones versionadas → service propietario         |
| Contrato Web/API           | controller y DTO → `packages/contracts` → `apps/web/src/api`                   |
| Log, auditoría o analítica | `docs/OBSERVABILITY_LOGGING.md` → catálogo y service correspondiente           |
| Despliegue                 | `docs/RAILWAY_DEPLOYMENT.md` → `apps/*/railway.json`                           |

Para todo cambio siguen vigentes `AGENTS.md` y `docs/CODING_CONVENTIONS.md`.
