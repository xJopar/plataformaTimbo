# Contratos OpenAPI

Este paquete contiene el contrato OpenAPI versionado de la API y sus tipos TypeScript derivados.

- `openapi.json` se exporta desde la configuración real de Nest.
- `src/generated/openapi.ts` se genera con `openapi-typescript` y no se edita manualmente.

Desde la raíz se actualizan ambos artefactos con `pnpm generate:contracts`. El comando
`pnpm check:contracts` los regenera en un directorio temporal y falla si lo versionado no
coincide, sin modificar archivos del workspace.
