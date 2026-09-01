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
- asignaciones de aplicaciones a empleados y administración de perfiles y permisos funcionales;
- log operativo estructurado y correlación por `X-Request-Id`;
- auditoría persistente de operaciones de identidad y acceso;
- persistencia validada e idempotente de eventos de uso;
- consulta administrativa unificada de auditoría y uso, con filtros, métricas y exportación CSV;
- contratos OpenAPI generados y consumidos de forma tipada por la Web;
- launcher que presenta las aplicaciones activas asignadas al usuario autenticado;
- aplicación `Hello World` en `/apps/hello-world` como comprobación del App Shell y de una
  integración externa sin clave de API;
- aplicación `Lista de Precios` en `/apps/lista-precios`, con rutas internas para marcas, modelos,
  variantes y detalle de vehículos.
- aplicación `Meta Company` en `/apps/meta-company`, para administrar metas comerciales,
  marcas y negocios que consume Power BI.

`Hello World` continúa como comprobación técnica y productor de uso para una integración externa.
`Lista de Precios` es la primera aplicación de negocio migrada y registra sólo hitos comerciales
acotados, no clics ni contenido de catálogo completo.
`Meta Company` usa de forma temporal un proveedor PostgreSQL separado de la base central; la API
mantiene las reglas de acceso y las auditorías administrativas en la plataforma, para que el
proveedor pueda sustituirse posteriormente por Service Layer.

## Componentes del workspace

### `apps/api`

API NestJS y única propietaria de PostgreSQL y Prisma. Sus módulos vigentes son:

- `health`: disponibilidad de la API;
- `auth`: OAuth con Google, cookie de sesión, logout, CSRF y traducción de errores públicos;
- `hello-world`: endpoint funcional protegido y obtención de chistes desde icanhazdadjoke;
- `lista-precios`: catálogo protegido de vehículos desde Zoho Analytics y eventos de uso del
  recorrido comercial;
- `meta-company`: metas comerciales y catálogos de marcas y negocios en un proveedor aislado;
- `users`: preautorización, consulta y cambios administrativos de usuarios;
- `access-profiles`: perfil de sistema `PLATFORM_ADMIN` y autorización funcional por aplicación;
- `administration`: endpoints protegidos para usuarios, aplicaciones, asignaciones, perfiles,
  permisos y actividad;
- `observability`: contexto de petición y log operativo de la API;
- `audit-events`: catálogo y persistencia transaccional de auditoría;
- `usage-events`: catálogo y persistencia idempotente de analítica de uso.

Controllers y guards traducen HTTP y acceso; los services coordinan las operaciones. Prisma vive
sólo en esta aplicación. No se agregan capas genéricas entre esas responsabilidades.

### `apps/web`

SPA React/Vite que presenta acceso corporativo, launcher autorizado, administración de usuarios,
aplicaciones, asignaciones, perfiles y permisos, consulta de actividad, `Hello World`, `Lista de
Precios` y `Meta Company`. El launcher vive en `src/home/`; el registro, el control de rutas y
cada interfaz integrada viven en `src/applications/`, incluidas `hello-world/`, `lista-precios/`
y `meta-company/`. `src/api/`
encapsula rutas y tipos generados: los componentes no escriben endpoints HTTP manualmente.

En producción, `server/` sirve la SPA y actúa como gateway de mismo origen para `/api/*`. El
gateway reenvía cookies y preserva el `X-Request-Id` resuelto, pero no contiene lógica de negocio
ni consulta PostgreSQL.

### Regla de integración para aplicaciones internas

Toda aplicación integrada se registra en `src/applications/application-registry.tsx` y recibe la
proyección `AuthorizedApplication` ya autorizada por el App Shell. La interfaz debe usar
`PlatformHeader` con la variante `application`: el nombre viene del catálogo, la marca vuelve al
Inicio y la sesión permanece bajo control compartido. No se copian encabezados ni se reproduce la
lógica de navegación o cierre de sesión dentro de cada aplicación.

La aplicación conserva únicamente su área de trabajo y sus estados propios. En la API, cada ruta
funcional vuelve a validar asignación y permisos; la proyección Web no es una frontera de seguridad.
Si una interacción necesita analítica, su productor define un evento específico de la aplicación,
con UUID de evento y visita, catálogo tipado y allowlist mínima. Nunca se registran cuerpos,
contenido de negocio, texto de traducción, correos ni otros datos personales por conveniencia.
La receta operativa para incorporar otra aplicación está en
[`MIGRATING_STANDALONE_APPS.md`](MIGRATING_STANDALONE_APPS.md).

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
autorización efectiva siempre pertenece a la API. El comando de inicialización conserva la
asignación del primer administrador; después, un administrador vigente puede otorgar o revocar el
rol a otras personas activas. No se permite auto-revocación ni dejar la plataforma sin un
administrador activo. Una persona con ese rol debe perderlo antes de ser desactivada.

El catálogo persiste `key`, nombre, descripción opcional, ruta interna, estado y orden. `key` es
inmutable, toda ruta comienza con `/apps/`, y las aplicaciones se activan o desactivan sin borrado.
Cada mutación se audita dentro de la misma transacción. El catálogo todavía no concede acceso: esa
decisión corresponde a `UserApplicationAssignment`.

Cada aplicación puede definir permisos y perfiles funcionales. Un perfil agrupa permisos de su
misma aplicación y puede asociarse solamente a una persona que ya tenga la aplicación asignada.
Quitar la asignación elimina también sus perfiles funcionales para esa aplicación.
`ApplicationAuthorizationService` comprueba en la API la aplicación, asignación, perfil y permiso
activos; `PLATFORM_ADMIN` no omite esa autorización. La Web administrativa permite gobernar estas
relaciones. `GET /api/applications` proyecta para el usuario autenticado únicamente aplicaciones
activas que tengan una asignación vigente, respetando el orden administrativo; no expone estado,
fechas ni identificadores internos del catálogo. El Home consume esa proyección como launcher.

La Web también evita presentar una ruta `/apps/*` que no figure en esa proyección. Esa comprobación
es experiencia de usuario, no una frontera de seguridad: cada API funcional de una aplicación debe
seguir verificando acceso y permisos mediante `ApplicationAuthorizationService`.

`POST /api/applications/hello-world/joke` aplica `SessionAuthenticationGuard`, CSRF y vuelve a
comprobar la asignación activa de `hello-world` mediante `ApplicationAuthorizationService`. La Web
envía un `eventId` y un `visitId` UUID para registrar `hello-world.joke_requested`; tanto un evento
duplicado como un fallo de persistencia no impiden la acción principal. Después obtiene un chiste en
inglés desde icanhazdadjoke. Con ese resultado autorizado, la Web solicita directamente
la traducción inglés-español a MyMemory: no envía cookies, credenciales, referrer, identidad ni datos
de sesión, solamente el texto público del chiste. Esta separación evita consumir la cuota anónima
desde el IP de salida compartido de Railway, que puede estar limitado aunque el usuario todavía
disponga de cuota desde su propia red.

Es una demostración sin secretos ni configuración adicional: ambos proveedores se consumen sin
clave, cada llamada tiene un timeout de ocho segundos y la Web respeta el máximo de 500 bytes de
MyMemory. Una falla externa se presenta como recuperable. El texto original y traducido no se
incorpora a logs, auditoría ni eventos de uso.

### Auditoría, uso y actividad

Los eventos de auditoría se validan contra `AUDIT_EVENT_CATALOG` y se escriben con la misma
transacción Prisma que la operación relevante. Así no existe un cambio administrativo confirmado
sin su evidencia de auditoría, ni auditoría de un cambio que finalmente hizo rollback.

Los eventos de uso se validan contra el catálogo inyectado en `UsageEventsModule`. `eventId`
permite reintentos idempotentes y un fallo inesperado de persistencia se convierte en resultado
`failed`, acompañado por un diagnóstico operativo seguro. El catálogo productivo actual define
`hello-world.joke_requested`, sin objetivo ni metadata, porque sólo necesita medir la solicitud.
Lista de Precios agrega `lista-precios.catalog_opened` una vez por visita,
`lista-precios.model_viewed` una vez por modelo y visita, y
`lista-precios.consultation_started` al abrir la consulta. Los dos últimos usan el objetivo
`vehicle_model` con una clave normalizada `marca|modelo` y metadata tipada `brand`/`model` para la
exportación administrativa; no conservan stock, filtros, precios ni mensajes.

Administración consulta ambas tablas mediante una proyección unificada. La respuesta redacta la
metadata por allowlist y la exportación CSV protege contra fórmulas; para Lista de Precios expone
explícitamente visita, tipo/id de objetivo, marca y modelo en columnas separadas, sin revelar la
metadata cruda persistida.

## Persistencia y contratos

PostgreSQL guarda usuarios, aplicaciones, intentos OAuth, sesiones, perfiles de sistema y de
aplicación, permisos, asignaciones de aplicaciones y perfiles, auditoría y uso. Las migraciones
versionadas son la única forma de cambiar producción. Algunas invariantes viven como `CHECK` SQL
porque Prisma no puede expresarlas declarativamente; deben preservarse al revisar una migración.

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
