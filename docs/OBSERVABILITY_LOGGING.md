# Log operativo estructurado de API y gateway

Primera etapa ("fundación operativa") del plan de observabilidad, auditoría y analítica de uso.
Cubre el contexto de petición y el log operativo JSON de `apps/api` (NestJS) y del gateway de
`apps/web/server` (servidor HTTP productivo de Web) sobre stdout/stderr; no incluye auditoría ni
analítica persistente en PostgreSQL, que llegan en tickets posteriores.

Las funciones puras de `requestId`, normalización de ruta, redacción de secretos/PII y
construcción de campos de diagnóstico viven en `packages/observability/src/` y las consumen
ambos servicios: `apps/api` (CommonJS) las importa como paquete workspace, y el gateway ESM de
`apps/web/server` las importa igual que ya importa `serve-handler` (interop nativo de Node entre
ESM e imports nombrados de un paquete CommonJS). Ninguno de los dos servidores HTTP, middlewares
ni loggers vive en el paquete: cada app conserva el suyo.

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

## Redacción

Todo texto de diagnóstico (`message`, `stack`, `cause`, `code`, `name`) pasa por el mismo motor
de redacción compartido: `redactDiagnosticText` y `buildErrorDiagnosticFields`
(`packages/observability/src/secret-redaction.ts` y `error-diagnostic.ts`). API y gateway lo
consumen desde el paquete `@timbo/observability` en vez de mantener dos contratos incompatibles
de secretos. Redacta:

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
