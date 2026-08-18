# AGENTS.md

Reglas durables para cualquier agente (humano o automático) que trabaje en este repositorio. Complementan, no reemplazan, `docs/CODING_CONVENTIONS.md`.

## Alcance del repositorio

Este es el monorepo de **App Shell Plataforma Timbo**, administrado con `pnpm workspaces` (sin Turbo ni Nx). Contiene `apps/api` (NestJS), `apps/web` (React/Vite) y `packages/contracts` (OpenAPI generado). La web sólo comprueba la conexión tipada con la API; todavía no hay autenticación ni módulos de negocio.

No copiar código de otros proyectos ni introducir capacidades fuera del alcance acordado en el ticket o la actividad vigente. Ante una ambigüedad que exceda el alcance, se informa en vez de decidirse unilateralmente.

## Idioma

- Identificadores técnicos (nombres de archivos, clases, funciones, variables, rutas, claves de configuración) se escriben en **inglés**.
- Texto visible para personas (mensajes de respuesta, documentación, comentarios explicativos, commits) se escribe en **español**.

## Convenciones de código

Ver `docs/CODING_CONVENTIONS.md` para el detalle completo. Resumen operativo:

- Nombres completos y consistentes; evitar abreviaturas oscuras.
- Los controllers reciben la petición HTTP y delegan; los services coordinan la lógica. No agregar capas intermedias sin una razón concreta.
- No crear depósitos genéricos (`utils`, `helpers`, `common`) ni abstracciones para necesidades hipotéticas.
- Los comentarios explican el motivo (una decisión no obvia, una restricción), nunca traducen la línea de código.
- El código generado (por ejemplo, clientes o tipos derivados de OpenAPI) se guarda separado del código escrito a mano y nunca se edita manualmente.
- Ningún secreto (claves, tokens, contraseñas) entra al repositorio, al código, a los logs ni a los ejemplos. Las variables de entorno no secretas se documentan en `.env.example` con su valor por defecto.
- Los errores inesperados fallan explícitamente: no se silencian, no se convierten en éxito ni activan defaults engañosos. Los diagnósticos preservan operación, clase, código y stack cuando existen, redactando secretos, credenciales y PII innecesaria.
- Toda dependencia agregada debe resolver un problema concreto del incremento en curso; no se agregan dependencias especulativas.
- `any` no se usa sin una justificación excepcional documentada en el propio código.

## Checks obligatorios

Antes de considerar terminado un cambio, deben pasar desde la raíz del workspace:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm format:check
```

Si `pnpm` no está disponible como comando global, usar `corepack pnpm <comando>`.

## Qué hacer ante un bloqueo

Ante un conflicto de versiones, un bloqueo de certificados/TLS/red/registry, una ambigüedad de producto o una necesidad fuera del alcance acordado: detenerse e informar el bloqueo con contexto (comando exacto, error, estado del repositorio) en vez de improvisar una solución insegura o ampliar el alcance por cuenta propia.
