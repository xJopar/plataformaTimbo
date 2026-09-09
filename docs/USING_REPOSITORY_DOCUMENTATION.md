# Cómo usar la documentación del repositorio

Guía breve para agentes y personas que necesitan orientarse antes de cambiar Plataforma Timbo.
No sustituye a `AGENTS.md`: indica qué fuente consultar según el cambio y cuándo detenerse.

## Lectura inicial obligatoria

1. Leer `AGENTS.md`: reglas durables, alcance vigente y checks obligatorios.
2. Leer [`PLATFORM_ARCHITECTURE.md`](PLATFORM_ARCHITECTURE.md): qué existe, quién es propietario de
   cada frontera y los recorridos de identidad, autorización, actividad y contratos.
3. Elegir los documentos adicionales con la tabla siguiente antes de editar.

## Mapa de decisión

| Si el cambio toca…                                                          | Leer primero                                                                                                               | Después, ubicar el propietario                                                          |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Una aplicación nueva o la migración de una standalone                       | [`MIGRATING_STANDALONE_APPS.md`](MIGRATING_STANDALONE_APPS.md)                                                             | Módulos de `hello-world` y `lista-precios`; registro Web; Administración.               |
| Identidad, sesión, acceso, perfiles, permisos o el catálogo de aplicaciones | [`PLATFORM_ARCHITECTURE.md`](PLATFORM_ARCHITECTURE.md)                                                                     | `apps/api/src/modules/auth/`, `access-profiles/` o `administration/`.                   |
| Persistencia o una migración                                                | [`PLATFORM_ARCHITECTURE.md`](PLATFORM_ARCHITECTURE.md) y [`CODING_CONVENTIONS.md`](CODING_CONVENTIONS.md)                  | `apps/api/prisma/schema.prisma`, migraciones y service propietario.                     |
| Endpoint o DTO HTTP                                                         | [`PLATFORM_ARCHITECTURE.md`](PLATFORM_ARCHITECTURE.md) y [`packages/contracts/README.md`](../packages/contracts/README.md) | Controller/DTO → contratos generados → fachada `apps/web/src/api/`.                     |
| Log operativo, auditoría o analítica de uso                                 | [`OBSERVABILITY_LOGGING.md`](OBSERVABILITY_LOGGING.md)                                                                     | Logger, catálogo de auditoría o catálogo de uso y su proyección en Actividad.           |
| Convenciones de código, errores, secretos o dependencias                    | [`CODING_CONVENTIONS.md`](CODING_CONVENTIONS.md)                                                                           | El módulo dueño del comportamiento; no crear una capa genérica.                         |
| Diseño o una superficie Web                                                 | [`../DESIGN.md`](../DESIGN.md) y [`CODING_CONVENTIONS.md`](CODING_CONVENTIONS.md)                                          | Componente propietario y estilos de su área; el App Shell conserva sesión y navegación. |
| Variables, Railway o promoción entre entornos                               | [`RAILWAY_DEPLOYMENT.md`](RAILWAY_DEPLOYMENT.md) y `.env.example`                                                          | `apps/api/railway.json`, `apps/web/railway.json` y dashboard autorizado.                |
| Intención de producto o alcance                                             | [`../PRODUCT.md`](../PRODUCT.md)                                                                                           | Si no resuelve la duda, pedir decisión: no ampliar el producto por inferencia.          |

## Cómo leer sin perderse

1. Empezar por el documento, no por una búsqueda global de archivos.
2. Identificar el módulo o servicio propietario y leer su prueba junto al código. Las pruebas
   aclaran los bordes que el contrato espera proteger.
3. Si la operación atraviesa API y Web, recorrer controller/DTO → contrato generado → fachada API →
   componente. No cambiar el artefacto generado directamente.
4. Si una señal llega a Actividad o CSV, seguir productor → catálogo → persistencia →
   `ActivityService`; persistir un campo no lo hace visible por defecto.
5. Actualizar en el mismo incremento el documento dueño de la capacidad y el README cuando cambia
   una funcionalidad vigente o un contrato durable.

### Referencia obligatoria al integrar una aplicación

Antes de diseñar endpoints, permisos o señales de una aplicación nueva, revisar el recorrido de
`lista-precios` de punta a punta:

1. `apps/api/src/modules/lista-precios/`: controller con guards de clase, service, configuración
   server-only, errores tipados y pruebas.
2. `apps/web/src/applications/lista-precios/`: componente integrado, rutas internas, carga y
   fallas recuperables.
3. `use-lista-precios-usage-events.ts`, `usage-event-catalog.ts` y `ActivityService`: evento de
   uso tipado, deduplicación por visita, allowlist y columnas de exportación.
4. `docs/OBSERVABILITY_LOGGING.md`: elegir de forma explícita entre log operativo, auditoría y
   evento de uso. Una aprobación, rechazo o cambio administrativo no se modela como analítica:
   exige auditoría transaccional.

Usar Lista de Precios como patrón no significa copiar su dominio, campos o eventos. Sólo aporta el
molde de integración, seguridad, diagnósticos y actividad.

## Reglas para discrepancias

Los documentos describen el sistema que existe; no deben conservar fases, autorizaciones ni
decisiones de tandas anteriores como si fueran actuales.

- Si el código y un documento discrepan, no elegir silenciosamente uno. Confirmar el código,
  señalar la diferencia y actualizar la documentación junto al cambio autorizado.
- El repositorio no prueba el estado del dashboard, un dominio, un secreto desplegado ni la baja de
  una standalone. Esos pasos se documentan como verificación externa, nunca como hechos inferidos.
- Si falta una decisión de producto, permiso o una credencial, detenerse y pedir dirección. No
  inventar configuración, migraciones, eventos o datos que excedan el alcance.

## Cierre

Los checks de `AGENTS.md` son obligatorios. Cuando cambie la API, además ejecutar
`pnpm check:contracts`. Antes de cerrar, revisar que las rutas de documentación afectadas siguen
apuntando a fuentes existentes y que no se documentó una intención futura como capacidad disponible.
