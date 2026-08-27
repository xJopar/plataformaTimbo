# Migrar una app standalone al App Shell

Receta para incorporar una aplicación que hoy vive fuera del monorepo (login propio, backend
propio) como una aplicación más del App Shell. No es un registro de lo que existe — es el
contrato que debe seguir cada migración para que el patrón se mantenga uniforme. Ejemplo de
referencia: `hello-world` (primera app integrada). Primer caso guiado por este documento:
`lista-precios`.

## Cuándo aplica

Cuando la app standalone va a **vivir dentro** del App Shell como un módulo más del launcher
(no como servicio embebido por iframe/proxy). Eso implica que cede al shell:

- login y sesión (deja de tener su propio OAuth);
- autorización de acceso a la app (deja de tener whitelist/roles propios — pasa a
  `access-profiles`/`administration`);
- cualquier secreto de proveedores externos (nunca queda en el bundle del cliente).

## Las 3 partes de la migración

1. **Backend** — nuevo módulo en `apps/api/src/modules/<app-key>/`.
2. **Frontend** — nuevo módulo en `apps/web/src/applications/<app-key>/`, registrado en
   `application-registry.tsx`.
3. **Logs** — eventos de negocio propios de la app original (los que no son solo "uso") migran a
   `usage-events`/`audit-events` según corresponda. Pendiente de definir la regla exacta (ver
   `lista-precios` cuando se aborde esta parte).

Este documento cubre por ahora sólo el patrón de **backend**; se completa a medida que avanzan
las otras dos.

## Patrón de backend

Módulo NestJS nuevo, hermano de los existentes en `apps/api/src/modules/`. Estructura mínima
(reflejar exactamente la de `hello-world`):

| Archivo                             | Responsabilidad                                                                                                                                                                                                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<app>.module.ts`                   | Importa `AuthModule` + `AccessProfilesModule` (y `UsageEventsModule` si ya se aborda la parte de logs). Registra controller, service, guard y el token de `fetch`.                                                                                                                                          |
| `<app>.controller.ts`               | Rutas bajo `applications/<app-key>/*`. `@UseGuards(SessionAuthenticationGuard, <App>ApplicationAccessGuard)` a nivel de clase — ningún endpoint queda sin los dos guards. Mutaciones (POST/PATCH/DELETE) suman `CsrfProtectionGuard`; lecturas (GET) no lo necesitan.                                       |
| `<app>-application-access.guard.ts` | Usa `ApplicationAuthorizationService.hasApplicationAccess(userId, '<app-key>')`. Reemplaza cualquier whitelist/rol propio de la app original.                                                                                                                                                               |
| `<app>.service.ts`                  | Lógica de negocio y llamadas a proveedores externos (si los hay). El `fetch` se inyecta vía token DI (testeable sin red real).                                                                                                                                                                              |
| `<app>.tokens.ts`                   | `Symbol` para inyectar `fetch` (y cualquier otra dependencia externa).                                                                                                                                                                                                                                      |
| `<app>.errors.ts`                   | Error tipado para indisponibilidad de proveedor externo, traducido a `BadGatewayException` en el controller.                                                                                                                                                                                                |
| `<app>.config.ts`                   | Sólo si la app tiene credenciales propias de un proveedor externo. `resolve<Proveedor>Config(env)` con validación fail-fast (mismo patrón que `resolveGoogleOAuthConfig` en `runtime-config.ts`), resuelto al construir el service — no en el arranque global, para no acoplar módulos que no lo necesitan. |
| `dto/*.dto.ts`                      | DTOs con `@ApiProperty` para que el contrato OpenAPI (`packages/contracts`) los tipe.                                                                                                                                                                                                                       |
| `*.spec.ts` junto a cada archivo    | Unit tests, mismo criterio que el resto del repo.                                                                                                                                                                                                                                                           |

Registrar el módulo en `apps/api/src/app.module.ts` (import + agregar a `imports`).

### Credenciales de proveedores externos

- Nunca variables `VITE_*` (esas llegan al bundle del cliente). Sólo variables de servidor puro,
  documentadas en `.env.example` (raíz) con el mismo formato que las demás: qué es, si es
  secreto, y dónde se configura en Railway.
- El fetch al proveedor externo se ejecuta **desde el backend**, nunca desde el navegador. Si la
  app original llamaba directo al proveedor (con proxy propio en dev/producción), ese proxy
  desaparece: el frontend pasa a llamar sólo a `/api/applications/<app-key>/*`.

### Alta en el catálogo de aplicaciones

Cada app vive como una fila en la tabla `applications` (`apps/api/prisma/schema.prisma`). Alta
vía migración Prisma con seed, como hizo `hello-world`
(`prisma/migrations/20260824120000_add_application_catalog`): `key` (kebab-case), `name`,
`launch_path` (`/apps/<app-key>`), `display_order`.

## Por qué muchos endpoints no es un problema aquí

Cada app aporta 1 controller propio y acotado (2-4 rutas típicamente) bajo su propio
`applications/<app-key>/*`; nunca comparte controller con otra app ni importa el service interno
de otro módulo. El costo que sí crece linealmente con cada app nueva —y se acepta como normal—
es: sus propios tests, y una entrada más en el contrato OpenAPI generado. Lo que rompería esta
escalabilidad sería abandonar el molde de un-módulo-por-app.

## Caso guiado: `lista-precios`

- **Origen**: `Claude/Proyectos/Lista de Precios/Lista de Precios Mobile` — SPA Vite standalone
  con login Google OAuth propio, whitelist propia, y fetch directo a Zoho Analytics desde el
  cliente (OAuth2 self-client con refresh token).
- **Alcance de esta primera etapa de backend**: sólo el catálogo de vehículos (equivalente a
  `zohoApi.js`: intercambio de refresh token + parseo de CSV). El panel de logs de actividad
  (`AdminPanel.jsx`, en realidad un visor de eventos con filtros/stats/export CSV respaldado por
  `api/db.js`+`api/server.js` propios) queda para la parte 3 (Logs), no es parte del backend de
  vehículos.
- **Endpoint**: `GET applications/lista-precios/vehicles` → array de `VehicleResponseDto`
  (mismos campos que `COL_MAP` en `zohoApi.js` original).
- **Credenciales nuevas**: `ZOHO_ORG_ID`, `ZOHO_WORKSPACE_ID`, `ZOHO_VIEW_ID`, `ZOHO_CLIENT_ID`,
  `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` — documentadas en `.env.example`.
- **Se queda del lado del frontend, sin cambios de fondo**: `dataProcessor.js` (agrupación,
  filtros, formateo de precio) — es lógica de presentación pura sobre el array ya recibido, no
  necesita moverse al backend.

### Inventario de variables de entorno (Railway del proyecto original)

| Variable original                                                                                           | Qué hacía                                                                 | Destino en App Shell                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `API_URL`                                                                                                   | URL del backend propio, proxeada por `vite.config.js` para `/logs` en dev | Elimina — el gateway de `apps/web/server` reemplaza ese proxy                                                                                          |
| `VITE_ADMIN_EMAILS`                                                                                         | Whitelist de acceso al AdminPanel (logs)                                  | Fase 3 — perfiles de acceso, no env var                                                                                                                |
| `VITE_ADMIN_TOKEN`                                                                                          | "Secreto" de AdminPanel expuesto al cliente                               | Fase 3 — desaparece, protección por sesión + guard                                                                                                     |
| `VITE_ALLOWED_EMAILS`                                                                                       | Whitelist de login de toda la app                                         | Elimina — la reemplaza `access-profiles`/`administration`                                                                                              |
| `VITE_GOOGLE_CLIENT_ID`                                                                                     | Client ID de Google OAuth propio                                          | Elimina — usa el `GOOGLE_OAUTH_CLIENT_ID` único del shell                                                                                              |
| `VITE_SESSION_MINUTES`                                                                                      | Duración de sesión propia                                                 | Elimina — duración fija de sesión del shell                                                                                                            |
| `VITE_WA_AUTH_MSG` / `VITE_WA_AUTH_NUMBER`                                                                  | WhatsApp del botón "solicitar acceso" (no autorizado)                     | Fase Frontend — a redefinir, el flujo de "sin acceso" del shell es distinto                                                                            |
| `VITE_WA_CONSULT_MSG` / `VITE_WA_CONSULT_NUMBER`                                                            | WhatsApp del botón "consultar" en detalle de modelo                       | Fase Frontend — se mantiene como config del módulo, no hardcodeada                                                                                     |
| `VITE_ZOHO_CLIENT_ID` / `CLIENT_SECRET` / `ORG_ID` / `REFRESH_TOKEN` / `TOKEN` / `VIEW_ID` / `WORKSPACE_ID` | Credenciales/IDs de Zoho, expuestas al cliente                            | Ya migradas a `ZOHO_*` server-only en `apps/api` (`.env.example`). `VITE_ZOHO_TOKEN` no hace falta: el backend siempre refresca desde el refresh token |
