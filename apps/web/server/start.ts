import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGatewayServer } from './gateway.js';
import { resolveGatewayConfig } from './gateway-config.js';

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
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ event: 'web.gateway.bootstrap.failed', message }));
  process.exitCode = 1;
}
