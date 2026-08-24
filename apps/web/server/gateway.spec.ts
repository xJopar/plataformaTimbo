import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RESPONSE_REQUEST_ID_HEADER } from '@timbo/observability';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { createGatewayServer } from './gateway.js';

const SPA_INDEX_MARKER = 'spa-shell-marker';
const REQUEST_ID_HEADER = RESPONSE_REQUEST_ID_HEADER.toLowerCase();

interface StructuredLog {
  timestamp: string;
  level: string;
  service: string;
  environment: string;
  event: string;
  operation: string;
  [key: string]: unknown;
}

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
  let consoleLogSpy: MockInstance<typeof console.log>;
  let consoleErrorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  function allLogs(): StructuredLog[] {
    return [...consoleLogSpy.mock.calls, ...consoleErrorSpy.mock.calls].map(
      ([serialized]) => JSON.parse(serialized as string) as StructuredLog,
    );
  }

  function completionLogs(): StructuredLog[] {
    return allLogs().filter((entry) => entry.event === 'web.gateway.request.completed');
  }

  function upstreamUnavailableLogs(): StructuredLog[] {
    return allLogs().filter((entry) => entry.event === 'web.gateway.upstream_unavailable');
  }

  // `finish`/`close` del lado servidor pueden ocurrir en un tick posterior a que el cliente
  // ya haya recibido el cuerpo completo de la respuesta: se espera activamente la finalización
  // en vez de asumir que ya ocurrió apenas se resuelve el `fetch` de la prueba.
  async function waitFor<T>(
    getValue: () => T,
    isReady: (value: T) => boolean,
    timeoutMs = 1000,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let value = getValue();
    while (!isReady(value) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      value = getValue();
    }
    return value;
  }

  async function waitForCompletionLogs(expectedCount: number): Promise<StructuredLog[]> {
    return waitFor(completionLogs, (logs) => logs.length >= expectedCount);
  }

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
    let receivedRequests: {
      method: string | undefined;
      url: string | undefined;
      requestId: string | undefined;
    }[];

    beforeAll(async () => {
      receivedRequests = [];
      upstreamServer = createServer((request: IncomingMessage, response: ServerResponse) => {
        receivedRequests.push({
          method: request.method,
          url: request.url,
          requestId: request.headers[REQUEST_ID_HEADER] as string | undefined,
        });

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

    it('reenvía método, cuerpo y encabezados de /api/* al upstream, devuelve su respuesta y loguea una sola finalización', async () => {
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

      const assignedRequestId = response.headers.get(REQUEST_ID_HEADER);
      expect(assignedRequestId).toBeTruthy();
      expect(receivedRequests).toEqual([
        { method: 'POST', url: '/api/health', requestId: assignedRequestId },
      ]);

      const completions = await waitForCompletionLogs(1);
      expect(completions).toHaveLength(1);
      expect(completions[0]).toMatchObject({
        service: 'web',
        level: 'info',
        requestId: assignedRequestId,
        method: 'POST',
        route: '/api/health',
        status: 200,
      });
      expect(typeof completions[0]?.durationMs).toBe('number');
      expect(typeof completions[0]?.timestamp).toBe('string');
      expect(typeof completions[0]?.environment).toBe('string');
    });

    it('preserva un X-Request-Id entrante válido, lo propaga al upstream y lo devuelve al navegador', async () => {
      const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/api/health`, {
        headers: { [REQUEST_ID_HEADER]: 'cliente-valido-123' },
      });

      expect(response.headers.get(REQUEST_ID_HEADER)).toBe('cliente-valido-123');
      expect(receivedRequests.at(-1)?.requestId).toBe('cliente-valido-123');
      const completions = await waitForCompletionLogs(1);
      expect(completions.at(-1)).toMatchObject({ requestId: 'cliente-valido-123' });
    });

    it('nunca confía en un X-Request-Id entrante inválido: genera uno nuevo, coherente entre navegador, upstream y log', async () => {
      const invalidRequestId = 'id inválido con espacios';
      const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/api/health`, {
        headers: { [REQUEST_ID_HEADER]: invalidRequestId },
      });

      const assignedRequestId = response.headers.get(REQUEST_ID_HEADER);
      expect(assignedRequestId).toBeTruthy();
      expect(assignedRequestId).not.toBe(invalidRequestId);
      expect(receivedRequests.at(-1)?.requestId).toBe(assignedRequestId);
      const completions = await waitForCompletionLogs(1);
      expect(completions.at(-1)).toMatchObject({ requestId: assignedRequestId });

      for (const log of allLogs()) {
        expect(JSON.stringify(log)).not.toContain(invalidRequestId);
      }
    });

    it('genera un X-Request-Id cuando no llega ninguno', async () => {
      const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/api/health`);
      expect(response.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
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

      for (const log of allLogs()) {
        expect(JSON.stringify(log)).not.toContain('upstream-token');
      }
    });

    it('nunca registra query string, cookies ni Authorization en la finalización de una petición API', async () => {
      const secretCode = 'secreto-code-oauth';
      const secretState = 'secreto-state-oauth';
      await fetch(
        `http://127.0.0.1:${String(gatewayPort)}/api/echo-cookie?code=${secretCode}&state=${secretState}`,
        { headers: { cookie: 'timbo_session=otra-sesion', authorization: 'Bearer secreto-token' } },
      );

      const completions = await waitForCompletionLogs(1);
      expect(completions.at(-1)).toMatchObject({ route: '/api/echo-cookie' });

      for (const log of allLogs()) {
        const serialized = JSON.stringify(log);
        expect(serialized).not.toContain(secretCode);
        expect(serialized).not.toContain(secretState);
        expect(serialized).not.toContain('otra-sesion');
        expect(serialized).not.toContain('secreto-token');
      }
    });

    it('sirve la SPA para rutas ajenas a /api sin seleccionar el upstream y loguea una sola finalización', async () => {
      receivedRequests.length = 0;
      const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/some-other-page`);

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-cache');
      await expect(response.text()).resolves.toContain(SPA_INDEX_MARKER);
      expect(receivedRequests).toEqual([]);

      const completions = await waitForCompletionLogs(1);
      expect(completions).toHaveLength(1);
      expect(completions[0]).toMatchObject({
        service: 'web',
        route: '/some-other-page',
        status: 200,
      });
    });

    it('sirve un archivo estático real sin reescribirlo a index.html', async () => {
      const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/assets/app.js`);

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
      await expect(response.text()).resolves.toContain('asset-marker');
    });

    it('responde 404 para un asset obsoleto en vez de entregar index.html como JavaScript', async () => {
      const response = await fetch(
        `http://127.0.0.1:${String(gatewayPort)}/assets/bundle-anterior.js`,
      );

      expect(response.status).toBe(404);
      await expect(response.text()).resolves.not.toContain(SPA_INDEX_MARKER);
    });
  });

  describe('con el upstream caído', () => {
    let downedApiInternalOrigin: string;

    beforeAll(async () => {
      const probeServer = createServer();
      const freePort = await listen(probeServer);
      await close(probeServer);
      downedApiInternalOrigin = `http://127.0.0.1:${String(freePort)}`;
      await startGateway(downedApiInternalOrigin);
    });

    afterAll(async () => {
      await close(gatewayServer);
    });

    it('responde 502 explícito y diagnosticable para /api, nunca el HTML de la SPA, con una sola finalización y un solo diagnóstico correlacionados', async () => {
      const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/api/health`);

      expect(response.status).toBe(502);
      expect(response.headers.get('content-type')).toContain('application/json');
      await expect(response.json()).resolves.toEqual({ code: 'UPSTREAM_UNAVAILABLE' });

      const assignedRequestId = response.headers.get(REQUEST_ID_HEADER);
      expect(assignedRequestId).toBeTruthy();

      const completions = await waitForCompletionLogs(1);
      expect(completions).toHaveLength(1);
      expect(completions[0]).toMatchObject({
        level: 'error',
        requestId: assignedRequestId,
        route: '/api/health',
        status: 502,
      });

      const diagnostics = upstreamUnavailableLogs();
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        service: 'web',
        requestId: assignedRequestId,
        route: '/api/health',
      });
      expect(typeof diagnostics[0]?.name).toBe('string');
      expect(typeof diagnostics[0]?.message).toBe('string');

      // API_INTERNAL_ORIGIN es server-only: ni el mensaje de conexión de Node ni el resto del
      // diagnóstico exponen el origen interno configurado (host:puerto o su forma completa).
      const rawUpstreamHost = downedApiInternalOrigin.replace('http://', '');
      for (const log of allLogs()) {
        const serialized = JSON.stringify(log);
        expect(serialized).not.toContain(downedApiInternalOrigin);
        expect(serialized).not.toContain(rawUpstreamHost);
      }
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

    it('corta el socket upstream por timeout y responde 502 explícito, no HTML, con diagnóstico UPSTREAM_TIMEOUT correlacionado', async () => {
      await startGateway(`http://127.0.0.1:${String(hangingUpstreamPort)}`, 100);

      const response = await fetch(`http://127.0.0.1:${String(gatewayPort)}/api/health`);

      expect(response.status).toBe(502);
      expect(response.headers.get('content-type')).toContain('application/json');
      await expect(response.json()).resolves.toEqual({ code: 'UPSTREAM_UNAVAILABLE' });
      await upstreamSocketClosed;

      const assignedRequestId = response.headers.get(REQUEST_ID_HEADER);
      expect(await waitForCompletionLogs(1)).toHaveLength(1);

      const diagnostics = upstreamUnavailableLogs();
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        requestId: assignedRequestId,
        code: 'UPSTREAM_TIMEOUT',
      });
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

      // Un aborto benigno del cliente libera recursos y deja su propia finalización, pero
      // nunca se inventa una falla de upstream: no hay upstream conectado que haya fallado.
      expect(await waitForCompletionLogs(1)).toHaveLength(1);
      expect(upstreamUnavailableLogs()).toHaveLength(0);
    });
  });
});
