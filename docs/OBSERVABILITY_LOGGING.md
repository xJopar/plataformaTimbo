# Log operativo estructurado de la API

Primera etapa ("fundación operativa") del plan de observabilidad, auditoría y analítica de uso.
Cubre exclusivamente el contexto de petición y el log operativo JSON de `apps/api` sobre
stdout/stderr; no incluye auditoría ni analítica persistente en PostgreSQL, que llegan en
tickets posteriores.

## `X-Request-Id`

- `RequestContextMiddleware` (`src/modules/observability/request-context.middleware.ts`) corre
  antes que guards, pipes y controllers, para toda ruta.
- Si la petición trae un header `X-Request-Id` entrante que cumple el charset seguro
  `[A-Za-z0-9._-]` y no supera 128 caracteres, se conserva. En cualquier otro caso (ausente,
  vacío, con espacios, saltos de línea, comillas u otro carácter fuera de ese charset) se
  reemplaza por un UUID generado con `crypto.randomUUID()`. Un valor entrante nunca se usa para
  decisiones de seguridad.
- El valor resuelto se devuelve siempre como header de respuesta `X-Request-Id`, incluidas las
  respuestas de error (401/403 de guard, 404 de ruta inexistente, 500 inesperado).
- `RequestContextService` (`src/modules/observability/request-context.service.ts`) publica ese
  `requestId` en un `AsyncLocalStorage`, accesible por cualquier servicio futuro sin depender de
  HTTP ni recibir el `Request` de Express.

## Eventos emitidos

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

## Campos durables

Comunes a los tres eventos: `timestamp` (ISO 8601), `level` (`info` o `error`), `service`
(siempre `api`), `environment` (de `NODE_ENV`, `development` si falta — ver `.env.example`) y
`operation` (`bootstrap` o `request`, según el emisor).

`api.request.completed` agrega: `requestId`, `method`, `route` (ruta registrada **sin** query
string — un callback OAuth nunca expone `code` ni `state` en el log), `status`, `durationMs`.

`api.bootstrap.failed` y `api.request.failed` agregan: `name`, `code` (si el error lo trae),
`message`, `cause` (si el error trae `Error.cause`, descrito y redactado igual que `message`),
`stack` (si está disponible). `api.request.failed` agrega además `requestId`, `method`, `route`.

## Redacción

Todo texto de diagnóstico (`message`, `stack`, `cause`, `code`, `name`) pasa por el mismo motor
de redacción (`src/modules/observability/secret-redaction.ts`), compartido entre el diagnóstico
de arranque y el de peticiones para no mantener dos contratos incompatibles de secretos. Redacta:

- cualquier ocurrencia literal de `DATABASE_URL` y de URLs `postgres(ql)://...`;
- el valor de toda clave cuyo nombre normalizado termine en `token`, `password`, `secret`,
  `authorization`, `cookie`, `state`, `verifier`, `code`, o en `key` precedido de `api`, sea
  cual sea el separador (`snake_case`, `camelCase`, `kebab-case`) o el formato (`clave=valor`,
  `"clave": "valor"`, JSON anidado);
- cualquier dirección de correo con forma completa `local@dominio.tld`, esté o no dentro de una
  asignación `clave=valor` (por ejemplo un correo mencionado en prosa dentro de un mensaje de
  error). Un `@decorator` de TypeScript o un `usuario@` incompleto no tienen forma de correo y no
  se tocan.

Nunca se registran cuerpos de petición completos, query strings, headers `Authorization`,
cookies, tokens, secretos ni variables de entorno completas.
