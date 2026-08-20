# Observabilidad compartida

Funciones puras de logging operativo (`requestId`, ruta sin query, redacción de secretos/PII y
construcción de campos seguros de diagnóstico) usadas por `apps/api` y por el gateway de
`apps/web/server`. No depende de NestJS, Express ni de un servidor propio.

## Empaquetado

El paquete se compila una sola vez a CommonJS (sin campo `"type"`, igual que `apps/api`). El
gateway de `apps/web/server` es ESM y lo importa igual que ya importa `serve-handler`: Node
resuelve exports nombrados de un paquete CommonJS desde un módulo ESM de forma nativa. Esto evita
mantener una compilación dual CJS/ESM (infraestructura no requerida por el ticket) sin cambiar el
runtime de ninguna de las dos apps.

`pnpm build` debe correr antes de que `apps/api` o `apps/web` typechequen, prueben o compilen
contra este paquete; sus scripts `pretypecheck`/`pretest`/`prebuild` ya invocan
`pnpm --filter @timbo/observability run build`.
