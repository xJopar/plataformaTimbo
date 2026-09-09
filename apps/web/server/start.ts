import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGatewayServer } from './gateway.js';
import { resolveGatewayConfig } from './gateway-config.js';
import { createGatewayBootstrapFailureDiagnostic } from './operational-logger.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.resolve(currentDir, '../dist');

function bootstrap(): void {
  const config = resolveGatewayConfig();
  const server = createGatewayServer({
    apiInternalOrigin: config.apiInternalOrigin,
    staticDir: STATIC_DIR,
  });
  server.listen(config.port);
}

try {
  bootstrap();
} catch (error: unknown) {
  // Se lee el valor crudo de entorno (no la configuración validada) porque la propia
  // resolución de `API_INTERNAL_ORIGIN` puede ser la causa del fallo de arranque.
  console.error(
    JSON.stringify(createGatewayBootstrapFailureDiagnostic(error, process.env.API_INTERNAL_ORIGIN)),
  );
  process.exitCode = 1;
}
