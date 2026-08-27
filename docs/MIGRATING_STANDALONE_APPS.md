# Integrar una aplicación al App Shell

Guía operativa para agentes y personas que agregan una aplicación interna a Plataforma Timbo,
sea nueva o la migración de una standalone. Es el patrón vigente, no un plan: `hello-world` y
`lista-precios` son sus dos referencias implementadas.

## Resultado esperado

Una aplicación integrada tiene una sola identidad, sesión y autorización funcional: las del App
Shell. El usuario entra desde el launcher a `/apps/<app-key>`; la API vuelve a comprobar acceso en
cada endpoint y la aplicación conserva sólo su interfaz y lógica de negocio.

No se incorporan dentro del módulo login, OAuth, cookies de sesión, whitelists, encabezados,
logout, paneles administrativos ni secretos propios. Administración gobierna catálogo,
asignaciones, perfiles y permisos; Actividad reúne auditoría y eventos de uso cuando corresponden.

## Antes de modificar código

1. Definir el `app-key` en kebab-case, el nombre visible, la descripción, el `launchPath`
   `/apps/<app-key>` y la decisión concreta que resuelve la aplicación.
2. Separar el alcance en interfaz, endpoints, datos o proveedor externo, permisos funcionales y
   señales. No migrar comportamiento o datos de la app original que no tengan una necesidad actual.
3. Leer [`PLATFORM_ARCHITECTURE.md`](PLATFORM_ARCHITECTURE.md),
   [`OBSERVABILITY_LOGGING.md`](OBSERVABILITY_LOGGING.md) y
   [`CODING_CONVENTIONS.md`](CODING_CONVENTIONS.md). Si hay persistencia, identidad, acceso o un
   contrato durable, revisar primero el recorrido propietario indicado allí.
4. Al reemplazar una standalone, inventariar OAuth, whitelist, proxy, rutas públicas y secretos
   propios. Un secreto expuesto en una variable `VITE_*` se revoca y rota fuera del repositorio;
   moverlo al backend no lo sanea.

## Patrón de implementación

### 1. Catálogo y autorización

La fila en `applications` es la fuente de verdad para nombre, ruta, estado y orden. Debe coincidir
con el `app-key` usado por los módulos y el registro Web.

- Para una aplicación creada como parte de la operación normal, darla de alta desde
  Administración. Esa operación es auditada y luego se asigna a las personas necesarias.
- Para una aplicación que debe existir obligatoriamente en cada instalación nueva, crear una
  migración de datos explícita, como `hello-world` y `lista-precios`. No crearla también por la
  interfaz: se elige una sola vía de alta inicial.
- Crear perfiles y permisos funcionales sólo si la aplicación tiene acciones que requieren esa
  distinción. La asignación de aplicación por sí sola protege el acceso general.

La Web usa `AuthorizedApplication` sólo para presentar rutas autorizadas. La frontera de seguridad
es la API: cada controller de la aplicación usa, a nivel de clase,
`SessionAuthenticationGuard` y `<App>ApplicationAccessGuard`. El guard llama a
`ApplicationAuthorizationService.hasApplicationAccess(userId, '<app-key>')`. Las mutaciones suman
`CsrfProtectionGuard`.

### 2. API: un módulo propietario

Crear `apps/api/src/modules/<app-key>/` y registrarlo en `apps/api/src/app.module.ts`.

| Archivo                                                 | Cuándo y responsabilidad                                                                                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<app>.module.ts`                                       | Siempre. Importa `AuthModule` y `AccessProfilesModule`; registra controller, service y guard. Importa `UsageEventsModule` sólo si produce eventos de uso.       |
| `<app>.controller.ts`                                   | Siempre. Expone rutas bajo `applications/<app-key>/*`, traduce HTTP y delega al service. Los guards viven aquí, no repartidos por rutas.                        |
| `<app>-application-access.guard.ts`                     | Siempre que la app tiene endpoints. Revalida la asignación funcional.                                                                                           |
| `<app>.service.ts`                                      | Coordina la lógica de negocio sin conocer HTTP.                                                                                                                 |
| `dto/*.dto.ts`                                          | Para cada entrada o salida HTTP durable, con decoradores Swagger.                                                                                               |
| `<app>.tokens.ts`, `<app>.config.ts`, `<app>.errors.ts` | Sólo si hay proveedor externo. El token permite sustituir `fetch` en pruebas; config valida variables server-only; errors tipados se traducen en el controller. |

Un proveedor externo se consulta desde la API. Sus variables no llevan prefijo `VITE_`, se
documentan sin valores reales en `.env.example`, fallan de forma explícita si faltan y se redactan
en diagnósticos. `lista-precios` es el ejemplo: intercambia el refresh token de Zoho en backend,
consulta CSV y devuelve filas tipadas; no expone credenciales al navegador.

No crear controllers compartidos entre aplicaciones, depósitos genéricos ni una capa intermedia
sólo para parecer reutilizable. Cada módulo conserva sus pruebas junto al archivo que cubren.

### 3. Contrato y cliente Web

Todo endpoint modifica primero controller/DTO y pruebas API. Luego:

1. ejecutar `pnpm generate:contracts`;
2. consumir `packages/contracts` desde `apps/web/src/api/`;
3. agregar un método explícito a la fachada `ApplicationsApi` y su prueba;
4. ejecutar `pnpm check:contracts` antes de cerrar.

No editar `packages/contracts/openapi.json` ni `src/generated/openapi.ts` a mano. Los componentes
Web nunca escriben rutas HTTP ni cuerpos directamente.

### 4. Interfaz integrada

Crear `apps/web/src/applications/<app-key>/` con un componente raíz que implemente
`ApplicationComponentProps`. Registrar su `launchPath` en `application-registry.tsx`; el
registro reconoce subrutas internas para que los deep links funcionen.

El componente usa `PlatformHeader` con variante `application` y `PlatformSessionBar`. Recibe
sesión, navegación, logout, aplicaciones disponibles y la fachada API desde el Shell. No duplica
ninguno de esos mecanismos ni mantiene un contexto de auth propio.

Las rutas internas, estados de carga/error/vacío, componentes y estilos pertenecen al directorio de
la aplicación. `lista-precios` es la referencia de una app con home, marca, modelos, variantes y
detalle; `hello-world`, la de una interacción pequeña con proveedor externo.

Una variable `VITE_*` sólo puede configurar una preferencia pública de interfaz, como el número y
la plantilla de WhatsApp de Lista de Precios; nunca autorización, identidad, secretos ni tokens.

### 5. Señales y actividad

Elegir la señal antes de programarla:

- Log operativo: diagnostica una falla técnica y respeta la redacción y `X-Request-Id`.
- Auditoría: evidencia una mutación administrativa o de seguridad y se escribe en la misma
  transacción Prisma.
- Evento de uso: mide una interacción que orientará una decisión de producto u operación. Usa
  nombre estable, UUID de evento y visita, catálogo tipado y metadata mínima con allowlist.

Antes de crear una de estas señales, revisar el recorrido completo de `lista-precios`: su hook Web,
el catálogo de uso, `ActivityService` y sus pruebas. Demuestra cómo el log operativo diagnostica
fallas técnicas, el evento de uso mide una interacción acotada y la actividad sólo exporta campos
incluidos en una allowlist. Si la nueva aplicación aprueba, rechaza o cambia un estado relevante,
la señal principal es auditoría transaccional; no se reemplaza por un evento de uso.

No registrar clics por defecto. Si una señal debe aparecer en Actividad o el CSV, ampliar la
proyección y la allowlist de `ActivityService` de forma explícita. `lista-precios` demuestra el
patrón: registra apertura de catálogo, una vista por modelo y visita, e inicio de consulta; el CSV
separa marca y modelo sin almacenar stock, precio, filtro, URL o mensaje de WhatsApp.

## Pruebas y cierre técnico

Antes de declarar terminada una aplicación, comprobar al menos:

- service, guard, controller y errores externos en API; rutas y estados recuperables en Web;
- acceso asignado y denegado; CSRF en mutaciones; rutas internas/deep links;
- contrato regenerado, cliente Web tipado y fallas externas diagnosticadas sin datos sensibles;
- catálogo, idempotencia, metadata y exportación de actividad si hay eventos;
- documentos de alcance, arquitectura, observabilidad, variables de entorno y README actualizados.

Desde la raíz deben pasar `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` y
`pnpm format:check`. Si cambió la API, incluir también `pnpm check:contracts`.

## Corte de una standalone

El corte no se completa al fusionar código. Tras desplegar la aplicación integrada, un responsable
autorizado valida el flujo con usuarios asignados, autorización denegada, proveedor y datos de
actividad. Sólo entonces se retiran el deploy, dominio, variables y credenciales de la standalone.
Esa baja es una operación externa y debe confirmarse en la plataforma de despliegue; no se infiere
del estado de este repositorio.

## Referencias reales

| Referencia                                           | Qué muestra                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/api/src/modules/hello-world/`                  | Módulo protegido, proveedor público sin secreto y evento ligado a una acción.                    |
| `apps/api/src/modules/lista-precios/`                | Guard de aplicación, configuración server-only, Zoho, DTOs, rutas y analítica comercial acotada. |
| `apps/web/src/applications/hello-world/`             | Componente integrado mínimo y fallas recuperables.                                               |
| `apps/web/src/applications/lista-precios/`           | Rutas internas, navegación dentro de la app, carga de catálogo y deduplicación de uso.           |
| `apps/web/src/applications/application-registry.tsx` | Registro de launch paths y soporte de deep links.                                                |
| `apps/api/src/modules/administration/`               | Catálogo, asignaciones, perfiles, permisos, auditoría y Actividad.                               |
