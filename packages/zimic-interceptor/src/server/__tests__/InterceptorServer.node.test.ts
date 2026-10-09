import { HttpSchema } from '@zimic/http';
import { expectFetchError } from '@zimic/utils/fetch';
import { waitFor } from '@zimic/utils/time';
import { WebSocketClient as PublicWebSocketClient, type WebSocketSchema } from '@zimic/ws';
import { once } from 'events';
import { connect } from 'net';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket as NodeWebSocket } from 'ws';

import { verifyUnhandledRequestMessage } from '@/http/interceptor/__tests__/shared/utils';
import { INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER } from '@/interceptor/constants';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { createInternalHttpInterceptor, createInternalWebSocketInterceptor } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { DEFAULT_HOSTNAME, DEFAULT_LOG_UNHANDLED_REQUESTS } from '../constants';
import RunningInterceptorServerError from '../errors/RunningInterceptorServerError';
import InterceptorServer from '../InterceptorServer';
import { DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY } from '../utils/auth';

type ClientMessage = WebSocketSchema<{ type: 'client'; text: string }>;

// These are integration tests for the server. Only features not easily reproducible by the CLI and the remote
// interceptor tests are covered here. The main aspects of this class should be tested in the CLI and the remote
// interceptor tests.
describe('Interceptor server', () => {
  let server: InterceptorServer | undefined;

  afterEach(async () => {
    await server?.stop();
  });

  describe('Lifecycle', () => {
    it('should not throw an error is started multiple times', async () => {
      server = createInternalInterceptorServer();

      expect(server.isRunning).toBe(false);

      await server.start();
      expect(server.isRunning).toBe(true);

      await server.start();
      expect(server.isRunning).toBe(true);

      await server.start();
      expect(server.isRunning).toBe(true);
    });

    it('should not throw an error if stopped multiple times', async () => {
      server = createInternalInterceptorServer();

      expect(server.isRunning).toBe(false);

      await server.start();
      expect(server.isRunning).toBe(true);

      await server.stop();
      expect(server.isRunning).toBe(false);

      await server.stop();
      expect(server.isRunning).toBe(false);

      await server.stop();
      expect(server.isRunning).toBe(false);
    });

    it('should not throw an error if stopped at the same time a connected interceptor is stopped', async () => {
      server = createInternalInterceptorServer();

      await server.start();
      expect(server.isRunning).toBe(true);

      const interceptor = createInternalHttpInterceptor({
        type: 'remote',
        baseURL: `http://${server.hostname}:${server.port}`,
      });
      expect(interceptor.isRunning).toBe(false);

      await interceptor.start();
      expect(interceptor.isRunning).toBe(true);

      await Promise.all([server.stop(), interceptor.stop()]);

      expect(server.isRunning).toBe(false);
      expect(interceptor.isRunning).toBe(false);
    });

    it('should not throw an error if stopped at the same time a connected interceptor is cleared', async () => {
      server = createInternalInterceptorServer();

      await server.start();
      expect(server.isRunning).toBe(true);

      const interceptor = createInternalHttpInterceptor({
        type: 'remote',
        baseURL: `http://${server.hostname}:${server.port}`,
      });
      expect(interceptor.isRunning).toBe(false);

      try {
        await interceptor.start();

        expect(interceptor.isRunning).toBe(true);

        await Promise.all([server.stop(), interceptor.clear()]);

        expect(server.isRunning).toBe(false);
        expect(interceptor.isRunning).toBe(true);
      } finally {
        await interceptor.stop();

        expect(server.isRunning).toBe(false);
        expect(interceptor.isRunning).toBe(false);
      }
    });

    it('should only reset handlers of cleared interceptors, preserving handlers of other interceptors even if they share the same base URL', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });

      await server.start();
      expect(server.isRunning).toBe(true);

      type Schema = HttpSchema<{
        '/': {
          GET: {
            response: { 204: {} };
          };
        };
      }>;

      const interceptors = [
        createInternalHttpInterceptor<Schema>({
          type: 'remote',
          baseURL: `http://${server.hostname}:${server.port}/path`,
        }),
        createInternalHttpInterceptor<Schema>({
          type: 'remote',
          baseURL: `http://${server.hostname}:${server.port}/path`,
        }),
        createInternalHttpInterceptor<Schema>({
          type: 'remote',
          baseURL: `http://${server.hostname}:${server.port}/other-path`,
        }),
      ];

      expect(interceptors[0].baseURL).toBe(interceptors[1].baseURL);
      expect(interceptors[0].baseURL).not.toBe(interceptors[2].baseURL);

      for (const interceptor of interceptors) {
        expect(interceptor.isRunning).toBe(false);
      }

      try {
        await Promise.all(interceptors.map((interceptor) => interceptor.start()));

        for (const interceptor of interceptors) {
          expect(interceptor.isRunning).toBe(true);
        }

        const handlers = await Promise.all(
          interceptors.map((interceptor) => interceptor.get('/').respond({ status: 204 })),
        );

        let response = await fetch(interceptors[0].baseURL, { method: 'GET' });
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(1);
        expect(handlers[2].requests).toHaveLength(0);

        let responsePromise = fetch(interceptors[1].baseURL, { method: 'GET' });
        await interceptors[1].clear();

        response = await responsePromise;
        expect(response.status).toBe(204);

        expect(handlers[0].requests).toHaveLength(1); // Request was processed by the first handler
        expect(handlers[1].requests).toHaveLength(0);
        expect(handlers[2].requests).toHaveLength(0);

        responsePromise = fetch(interceptors[0].baseURL, { method: 'GET' });
        await interceptors[0].clear();
        await expectFetchError(responsePromise);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(0);
        expect(handlers[2].requests).toHaveLength(0);

        responsePromise = fetch(interceptors[2].baseURL, { method: 'GET' });
        await interceptors[2].clear();
        await expectFetchError(responsePromise);

        expect(handlers[0].requests).toHaveLength(0);
        expect(handlers[1].requests).toHaveLength(0);
        expect(handlers[2].requests).toHaveLength(0);
      } finally {
        await Promise.all(interceptors.map((interceptor) => interceptor.stop()));

        for (const interceptor of interceptors) {
          expect(interceptor.isRunning).toBe(false);
        }
      }
    });

    it('should preserve handlers of other interceptors when an interceptor with an overlapping base URL is stopped', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });

      await server.start();

      type Schema = HttpSchema<{
        '/users': { GET: { response: { 204: {} } } };
        '/posts': { GET: { response: { 204: {} } } };
        '/comments': { GET: { response: { 204: {} } } };
      }>;
      type OtherSchema = HttpSchema<{
        '/api/users': { GET: { response: { 200: {} } } };
        '/api/posts': { GET: { response: { 200: {} } } };
        '/api/comments': { GET: { response: { 200: {} } } };
      }>;

      const interceptor = createInternalHttpInterceptor<Schema>({
        type: 'remote',
        baseURL: `http://${server.hostname}:${server.port}/api`,
      });
      const otherInterceptor = createInternalHttpInterceptor<OtherSchema>({
        type: 'remote',
        baseURL: `http://${server.hostname}:${server.port}`,
      });

      expect(interceptor.baseURL).not.toBe(otherInterceptor.baseURL);

      try {
        await Promise.all([interceptor.start(), otherInterceptor.start()]);

        expect(interceptor.isRunning).toBe(true);
        expect(otherInterceptor.isRunning).toBe(true);

        await Promise.all([
          otherInterceptor.get('/api/users').respond({ status: 200 }),
          otherInterceptor.get('/api/posts').respond({ status: 200 }),
          otherInterceptor.get('/api/comments').respond({ status: 200 }),
        ]);

        await Promise.all([
          interceptor.get('/users').respond({ status: 204 }),
          interceptor.get('/posts').respond({ status: 204 }),
          interceptor.get('/comments').respond({ status: 204 }),
        ]);

        for (const path of ['/users', '/posts', '/comments']) {
          const response = await fetch(`${interceptor.baseURL}${path}`);
          expect(response.status).toBe(204);
        }

        await interceptor.stop();

        expect(interceptor.isRunning).toBe(false);
        expect(otherInterceptor.isRunning).toBe(true);

        for (const path of ['/users', '/posts', '/comments']) {
          const response = await fetch(`${interceptor.baseURL}${path}`);
          expect(response.status).toBe(200);
        }
      } finally {
        await Promise.all([interceptor.stop(), otherInterceptor.stop()]);
      }
    });
  });

  describe('WebSocket runtime', () => {
    it('should close application connections when the server stops', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      const baseURL = `ws://${server.hostname}:${server.port}`;
      const interceptor = createInternalWebSocketInterceptor<ClientMessage>({ type: 'remote', baseURL });
      const client = new PublicWebSocketClient<ClientMessage>(baseURL);
      const clientClosed = new Promise<void>((resolve) => {
        client.addEventListener('close', () => resolve(), { once: true });
      });

      try {
        await interceptor.start();
        await interceptor.message();
        await client.open();
        await waitFor(() => expect(interceptor.clients).toHaveLength(1));

        await server.stop();

        await clientClosed;
        expect(client.readyState).toBe(PublicWebSocketClient.CLOSED);
        await waitFor(() => expect(interceptor.clients).toHaveLength(0));
      } finally {
        await Promise.all([client.close(), interceptor.stop()]);
      }
    });
  });

  describe('WebSocket worker authorization', () => {
    it('should reject WebSocket worker events from an HTTP worker', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      const serverURL = `ws://${server.hostname}:${server.port}`;
      const workerSocket = new NodeWebSocket(serverURL, [
        encodeURIComponent(`${INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER}=http`),
      ]);

      try {
        await once(workerSocket, 'open');

        await usingIgnoredConsole(['error'], async (console) => {
          workerSocket.send(
            JSON.stringify({
              id: crypto.randomUUID(),
              channel: 'interceptors/ws/workers/commit',
              data: {
                id: 'not-a-websocket-worker',
                baseURL: serverURL,
              },
            }),
          );

          await waitFor(() => {
            expect(console.error).toHaveBeenCalledWith(
              new InvalidWebSocketMessageError('WebSocket RPC received from a non-WebSocket worker.'),
            );
          });
        });
      } finally {
        if (workerSocket.readyState === NodeWebSocket.OPEN) {
          const workerSocketClosed = once(workerSocket, 'close');
          workerSocket.close();
          await workerSocketClosed;
        }
      }
    });
  });

  describe('HTTP requests', () => {
    describe('CORS', () => {
      it('should allow CORS preflight requests when no interceptors are connected', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const response = await fetch(`http://${server.hostname}:${server.port}/users`, {
          method: 'OPTIONS',
          headers: {
            origin: 'http://localhost:3000',
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'content-type',
          },
        });

        expect(response.status).toBe(204);
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(response.headers.get('access-control-allow-methods')).toBe('GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS');
        expect(response.headers.get('access-control-allow-headers')).toBe('*');
        expect(await response.text()).toBe('');
      });
    });

    describe('Unhandled requests', () => {
      it('should reject and log requests when no interceptors are connected', async () => {
        server = createInternalInterceptorServer({ logUnhandledRequests: true });
        await server.start();

        const request = new Request(`http://${server.hostname}:${server.port}/users?tag=first&tag=second&page=1`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: 'hello' }),
        });

        await usingIgnoredConsole(['error'], async (console) => {
          await expectFetchError(fetch(request.clone()));

          expect(console.error).toHaveBeenCalledTimes(1);

          await verifyUnhandledRequestMessage(console.error.mock.calls[0].join(' '), {
            request,
            platform: 'node',
            type: 'reject',
          });
        });
      });
    });

    describe('Malformed requests', () => {
      it('should reject requests with incomplete bodies and continue accepting requests', async () => {
        server = createInternalInterceptorServer({ logUnhandledRequests: true });
        await server.start();

        await usingIgnoredConsole(['error'], async (console) => {
          const socket = connect({ host: server!.hostname, port: server!.port! });
          const socketClosed = once(socket, 'close');
          const responseChunks: Buffer[] = [];
          socket.on('data', (chunk: Buffer) => responseChunks.push(chunk));

          try {
            await once(socket, 'connect');
            socket.end(
              [
                'POST /users HTTP/1.1',
                `Host: ${server!.hostname}:${server!.port}`,
                'Content-Type: text/plain',
                'Content-Length: 20',
                '',
                'partial',
              ].join('\r\n'),
            );
            await socketClosed;

            expect(Buffer.concat(responseChunks).toString()).toMatch(/^(?:$|HTTP\/1\.1 4\d\d )/);

            await waitFor(() => {
              const diagnostics = console.error.mock.calls.map((call) => call.join(' ')).join('\n');
              expect(diagnostics).toContain('Failed to parse request body:');
              expect(diagnostics).toContain(`POST http://${server!.hostname}:${server!.port}/users`);
              expect(diagnostics).toContain('rejected');
            });

            const response = await fetch(`http://${server!.hostname}:${server!.port}/users`, { method: 'OPTIONS' });
            expect(response.status).toBe(204);
          } finally {
            socket.destroy();
          }
        });
      });

      it('should reject requests with invalid host headers and continue accepting requests', async () => {
        server = createInternalInterceptorServer({ logUnhandledRequests: true });
        await server.start();

        await usingIgnoredConsole(['error'], async () => {
          const socket = connect({ host: server!.hostname, port: server!.port! });
          const socketClosed = once(socket, 'close');
          const responseChunks: Buffer[] = [];
          socket.on('data', (chunk: Buffer) => responseChunks.push(chunk));

          try {
            await once(socket, 'connect');
            socket.end('GET /users HTTP/1.1\r\nHost: [invalid\r\n\r\n');
            await socketClosed;

            expect(Buffer.concat(responseChunks).toString()).toMatch(/^(?:$|HTTP\/1\.1 4\d\d )/);

            const response = await fetch(`http://${server!.hostname}:${server!.port}/users`, { method: 'OPTIONS' });
            expect(response.status).toBe(204);
          } finally {
            socket.destroy();
          }
        });
      });
    });
  });

  describe('Hostname', () => {
    it('should start correctly with a defined hostname', async () => {
      server = createInternalInterceptorServer({ hostname: '0.0.0.0', port: 8080 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe('0.0.0.0');
      expect(server.port).toBe(8080);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe('0.0.0.0');
      expect(server.port).toBe(8080);
    });

    it('should start correctly with an undefined hostname', async () => {
      server = createInternalInterceptorServer({ hostname: undefined });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(undefined);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toEqual(expect.any(Number));
    });

    it('should support changing the hostname after created', async () => {
      server = createInternalInterceptorServer({ hostname: undefined, port: 8080 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(8080);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(8080);

      const newHostname = '0.0.0.0';
      expect(newHostname).not.toBe(server.hostname);

      await server.stop();
      expect(server.isRunning).toBe(false);

      server.hostname = newHostname;

      await server.start();
      expect(server.isRunning).toBe(true);

      expect(server.hostname).toBe(newHostname);

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(newHostname);
      expect(server.port).toBe(8080);
    });

    it('should not support changing the hostname after created if the server is running', async () => {
      server = createInternalInterceptorServer({ port: 8080 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(8080);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(8080);

      const newHostname = '0.0.0.0';
      expect(newHostname).not.toBe(server.hostname);

      expect(server.isRunning).toBe(true);

      expect(() => {
        server!.hostname = newHostname;
      }).toThrow(new RunningInterceptorServerError('Did you forget to stop it before changing the hostname?'));

      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.hostname).not.toBe(newHostname);
    });
  });

  describe('Port', () => {
    it('should start correctly with a defined port', async () => {
      server = createInternalInterceptorServer({ port: 8080 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(8080);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(8080);
    });

    it('should start correctly with an undefined port', async () => {
      server = createInternalInterceptorServer({ port: undefined });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(undefined);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toEqual(expect.any(Number));
    });

    it('should support changing the port after created', async () => {
      server = createInternalInterceptorServer({ port: 5002 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(5002);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(5002);

      const newPort = 5003;
      expect(newPort).not.toBe(server.port);

      await server.stop();
      expect(server.isRunning).toBe(false);

      server.port = newPort;

      await server.start();
      expect(server.isRunning).toBe(true);

      expect(server.port).toBe(newPort);

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(newPort);
    });

    it('should not support changing the port after created if the server is running', async () => {
      server = createInternalInterceptorServer({ port: 5004 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(5004);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.hostname).toBe(DEFAULT_HOSTNAME);
      expect(server.port).toBe(5004);

      const newPort = 5005;
      expect(newPort).not.toBe(server.port);

      expect(server.isRunning).toBe(true);

      expect(() => {
        server!.port = newPort;
      }).toThrow(new RunningInterceptorServerError('Did you forget to stop it before changing the port?'));

      expect(server.port).toBe(5004);
      expect(server.port).not.toBe(newPort);
    });
  });

  describe('Log unhandled requests', () => {
    it('should start correctly with a defined log unhandled requests setting', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: true });

      expect(server.isRunning).toBe(false);
      expect(server.logUnhandledRequests).toBe(true);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.logUnhandledRequests).toBe(true);
    });

    it('should start correctly with an undefined log unhandled requests setting', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: undefined });

      expect(server.isRunning).toBe(false);
      expect(server.logUnhandledRequests).toBe(DEFAULT_LOG_UNHANDLED_REQUESTS);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.logUnhandledRequests).toBe(DEFAULT_LOG_UNHANDLED_REQUESTS);
    });

    it('should support changing the log unhandled requests setting after created', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: true });

      expect(server.isRunning).toBe(false);
      expect(server.logUnhandledRequests).toBe(true);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.logUnhandledRequests).toBe(true);

      const newLogUnhandledRequests = false;
      expect(newLogUnhandledRequests).not.toBe(server.logUnhandledRequests);

      server.logUnhandledRequests = newLogUnhandledRequests;
      expect(server.logUnhandledRequests).toBe(newLogUnhandledRequests);

      await server.stop();
      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.logUnhandledRequests).toBe(newLogUnhandledRequests);
    });
  });

  describe('Tokens directory', () => {
    it('should start correctly with a defined tokens directory', async () => {
      server = createInternalInterceptorServer({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });

      expect(server.isRunning).toBe(false);
      expect(server.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);
    });

    it('should start correctly with an undefined tokens directory', async () => {
      server = createInternalInterceptorServer({ tokensDirectory: undefined });

      expect(server.isRunning).toBe(false);
      expect(server.tokensDirectory).toBe(undefined);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.tokensDirectory).toBe(undefined);
    });

    it('should support changing the tokens directory after created', async () => {
      server = createInternalInterceptorServer({ tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY });

      expect(server.isRunning).toBe(false);
      expect(server.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.tokensDirectory).toBe(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY);

      const newTokensDirectory = path.join(DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY, 'other');
      expect(newTokensDirectory).not.toBe(server.tokensDirectory);

      server.tokensDirectory = newTokensDirectory;
      expect(server.tokensDirectory).toBe(newTokensDirectory);

      await server.stop();
      await server.start();

      expect(server.isRunning).toBe(true);
      expect(server.tokensDirectory).toBe(newTokensDirectory);
    });
  });
});
