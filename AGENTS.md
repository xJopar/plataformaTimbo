# AGENTS.md

Reglas durables para cualquier agente (humano o automático) que trabaje en este repositorio. Complementan, no reemplazan, `docs/CODING_CONVENTIONS.md`.

## Alcance del repositorio

Este es el monorepo de **App Shell Plataforma Timbo**, administrado con `pnpm workspaces` (sin Turbo ni Nx). Contiene `apps/api` (NestJS), `apps/web` (React/Vite), `packages/contracts` (OpenAPI generado) y `packages/observability` (funciones puras compartidas). El estado vigente incluye identidad Google, sesiones, administración de usuarios, catálogo de aplicaciones, asignaciones a empleados, perfiles y permisos funcionales, observabilidad, auditoría, eventos de uso y actividad exportable. `Hello World` es la integración técnica y `Lista de Precios` la primera aplicación de negocio migrada.

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
- En la Web no se usan `catch {}` silenciosos para operaciones asíncronas: una falla externa esperable conserva un estado recuperable y emite un diagnóstico seguro en `console.error`; un error inesperado se diagnostica con contexto y se vuelve a lanzar. Cuando una respuesta API trae `X-Request-Id`, el diagnóstico del navegador lo conserva para correlación.
- Toda dependencia agregada debe resolver un problema concreto del incremento en curso; no se agregan dependencias especulativas.
- `any` no se usa sin una justificación excepcional documentada en el propio código.

## Documentación y señales operativas

- Antes de iniciar un cambio, consultar `docs/USING_REPOSITORY_DOCUMENTATION.md` para identificar el recorrido documental y el módulo propietario.
- Antes de cambiar límites entre aplicaciones, identidad, acceso, persistencia o contratos, leer `docs/PLATFORM_ARCHITECTURE.md`.
- Antes de agregar o modificar logs, auditoría o eventos de uso, leer `docs/OBSERVABILITY_LOGGING.md` y elegir explícitamente la señal correcta.
- El log operativo diagnostica ejecución; la auditoría conserva evidencia de seguridad o administración; los eventos de uso miden interacción de producto. No se sustituyen entre sí.
- Los nuevos eventos usan nombres estables, campos tipados y allowlists. No se agregan payloads genéricos ni se registran cuerpos, query strings, cookies, credenciales, secretos, PII innecesaria o contenido de negocio no autorizado.
- Un cambio administrativo que exige auditoría escribe el evento en la misma transacción Prisma. Un productor de uso define un catálogo concreto y respeta los resultados `recorded`, `duplicate` y `failed`.
- Si cambia una capacidad vigente o un contrato durable, actualizar en el mismo incremento el README y la documentación propietaria. No documentar planes futuros como funcionalidad ya disponible.

### Persistencia con ciclos de vida distintos

- Una base temporal, un proveedor externo o una futura migración de fuente no se agrega al Prisma principal por conveniencia. Si su ciclo de vida difiere de `DATABASE_URL`, debe tener cliente, esquema, migraciones, variable server-only y pre-deploy propios; el Prisma central conserva identidad, acceso, auditoría y catálogo. Confirmar explícitamente el destino de cada migración antes de desplegar.

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
