# Observabilidad, auditoría y analítica de uso

Contrato vigente y guía de contribución para las tres señales de Plataforma Timbo: log operativo,
auditoría y eventos de uso. No son nombres intercambiables ni copias del mismo dato; cada señal
responde una pregunta distinta y tiene un destino y una semántica de fallo propios.

## Elegir la señal correcta

| Señal         | Pregunta                                                                                          | Destino                                                                                | Regla de consistencia                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Log operativo | ¿Qué ocurrió técnicamente y cómo se diagnostica?                                                  | JSON en stdout/stderr de API o gateway; diagnóstico seguro en la consola del navegador | Un fallo del logger no convierte una operación empresarial en éxito ni habilita un default engañoso.                          |
| Auditoría     | ¿Quién realizó o intentó una acción relevante de seguridad o administración y sobre qué objetivo? | `audit_events` en PostgreSQL                                                           | Se escribe en la misma transacción que el cambio relevante. Si una parte falla, ambas hacen rollback.                         |
| Evento de uso | ¿Cómo se utiliza una aplicación para orientar producto y operación?                               | `usage_events` en PostgreSQL                                                           | Es idempotente por `eventId`; un fallo de persistencia devuelve `failed` y genera diagnóstico, sin fingir que fue registrado. |

Una operación puede necesitar más de una señal. Por ejemplo, una mutación administrativa puede
producir auditoría transaccional y también quedar incluida en la finalización HTTP operativa. Eso
no autoriza a copiar cuerpos, metadata o errores completos entre señales. Cada dato debe tener un
consumidor concreto y pasar por el contrato más restrictivo que corresponda.

No se usa auditoría para métricas técnicas, log operativo para decisiones de autorización ni
analítica de uso como evidencia de seguridad.

## Arquitectura del log operativo

Las funciones puras de `requestId`, normalización de ruta, redacción de secretos/PII y
construcción de campos de diagnóstico viven en `packages/observability/src/` y las consumen
API, gateway y navegador. `apps/api` (CommonJS) las importa como paquete workspace; el gateway
ESM de `apps/web/server` las importa igual que ya importa `serve-handler`; y el bundle Vite usa
las mismas funciones puras desde `apps/web/src/browser-diagnostics.ts`. Ningún servidor HTTP,
middleware ni emisor vive en el paquete: cada runtime conserva el suyo.

## `X-Request-Id`: de la API al gateway y de vuelta al navegador

En **desarrollo local** (`Web :5173` → `API :3000`) el navegador habla directo con la API, que
resuelve el `requestId` como se describe en la sección siguiente.

En **el gateway de mismo origen** (`apps/web/server`, el servidor productivo de Web), la
correlación atraviesa las tres partes:

1. `createGatewayServer` (`apps/web/server/gateway.ts`) resuelve el `requestId` con la misma
   `resolveRequestId` del paquete compartido **antes** de decidir si la petición es `/api/*` o
   estática, y lo devuelve siempre como header de respuesta `X-Request-Id`.
2. Si la petición es `/api/*`, `proxyApiRequest` (`apps/web/server/proxy-handler.ts`) reenvía ese
   mismo valor ya resuelto como header `X-Request-Id` al upstream de API — nunca reenvía el
   header entrante crudo del navegador sin pasar por la validación del gateway.
3. `RequestContextMiddleware` de la API recibe ese `X-Request-Id`, ya válido, lo conserva
   (cumple el mismo charset/longitud) y lo devuelve en su propia respuesta. El gateway hace
   `pipe()` de esa respuesta al navegador sin tocar los headers de `X-Request-Id`, por lo que
   navegador, gateway y API observan literalmente el mismo valor.

Un `X-Request-Id` entrante inválido o ausente en cualquiera de los dos servicios nunca se confía
para decisiones de seguridad: se reemplaza por un UUID (`generateRequestId`, ver
`packages/observability/src/request-id.ts`).

### En `apps/api`

- `RequestContextMiddleware` (`src/modules/observability/request-context.middleware.ts`) corre
  antes que guards, pipes y controllers, para toda ruta.
- Si la petición trae un header `X-Request-Id` entrante que cumple el charset seguro
  `[A-Za-z0-9._-]` y no supera 128 caracteres, se conserva. En cualquier otro caso (ausente,
  vacío, con espacios, saltos de línea, comillas u otro carácter fuera de ese charset) se
  reemplaza por un UUID generado con `crypto.randomUUID()`.
- El valor resuelto se devuelve siempre como header de respuesta `X-Request-Id`, incluidas las
  respuestas de error (401/403 de guard, 404 de ruta inexistente, 500 inesperado).
- `RequestContextService` (`src/modules/observability/request-context.service.ts`) publica ese
  `requestId` en un `AsyncLocalStorage`, accesible por cualquier servicio futuro sin depender de
  HTTP ni recibir el `Request` de Express.

### En el gateway (`apps/web/server`)

- `createGatewayServer` (`gateway.ts`) es el único punto de entrada HTTP: resuelve el
  `requestId`, fija el header de respuesta y arma un contexto (`requestId`, `method`, `route`)
  que reenvía a `proxyApiRequest` o usa directamente al diagnosticar un fallo estático.
- `logGatewayRequestCompleted` (`operational-logger.ts`) es el logger propio del gateway —
  equivalente a `OperationalLoggerService` de la API, pero sin NestJS ni DI — y emite exactamente
  una finalización por petición mediante una guarda idempotente en `finish`/`close` del mismo
  patrón que `RequestContextMiddleware`.

### En el navegador (`apps/web/src`)

- `reportBrowserOperationFailed` (`browser-diagnostics.ts`) es la frontera única para fallas de
  operaciones de interfaz que necesitan diagnóstico. Emite un objeto estructurado mediante
  `console.error`; la consola es una ayuda inmediata y no reemplaza un log persistente del
  servidor ni una futura herramienta de monitoreo de frontend.
- El diagnóstico se mantiene seguro en todos los builds. Esto permite investigar también el
  despliegue de desarrollo, aunque Vite lo haya construido en modo optimizado, sin habilitar un
  modo que exponga datos crudos.
- Una falla externa conocida se modela con una clase propia, se diagnostica una sola vez y puede
  convertirse en un estado recuperable con reintento. Un error inesperado se diagnostica con la
  misma estructura y después se vuelve a lanzar; queda prohibido ocultarlo con `catch {}` o una
  respuesta visual genérica.
- Si la respuesta de API incluye un `X-Request-Id` válido, el error HTTP lo preserva y el
  diagnóstico lo muestra. Una llamada directa a un proveedor sin esa cabecera no inventa un
  identificador de correlación.
- La ruta se normaliza sin query string y el error pasa por `buildErrorDiagnosticFields`. No se
  registran el cuerpo de `Request` o `Response`, headers completos, el texto enviado al proveedor,
  contenido del chiste, cookies, credenciales, secretos ni PII.
- Si un proveedor puede repetir contenido de negocio dentro de `message`, `cause` o `stack`, el
  productor lo entrega como `sensitiveValues` sólo al motor de redacción; ese campo nunca forma
  parte del objeto emitido.

## Eventos emitidos — API

| `event`                 | Cuándo                                                                                                                                                                                                                                                                          | Emisor                                                                                                      | Destino                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `api.bootstrap.failed`  | El arranque (`bootstrap()` en `main.ts`) falla antes de escuchar.                                                                                                                                                                                                               | `createStartupFailureDiagnostic`                                                                            | stderr                                              |
| `api.request.completed` | Exactamente una vez por petición HTTP, sin importar el resultado (incluido un aborto de cliente).                                                                                                                                                                               | `RequestContextMiddleware` (evento `finish` o `close` de la respuesta, con guarda idempotente: nunca ambos) | stdout si `status < 500`, stderr si `status >= 500` |
| `api.request.failed`    | Sólo ante un fallo inesperado: un error no controlado, o un `HttpException` con status `>= 500` (por ejemplo `InternalServerErrorException`). Un 4xx esperado (`AuthPublicError` o `HttpException < 500`) nunca lo genera. Complementa, no reemplaza, la finalización anterior. | `AuthExceptionFilter` (filtro global de excepciones)                                                        | stderr                                              |

Un fallo inesperado produce **dos** líneas correlacionadas por `requestId`: una finalización
(`api.request.completed`, `status >= 500`) y un diagnóstico (`api.request.failed`, con el detalle
técnico, incluso cuando el status público lo define un `HttpException` propio como
`InternalServerErrorException`). Nunca se duplica el fallo como dos diagnósticos ni como dos
finalizaciones.

## Eventos emitidos — gateway (`apps/web/server`)

| `event`                            | Cuándo                                                                                                                                                                                                                                                     | Emisor                                                                | Destino                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| `web.gateway.bootstrap.failed`     | El arranque (`bootstrap()` en `start.ts`) falla antes de escuchar (por ejemplo `PORT`/`API_INTERNAL_ORIGIN` inválidos).                                                                                                                                    | `createGatewayBootstrapFailureDiagnostic`                             | stderr                                              |
| `web.gateway.request.completed`    | Exactamente una vez por petición del gateway — API reenviada, estática, 502 explícito o cierre anticipado del cliente —, sin importar el resultado.                                                                                                        | `createGatewayServer` (evento `finish` o `close`, guarda idempotente) | stdout si `status < 500`, stderr si `status >= 500` |
| `web.gateway.upstream_unavailable` | El upstream de API no acepta conexión (`ECONNREFUSED`, `ENOTFOUND`, etc.) o se agota el timeout configurado (`code: 'UPSTREAM_TIMEOUT'`). Un aborto benigno del cliente **no** dispara este evento: sólo cierra el upstream y deja su propia finalización. | `proxyApiRequest` (evento `error` del request upstream)               | stderr                                              |
| `web.gateway.static_failed`        | El servidor de estáticos (SPA/assets) falla de forma inesperada al atender una ruta ajena a `/api`.                                                                                                                                                        | `createGatewayServer` (`.catch()` del handler estático)               | stderr                                              |

El gateway nunca duplica una respuesta ni un diagnóstico: `web.gateway.upstream_unavailable` y
`web.gateway.static_failed` complementan, sin reemplazar, la única finalización
(`web.gateway.request.completed`) de esa misma petición.

## Diagnóstico emitido — navegador

| `event`                        | Cuándo                                                                                                              | Emisor                         | Destino                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------- |
| `web.browser.operation_failed` | Una operación asíncrona de la interfaz falla en una frontera que puede aportar operación, proveedor y ruta seguros. | `reportBrowserOperationFailed` | Objeto estructurado en `console.error` |

El primer productor es Hello World. Distingue `hello-world.request-joke` de
`hello-world.translate-joke`; así el diagnóstico identifica si falló la API propia o MyMemory sin
registrar el chiste ni la query de traducción.

## Campos durables

Comunes a todos los eventos de ambos servicios: `timestamp` (ISO 8601), `level` (`info` o
`error`), `service` (`api` o `web`, según el emisor), `environment` (de `NODE_ENV`, `development`
si falta — ver `.env.example`) y `operation` (`bootstrap`, `request`, `proxy` o `static`, según
el emisor).

`api.request.completed` y `web.gateway.request.completed` agregan: `requestId`, `method`, `route`
(ruta registrada **sin** query string — un callback OAuth nunca expone `code` ni `state` en el
log), `status`, `durationMs`.

`api.bootstrap.failed`, `api.request.failed`, `web.gateway.bootstrap.failed`,
`web.gateway.upstream_unavailable` y `web.gateway.static_failed` agregan: `name`, `code` (si el
error lo trae), `message`, `cause` (si el error trae `Error.cause`, descrito y redactado igual
que `message`), `stack` (si está disponible). Los eventos correlacionados con una petición
(`api.request.failed`, `web.gateway.upstream_unavailable`, `web.gateway.static_failed`) agregan
además `requestId`, `method`, `route`.

`web.browser.operation_failed` contiene `timestamp`, `level: 'error'`, `service: 'web'`,
`runtime: 'browser'`, `event`, `operation`, `method`, `route`, `provider`, y agrega `status` y
`requestId` sólo cuando están disponibles y son seguros. También incorpora `name`, `code`,
`message`, `cause` y `stack` mediante `buildErrorDiagnosticFields`.

## Redacción

Todo texto de diagnóstico (`message`, `stack`, `cause`, `code`, `name`) pasa por el mismo motor
de redacción compartido: `redactDiagnosticText` y `buildErrorDiagnosticFields`
(`packages/observability/src/secret-redaction.ts` y `error-diagnostic.ts`). API y gateway lo
consumen desde el paquete `@timbo/observability`, al igual que el diagnóstico del navegador, en
vez de mantener contratos incompatibles de secretos. Redacta:

- cualquier ocurrencia literal del valor de `DATABASE_URL` (si el llamador lo entrega) y de URLs
  `postgres(ql)://...`;
- el valor de toda clave cuyo nombre normalizado termine en `token`, `password`, `secret`,
  `authorization`, `cookie`, `state`, `verifier`, `code`, o en `key` precedido de `api`, sea
  cual sea el separador (`snake_case`, `camelCase`, `kebab-case`) o el formato (`clave=valor`,
  `"clave": "valor"`, JSON anidado);
- cualquier dirección de correo con forma completa `local@dominio.tld`, esté o no dentro de una
  asignación `clave=valor` (por ejemplo un correo mencionado en prosa dentro de un mensaje de
  error). Un `@decorator` de TypeScript o un `usuario@` incompleto no tienen forma de correo y no
  se tocan.

### Valores sensibles adicionales

`buildErrorDiagnosticFields(error, databaseUrl, additionalSensitiveValues?)` acepta una tercera
lista opcional de literales sensibles conocidos por el llamador, para secretos que el motor no
puede inferir por patrón (por ejemplo `API_INTERNAL_ORIGIN`, que no tiene forma de contraseña ni
de URL de base de datos). El paquete **nunca lee `process.env`**: cada consumidor decide y
entrega explícitamente qué redactar.

El gateway usa este contrato en sus tres emisores de diagnóstico (`web.gateway.bootstrap.failed`,
`web.gateway.upstream_unavailable`, `web.gateway.static_failed`) para que `API_INTERNAL_ORIGIN`
—el origen interno del servicio API, nunca expuesto al navegador— no aparezca en `message`,
`cause` ni `stack`. Como los errores reales de conexión de Node (`ECONNREFUSED`, `ENOTFOUND`)
citan el `host` resuelto (`hostname:puerto`) o sólo el `hostname`, y no el origen completo con
esquema, `deriveOriginRedactionValues` (`apps/web/server/operational-logger.ts`) deriva las tres
formas (origen completo, `host`, `hostname`) a partir del valor configurado antes de pasarlas
como valores adicionales. Un valor adicional ausente o vacío se ignora sin alterar el resto del
texto ni la redacción existente de `DATABASE_URL`, PostgreSQL, secretos o emails.

Nunca se registran cuerpos de petición completos, query strings, headers `Authorization`,
cookies, tokens, secretos, variables de entorno completas ni el origen interno de servicios.

## Auditoría persistente

`AuditEventsService` recibe un `Prisma.TransactionClient`; por diseño no puede abrir una escritura
independiente de la operación que audita. `AUDIT_EVENT_CATALOG` define en código el `appKey`, tipo
de actor, resultado, regla de objetivo y campos de metadata permitidos para cada `eventName`.
El catálogo de aplicaciones usa objetivos `application` y registra creación, edición,
desactivación y reactivación con los nombres `access.application_*`.

Para agregar un evento de auditoría:

1. Confirmar que representa identidad, seguridad, acceso o una mutación administrativa que deba
   poder atribuirse posteriormente. Una lectura ordinaria o una interacción de interfaz no basta.
2. Agregar el nombre técnico al tipo `AuditEventName` y su definición exhaustiva en
   `audit-event-catalog.ts`. Los nombres siguen `<domain>.<event_in_past_tense>`, por ejemplo
   `access.user_deactivated`.
3. Extender los tipos y validadores de actor, objetivo o metadata sólo con el dato mínimo que el
   caso necesita. No agregar bolsas genéricas de metadata.
4. Invocar `auditEventsService.append(transactionClient, input)` dentro de la misma transacción
   Prisma que modifica el estado.
5. Probar catálogo, validación, persistencia, rollback conjunto, `requestId` y retención. Si la
   actividad administrativa debe mostrar metadata, agregar una allowlist explícita en
   `ActivityService`; persistir un campo no lo vuelve visible automáticamente.

Un evento de auditoría no se captura con `try/catch` para permitir que la operación principal
continúe. La ausencia de auditoría ante un cambio que exige trazabilidad es un fallo de la
operación completa.

## Analítica de uso persistente

`UsageEventsService` valida cada evento contra el catálogo inyectado mediante
`USAGE_EVENT_CATALOG`. El proveedor productivo actual es `PRODUCT_USAGE_EVENT_CATALOG` e incluye
`hello-world.joke_requested`: corresponde al clic que solicita un chiste, usa `appKey`
`hello-world` y no admite objetivo ni metadata. Así la actividad mide la acción sin persistir el
chiste, su traducción ni otros datos de negocio.

Para incorporar un productor de uso:

1. Definir primero qué decisión de producto u operación permitirá tomar cada evento. No registrar
   clics o vistas “por si acaso”.
2. Crear un catálogo concreto con `appKey`, objetivo opcional y una allowlist tipada de metadata.
   La aplicación productora lo incorpora a `PRODUCT_USAGE_EVENT_CATALOG`; no se convierte el
   catálogo compartido en una taxonomía abierta.
3. Usar nombres estables y específicos de la aplicación. Cambiar el significado de un nombre
   existente requiere un evento nuevo.
4. Generar `eventId` y `visitId` como UUID. Reintentar el mismo evento conserva `eventId`; un
   conflicto de unicidad devuelve `duplicate` y no crea otra fila.
5. Tratar `recorded`, `duplicate` y `failed` explícitamente. `failed` significa que no existe
   evidencia persistida y ya genera un diagnóstico operativo seguro; nunca debe presentarse como
   registro exitoso.
6. Probar catálogo, objetivos, metadata, límite de bytes, idempotencia, retención y falla del
   logger de respaldo.

Hello World usa el endpoint autenticado que ejecuta la acción principal: la Web genera `eventId`
por clic y conserva `visitId` durante la visita; la API registra el evento antes de consultar el
proveedor. El resultado `failed` se diagnostica en el servicio y no se traduce en una falsa falla
de la herramienta, mientras que `recorded` y `duplicate` permiten que la acción continúe.

## Cómo agregar un evento operativo

### En la API

- Usar `RequestContextService` para obtener el `requestId`; no pasar el objeto `Request` a los
  services sólo para diagnosticar.
- Agregar un método explícito y campos tipados a `OperationalLoggerService`. No exponer un
  `log(eventName, payload)` genérico que permita saltarse el contrato.
- Construir diagnósticos con `buildErrorDiagnosticFields` y entregar explícitamente valores
  sensibles adicionales que el motor no pueda inferir.
- Mantener la escritura JSON centralizada. `console.*` sólo se admite en arranque o en el fallback
  terminal ya documentado cuando el logger también falla.
- Probar el objeto serializado exacto, el destino stdout/stderr, la redacción y la correlación.

### En el gateway

- Mantener el emisor en `apps/web/server/operational-logger.ts`; el gateway no depende de NestJS
  ni de su inyección de dependencias.
- Reutilizar desde `@timbo/observability` únicamente las funciones puras de correlación, ruta y
  diagnóstico.
- Conservar una sola finalización por petición y agregar diagnósticos complementarios sólo cuando
  permitan investigar una falla concreta.
- Probar abortos de cliente, timeout, upstream caído, estáticos y redacción de
  `API_INTERNAL_ORIGIN` cuando el nuevo evento pueda incluir errores de red.

### En el navegador

- Agregar cada operación al tipo `BrowserOperation`; no exponer un nombre de evento o payload
  arbitrario desde los componentes.
- Reportar en el `catch` que conoce operación, método, ruta estable y proveedor. La ruta nunca
  incluye query string.
- Traducir fallas externas previstas a clases propias con `name`, `code`, `status` y `cause`
  cuando correspondan. Sólo esas clases habilitan una recuperación visual; cualquier otro error
  se vuelve a lanzar después del diagnóstico.
- Extraer `requestId` desde `X-Request-Id` al construir el error HTTP y conservarlo sólo si pasa
  la validación compartida.
- Probar el objeto enviado a `console.error`, la redacción, la normalización de ruta, la
  correlación y la diferencia entre fallas recuperables e inesperadas.

## Nombres y campos

- Identificadores técnicos en inglés y separados por puntos.
- Log operativo: `<service>.<operation>.<outcome>`, como `api.request.completed`.
- Auditoría: `<domain>.<event_in_past_tense>`, como `security.login_denied`.
- Uso: nombre estable dentro del catálogo de la aplicación productora; no reutilizar nombres entre
  acciones con semánticas distintas.
- Preferir identificadores opacos y acotados (`requestId`, `actorUserId`, `targetType`,
  `targetId`) frente a nombres, correos o texto libre.
- Toda metadata es una allowlist. No se aceptan objetos arbitrarios, aunque luego se intenten
  redactar.

Quedan prohibidos cuerpos completos, query strings, correos innecesarios, nombres de personas,
cookies, tokens, credenciales, secretos, URLs internas, variables de entorno y objetos de error
serializados ciegamente. También se evita registrar contenido de negocio —por ejemplo precios,
facturas o términos de búsqueda— salvo que un requisito explícito demuestre su necesidad y defina
una representación segura.

## Ejemplos seguros

Una finalización operativa contiene estructura estable y no el contenido de la petición:

```json
{
  "timestamp": "2026-08-24T15:30:00.000Z",
  "level": "info",
  "service": "api",
  "environment": "development",
  "event": "api.request.completed",
  "operation": "request",
  "requestId": "f67c64dd-38d2-4871-bc65-f2a98346338b",
  "method": "GET",
  "route": "/api/admin/activity",
  "status": 200,
  "durationMs": 18
}
```

Una llamada de auditoría describe actor y objetivo con identificadores, dentro de la transacción:

```ts
await auditEventsService.append(transactionClient, {
  eventName: 'access.user_deactivated',
  actor: { actorType: AuditActorType.USER, actorUserId },
  target: { targetType: 'user', targetId: deactivatedUserId },
});
```

No copiar estos valores como fixtures universales: cada prueba construye identificadores propios y
cada evento debe existir en su catálogo.

## Checklist para el PR

La administración de acceso registra `access.user_application_assigned`,
`access.user_application_unassigned`, `access.application_profile_created`,
`access.application_profile_updated`, `access.application_profile_deactivated`,
`access.application_profile_reactivated`, `access.application_profile_permission_added`,
`access.application_profile_permission_removed`, `access.user_application_profile_assigned` y
`access.user_application_profile_unassigned`. La metadata sólo conserva identificadores opacos
de aplicación, perfil o permiso definidos por el catálogo.

Antes de considerar terminado un cambio de observabilidad, auditoría o uso:

- la señal elegida coincide con la pregunta que se quiere responder;
- el nombre y los campos están tipados y registrados en el catálogo o logger propietario;
- `requestId` se conserva cuando existe contexto de petición;
- no aparecen secretos, credenciales, PII innecesaria ni contenido de negocio no autorizado;
- los fallos mantienen la semántica explícita de la operación;
- las pruebas cubren el caso exitoso, validaciones, redacción y camino de fallo relevante;
- las tablas o reglas de este documento se actualizaron si cambió el contrato durable;
- pasan `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` y `pnpm format:check`.
