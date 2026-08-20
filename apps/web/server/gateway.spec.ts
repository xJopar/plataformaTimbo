import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGatewayServer } from './gateway.js';

const SPA_INDEX_MARKER = 'spa-shell-marker';

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('El servidor de prueba no expone un puerto numérico.');
  }
  return address.port;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

describe('createGatewayServer', () => {
  let staticDir: string;
  let gatewayServer: Server;
  let gatewayPort: number;

  beforeAll(async () => {
    staticDir = await mkdtemp(path.join(tmpdir(), 'timbo-web-gateway-'));
    await mkdir(path.join(staticDir, 'assets'), { recursive: true });
    await writeFile(
      path.join(staticDir, 'index.html'),
      `<!doctype html><html><body>${SPA_INDEX_MARKER}</body></html>`,
    );
    await writeFile(path.join(staticDir, 'assets', 'app.js'), 'console.log("asset-marker");');
  });

  afterAll(async () => {
    await rm(staticDir, { recursive: true, force: true });
  });

  async function startGateway(
    apiInternalOrigin: string,
    upstreamTimeoutMs?: number,
  ): Promise<void> {
    gatewayServer = createGatewayServer({ apiInternalOrigin, staticDir, upstreamTimeoutMs });
    gatewayPort = await listen(gatewayServer);
  }

  describe('con un upstream disponible', () => {
    let upstreamServer: Server;
    let upstreamPort: number;
    let receivedRequests: { method: string | undefined; url: string | undefined }[];

    beforeAll(async () => {
      receivedRequests = [];
      upstreamServer = createServer((request: IncomingMessage, response: ServerResponse) => {
        receivedRequests.push({ method: request.method, url: request.url });

        if (request.url === '/api/auth/google/callback') {
          response.writeHead(303, {
            location: 'http://localhost:4173/',
            'set-cookie': ['timbo_session=upstream-token; HttpOnly; Path=/; Max-Age=28800'],
          });
          response.end();
          return;
        }

        if (request.url === '/api/echo-cookie') {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ cookie: request.headers.cookie ?? null }));
          return;
        }

        let body = '';
        request.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf8');
        });
        request.on('end', () => {
          response.writeHead(200, {
            'content-type': 'application/json',
            'x-echo-header': request.headers['x-timbo-test'] ?? '',
          });
          response.end(JSON.stringify({ method: request.method, body }));
        });
      });
      upstreamPort = await listen(upstreamServer);
    });

    afterAll(async () => {
      await close(upstreamServer);
    });

    beforeAll(async () => {
      await startGateway(`http://127.0.0.1:${String(upstreamPort)}`);
    });

    afterAll(async () => {
      await close(gatewayServer);
    });

    it('reenvía método, cuerpo y encabezados de /api/* al upstream y devuelve su respuesta', async () => {
      receivedRequests.length = 0;
      const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/api/health`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-timbo-test': 'valor-de-prueba' },
        body: JSON.stringify({ ping: true }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('x-echo-header')).toBe('valor-de-prueba');
      await expect(response.json()).resolves.toEqual({
        method: 'POST',
        body: JSON.stringify({ ping: true }),
      });
      expect(receivedRequests).toEqual([{ method: 'POST', url: '/api/health' }]);
    });

    it('entrega el Set-Cookie del callback OAuth sin exponer su valor en logs y lo reenvía en la petición siguiente', async () => {
      const callbackResponse = await fetch(
        `http://127.0.0.1:${String(gatewayPort)}/api/auth/google/callback`,
        { redirect: 'manual' },
      );

      expect(callbackResponse.status).toBe(303);
      const setCookieHeader = callbackResponse.headers.get('set-cookie');
      expect(setCookieHeader).toContain('timbo_session=upstream-token');
      expect(setCookieHeader).toContain('Max-Age=28800');

      const echoResponse = await fetch(`http://127.0.0.1:${String(gatewayPort)}/api/echo-cookie`, {
        headers: { cookie: 'timbo_session=upstream-token' },
      });
      await expect(echoResponse.json()).resolves.toEqual({
        cookie: 'timbo_session=upstream-token',
      });
    });

    it('sirve la SPA para rutas ajenas a /api sin seleccionar el upstream', async () => {
      receivedRequests.length = 0;
      const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/some-other-page`);

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain(SPA_INDEX_MARKER);
      expect(receivedRequests).toEqual([]);
    });

    it('sirve un archivo estático real sin reescribirlo a index.html', async () => {
      const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/assets/app.js`);

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain('asset-marker');
    });
  });

  describe('con el upstream caído', () => {
    beforeAll(async () => {
      const probeServer = createServer();
      const freePort = await listen(probeServer);
      await close(probeServer);
      await startGateway(`http://127.0.0.1:${String(freePort)}`);
    });

    afterAll(async () => {
      await close(gatewayServer);
    });

    it('responde 502 explícito y diagnosticable para /api, nunca el HTML de la SPA', async () => {
      const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/api/health`);

      expect(response.status).toBe(502);
      expect(response.headers.get('content-type')).toContain('application/json');
      await expect(response.json()).resolves.toEqual({ code: 'UPSTREAM_UNAVAILABLE' });
    });

    it('sigue sirviendo la SPA para rutas ajenas a /api aunque el upstream esté caído', async () => {
      const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/`);

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain(SPA_INDEX_MARKER);
    });
  });

  describe('con un upstream conectado que nunca responde', () => {
    let hangingUpstreamServer: Server;
    let hangingUpstreamPort: number;
    let upstreamSocketClosed: Promise<void>;

    beforeAll(async () => {
      let resolveSocketClosed: (() => void) | undefined;
      upstreamSocketClosed = new Promise<void>((resolve) => {
        resolveSocketClosed = resolve;
      });

      hangingUpstreamServer = createServer((request: IncomingMessage) => {
        // No responde nunca: simula un upstream conectado pero colgado.
        request.socket.on('close', () => resolveSocketClosed?.());
      });
      hangingUpstreamPort = await listen(hangingUpstreamServer);
    });

    afterAll(async () => {
      await close(hangingUpstreamServer);
    });

    afterAll(async () => {
      await close(gatewayServer);
    });

    it('corta el socket upstream por timeout y responde 502 explícito, no HTML', async () => {
      await startGateway(`http://127.0.0.1:${String(hangingUpstreamPort)}`, 100);

      const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/api/health`);

      expect(response.status).toBe(502);
      expect(response.headers.get('content-type')).toContain('application/json');
      await expect(response.json()).resolves.toEqual({ code: 'UPSTREAM_UNAVAILABLE' });
      await upstreamSocketClosed;
    });
  });

  describe('con un cliente que aborta la petición', () => {
    let hangingUpstreamServer: Server;
    let hangingUpstreamPort: number;
    let upstreamRequestReceived: Promise<void>;
    let upstreamSocketClosed: Promise<void>;

    beforeAll(async () => {
      let resolveRequestReceived: (() => void) | undefined;
      let resolveSocketClosed: (() => void) | undefined;
      upstreamRequestReceived = new Promise<void>((resolve) => {
        resolveRequestReceived = resolve;
      });
      upstreamSocketClosed = new Promise<void>((resolve) => {
        resolveSocketClosed = resolve;
      });

      hangingUpstreamServer = createServer((request: IncomingMessage) => {
        // Nunca responde: da tiempo a abortar desde el cliente antes de recibir nada.
        resolveRequestReceived?.();
        request.socket.on('close', () => resolveSocketClosed?.());
      });
      hangingUpstreamPort = await listen(hangingUpstreamServer);
      // Timeout largo a propósito: esta prueba demuestra la cancelación por aborto del
      // cliente, no el timeout del upstream.
      await startGateway(`http://127.0.0.1:${String(hangingUpstreamPort)}`, 5_000);
    });

    afterAll(async () => {
      await close(gatewayServer);
      await close(hangingUpstreamServer);
    });

    it('destruye la conexión upstream y no responde tarde cuando el cliente aborta', async () => {
      const controller = new AbortController();
      const abortedFetch = fetch(`http://127.0.0.1:${String(gatewayPort)}/api/health`, {
        signal: controller.signal,
      });
      const rejection = abortedFetch.then(
        () => {
          throw new Error('Se esperaba que el fetch abortado rechazara la promesa.');
        },
        (error: unknown) => error,
      );

      await upstreamRequestReceived;
      controller.abort();

      await expect(rejection).resolves.toMatchObject({ name: 'AbortError' });
      await upstreamSocketClosed;
    });
  });
});
