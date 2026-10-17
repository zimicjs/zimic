import { HttpSchema } from '@zimic/http';
import { expectFetchError } from '@zimic/utils/fetch';
import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { once } from 'events';
import { connect } from 'net';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { verifyUnhandledRequestMessage } from '@/http/interceptor/__tests__/shared/utils';
import { INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER } from '@/interceptor/constants';
import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import InterceptorServerWebSocketClient from '@/utils/webSocket/WebSocketClient';
import { usingIgnoredConsole } from '@tests/utils/console';
import {
  createInternalHttpInterceptor,
  createInternalWebSocketInterceptor,
  usingWebSocketInterceptor,
  usingWebSocketInterceptorWorker,
} from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { DEFAULT_HOSTNAME, DEFAULT_LOG_UNHANDLED_REQUESTS } from '../constants';
import RunningInterceptorServerError from '../errors/RunningInterceptorServerError';
import InterceptorServer from '../InterceptorServer';
import type { InterceptorServerWebSocketSchema } from '../types/schema';
import { DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY } from '../utils/auth';

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

  describe('HTTP worker RPCs', () => {
    it('should reject resets with an invalid entry, preserving existing handlers and pending requests', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      const baseURL = `http://${server.hostname}:${server.port}/users`;
      const otherBaseURL = `http://${server.hostname}:${server.port}/posts`;

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
      });

      const rejectedRequests: Promise<unknown>[] = [];
      const handledRequestURLs: string[] = [];
      let releasePendingResponse!: () => void;
      const pendingResponseReleased = new Promise<void>((resolve) => {
        releasePendingResponse = resolve;
      });

      worker.onChannel('event', 'interceptors/http/responses/create', async ({ data }) => {
        handledRequestURLs.push(data.request.url);

        if (handledRequestURLs.length === 1) {
          await pendingResponseReleased;
        }

        return { response: { type: 'basic', status: 204, statusText: '', headers: {}, body: null } };
      });

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await worker.start({
            parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http' },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/http/workers/commit', {
            id: crypto.randomUUID(),
            baseURL,
            method: 'GET',
            path: '/',
          });

          const pendingResponsePromise = fetch(baseURL);
          await waitFor(() => expect(handledRequestURLs).toHaveLength(1));

          rejectedRequests.push(
            worker.request('interceptors/http/workers/reset', [
              { id: crypto.randomUUID(), baseURL: otherBaseURL, method: 'GET', path: '/' },
              { id: crypto.randomUUID(), baseURL: otherBaseURL, method: 'TRACE' as never, path: '/' },
            ]),
          );

          await waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError)));
          expect(console.error).toHaveBeenCalledTimes(1);

          releasePendingResponse();

          const pendingResponse = await pendingResponsePromise;
          expect(pendingResponse.status).toBe(204);

          const response = await fetch(baseURL);
          expect(response.status).toBe(204);
          expect(handledRequestURLs).toEqual([baseURL, baseURL]);

          await expectFetchError(fetch(otherBaseURL));
          expect(handledRequestURLs).toHaveLength(2);
        } finally {
          releasePendingResponse();
          await worker.stop();
          await Promise.allSettled(rejectedRequests);
        }
      });
    });

    it('should reject resets with a non-array payload, preserving existing handlers', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      const baseURL = `http://${server.hostname}:${server.port}/users`;

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
      });

      const rejectedRequests: Promise<unknown>[] = [];

      worker.onChannel('event', 'interceptors/http/responses/create', () => ({
        response: { type: 'basic', status: 204, statusText: '', headers: {}, body: null },
      }));

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await worker.start({
            parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http' },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/http/workers/commit', {
            id: crypto.randomUUID(),
            baseURL,
            method: 'GET',
            path: '/',
          });

          rejectedRequests.push(worker.request('interceptors/http/workers/reset', { invalid: true } as never));

          await waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError)));
          expect(console.error).toHaveBeenCalledTimes(1);

          const response = await fetch(baseURL);
          expect(response.status).toBe(204);
        } finally {
          await worker.stop();
          await Promise.allSettled(rejectedRequests);
        }
      });
    });

    it('should reject commits with an unsupported method', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      const baseURL = `http://${server.hostname}:${server.port}/users`;

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
      });

      const rejectedRequests: Promise<unknown>[] = [];
      const handledRequestURLs: string[] = [];

      worker.onChannel('event', 'interceptors/http/responses/create', ({ data }) => {
        handledRequestURLs.push(data.request.url);
        return { response: { type: 'basic', status: 204, statusText: '', headers: {}, body: null } };
      });

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await worker.start({
            parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http' },
            waitForAuthentication: true,
          });

          rejectedRequests.push(
            worker.request('interceptors/http/workers/commit', {
              id: crypto.randomUUID(),
              baseURL,
              method: 'TRACE' as never,
              path: '/',
            }),
          );

          await waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError)));
          expect(console.error).toHaveBeenCalledTimes(1);

          await expectFetchError(fetch(baseURL));
          expect(handledRequestURLs).toHaveLength(0);
        } finally {
          await worker.stop();
          await Promise.allSettled(rejectedRequests);
        }
      });
    });

    it('should reject commits with a non-HTTP base URL', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
      });

      const rejectedRequests: Promise<unknown>[] = [];

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await worker.start({
            parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http' },
            waitForAuthentication: true,
          });

          rejectedRequests.push(
            worker.request('interceptors/http/workers/commit', {
              id: crypto.randomUUID(),
              baseURL: `ws://${server!.hostname}:${server!.port}/users`,
              method: 'GET',
              path: '/',
            }),
          );

          await waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError)));
          expect(console.error).toHaveBeenCalledTimes(1);
        } finally {
          await worker.stop();
          await Promise.allSettled(rejectedRequests);
        }
      });
    });

    it('should reject malformed response replies and continue handling requests', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      const baseURL = `http://${server.hostname}:${server.port}/users`;

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
        messageTimeout: 500,
      });

      let handledRequestsCount = 0;

      worker.onChannel('event', 'interceptors/http/responses/create', () => {
        handledRequestsCount++;

        if (handledRequestsCount === 1) {
          return { response: { type: 'basic', status: 'ok' } } as never;
        }

        return { response: { type: 'basic', status: 204, statusText: '', headers: {}, body: null } };
      });

      worker.onChannel('event', 'interceptors/http/responses/unhandled', () => ({ wasLogged: false }));

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await worker.start({
            parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http' },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/http/workers/commit', {
            id: crypto.randomUUID(),
            baseURL,
            method: 'GET',
            path: '/',
          });

          await expectFetchError(fetch(baseURL));
          expect(console.error).toHaveBeenCalledTimes(1);
          expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError));

          const response = await fetch(baseURL);
          expect(response.status).toBe(204);
          expect(console.error).toHaveBeenCalledTimes(1);
        } finally {
          await worker.stop();
        }
      });
    });

    it('should log and reject requests when the unhandled request reply is malformed', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: true });
      await server.start();

      const baseURL = `http://${server.hostname}:${server.port}/api`;

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
        messageTimeout: 500,
      });

      worker.onChannel('event', 'interceptors/http/responses/unhandled', () => ({ wasLogged: 'yes' }) as never);

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await worker.start({
            parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http' },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/http/workers/commit', {
            id: crypto.randomUUID(),
            baseURL,
            method: 'GET',
            path: '/users',
          });

          const request = new Request(`${baseURL}/posts`);
          await expectFetchError(fetch(request.clone()));

          expect(console.error).toHaveBeenCalledTimes(2);
          expect(console.error).toHaveBeenNthCalledWith(1, expect.any(InvalidWebSocketMessageError));

          await verifyUnhandledRequestMessage(console.error.mock.calls[1].join(' '), {
            request,
            platform: 'node',
            type: 'reject',
          });
        } finally {
          await worker.stop();
        }
      });
    });

    it('should log and reject requests when the worker disconnects before replying to the unhandled request notification', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: true });
      await server.start();

      const baseURL = `http://${server.hostname}:${server.port}/api`;

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
        messageTimeout: 500,
      });

      let workerStopPromise: Promise<void> | undefined;

      worker.onChannel('event', 'interceptors/http/responses/unhandled', () => {
        workerStopPromise = worker.stop();
        return new Promise<never>(() => {
          // Never replies, keeping the request pending.
        });
      });

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await worker.start({
            parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http' },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/http/workers/commit', {
            id: crypto.randomUUID(),
            baseURL,
            method: 'GET',
            path: '/users',
          });

          const request = new Request(`${baseURL}/posts`);
          await expectFetchError(fetch(request.clone()));

          expect(console.error).toHaveBeenCalledTimes(1);

          await verifyUnhandledRequestMessage(console.error.mock.calls[0].join(' '), {
            request,
            platform: 'node',
            type: 'reject',
          });
        } finally {
          await worker.stop();
          await workerStopPromise;
        }
      });
    });

    it('should handle requests to the root of the base URL', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      const baseURL = `http://${server.hostname}:${server.port}`;

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
        messageTimeout: 500,
      });

      worker.onChannel('event', 'interceptors/http/responses/create', () => ({
        response: { type: 'basic', status: 204, statusText: '', headers: {}, body: null },
      }));

      try {
        await worker.start({
          parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http' },
          waitForAuthentication: true,
        });

        await worker.request('interceptors/http/workers/commit', {
          id: crypto.randomUUID(),
          baseURL,
          method: 'GET',
          path: '/',
        });

        const response = await fetch(`${baseURL}/`);
        expect(response.status).toBe(204);
      } finally {
        await worker.stop();
      }
    });

    it('should not allow WebSocket workers to commit or reset HTTP handlers', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      type Schema = HttpSchema<{ '/': { GET: { response: { 204: {} } } } }>;

      const interceptor = createInternalHttpInterceptor<Schema>({
        type: 'remote',
        baseURL: `http://${server.hostname}:${server.port}/users`,
      });
      const otherBaseURL = `http://${server.hostname}:${server.port}/posts`;

      const webSocketWorker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
      });

      const rejectedRequests: Promise<unknown>[] = [];

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await interceptor.start();
          await interceptor.get('/').respond({ status: 204 });

          await webSocketWorker.start({
            parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws' },
            waitForAuthentication: true,
          });

          rejectedRequests.push(
            webSocketWorker.request('interceptors/http/workers/commit', {
              id: crypto.randomUUID(),
              baseURL: otherBaseURL,
              method: 'GET',
              path: '/',
            }),
            webSocketWorker.request('interceptors/http/workers/reset', []),
          );

          await waitFor(() => expect(console.error).toHaveBeenCalledTimes(2));
          expect(console.error).toHaveBeenCalledWith(
            new InvalidWebSocketMessageError('HTTP RPC received from a non-HTTP worker.'),
          );

          await expectFetchError(fetch(otherBaseURL));

          const response = await fetch(interceptor.baseURL);
          expect(response.status).toBe(204);
        } finally {
          await webSocketWorker.stop();
          await Promise.allSettled(rejectedRequests);
          await interceptor.stop();
        }
      });
    });
  });

  describe('WebSocket connections', () => {
    type ChatMessage = WebSocketSchema<{ type: 'client' | 'server'; text: string }>;

    it('should not register WebSocket handlers committed by HTTP interceptor workers', async () => {
      server = createInternalInterceptorServer();
      await server.start();

      const baseURL = `ws://${server.hostname}:${server.port}/chat`;

      const httpWorkerClient = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
      });

      const rejectedRequests: Promise<unknown>[] = [];

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await httpWorkerClient.start({
            parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http' },
            waitForAuthentication: true,
          });

          rejectedRequests.push(
            httpWorkerClient.request('interceptors/ws/workers/commit', {
              id: crypto.randomUUID(),
              baseURL,
            }),
          );

          await waitFor(() =>
            expect(console.error).toHaveBeenCalledWith(
              new InvalidWebSocketMessageError('WebSocket RPC received from a non-WebSocket worker.'),
            ),
          );

          const client = new WebSocketClient<ChatMessage>(baseURL);
          const closeEventPromise = new Promise<WebSocketClient.CloseEvent<ChatMessage>>((resolve) => {
            client.addEventListener('close', resolve, { once: true });
          });

          await client.open();

          const closeEvent = await closeEventPromise;
          expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
          expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
        } finally {
          await httpWorkerClient.stop();
          await Promise.allSettled(rejectedRequests);
        }
      });
    });

    it('should not send messages from a WebSocket interceptor worker to clients of another worker', async () => {
      server = createInternalInterceptorServer();
      await server.start();

      const baseURL = `ws://${server.hostname}:${server.port}/chat`;

      await usingWebSocketInterceptor<ChatMessage>({ type: 'remote', baseURL }, async (interceptor) => {
        await interceptor.message();

        const client = new WebSocketClient<ChatMessage>(baseURL);
        const otherWorkerClient = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server!.hostname}:${server!.port}`,
        });

        try {
          await client.open();
          await waitFor(() => expect(interceptor.clients).toHaveLength(1));

          const receivedMessages: string[] = [];
          client.addEventListener('message', ({ data }) => {
            receivedMessages.push(data);
          });

          await otherWorkerClient.start({
            parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws' },
            waitForAuthentication: true,
          });

          const otherWorkerMessage = JSON.stringify({ type: 'server', text: 'other worker' } satisfies ChatMessage);
          otherWorkerClient.send('interceptors/ws/messages/send', {
            data: { type: 'text', data: otherWorkerMessage },
          });

          // A reply from the same worker socket guarantees the server already processed the previous send.
          await otherWorkerClient.request('interceptors/ws/workers/reset', []);

          const ownerMessage = JSON.stringify({ type: 'server', text: 'owner' } satisfies ChatMessage);
          interceptor.server.send(ownerMessage);

          await waitFor(() => expect(receivedMessages).toContain(ownerMessage));
          expect(receivedMessages).toEqual([ownerMessage]);
        } finally {
          await otherWorkerClient.stop();
          await client.close();
        }
      });
    });

    it('should keep client connections of retained handlers and close those of removed handlers when a worker is reset', async () => {
      server = createInternalInterceptorServer();
      await server.start();

      const serverURL = new URL(`http://${server.hostname}:${server.port}`);

      await usingWebSocketInterceptorWorker({ type: 'remote', serverURL }, async (worker) => {
        const removedInterceptor = createInternalWebSocketInterceptor<ChatMessage>({
          type: 'remote',
          baseURL: `ws://${server!.hostname}:${server!.port}/removed`,
        });
        const retainedInterceptor = createInternalWebSocketInterceptor<ChatMessage>({
          type: 'remote',
          baseURL: `ws://${server!.hostname}:${server!.port}/retained`,
        });

        await worker.use(removedInterceptor.implementation);
        await worker.use(retainedInterceptor.implementation);

        const removedClient = new WebSocketClient<ChatMessage>(removedInterceptor.baseURL);
        const retainedClient = new WebSocketClient<ChatMessage>(retainedInterceptor.baseURL);

        try {
          await removedClient.open();
          await retainedClient.open();
          await waitFor(() => expect(removedInterceptor.clients).toHaveLength(1));
          await waitFor(() => expect(retainedInterceptor.clients).toHaveLength(1));

          const removedCloseEventPromise = new Promise<WebSocketClient.CloseEvent<ChatMessage>>((resolve) => {
            removedClient.addEventListener('close', resolve, { once: true });
          });

          await worker.clearHandlers({ interceptor: removedInterceptor.implementation });

          const removedCloseEvent = await removedCloseEventPromise;
          expect(removedCloseEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);
          expect(retainedClient.readyState).toBe(WebSocketClient.OPEN);

          const retainedMessage = JSON.stringify({ type: 'server', text: 'retained' } satisfies ChatMessage);
          const retainedMessagePromise = new Promise<WebSocketClient.MessageEvent<ChatMessage>>((resolve) => {
            retainedClient.addEventListener('message', resolve, { once: true });
          });

          await worker.sendToClients(retainedInterceptor.implementation, retainedMessage);

          await expect(retainedMessagePromise).resolves.toMatchObject({ data: retainedMessage });
        } finally {
          await Promise.all([removedClient.close(), retainedClient.close()]);
        }
      });
    });

    it('should cleanly close client connections when stopped', async () => {
      server = createInternalInterceptorServer();
      await server.start();

      const baseURL = `ws://${server.hostname}:${server.port}/chat`;

      await usingWebSocketInterceptor<ChatMessage>({ type: 'remote', baseURL }, async (interceptor) => {
        await interceptor.message();

        const client = new WebSocketClient<ChatMessage>(baseURL);

        try {
          await client.open();
          await waitFor(() => expect(interceptor.clients).toHaveLength(1));

          const closeEventPromise = new Promise<WebSocketClient.CloseEvent<ChatMessage>>((resolve) => {
            client.addEventListener('close', resolve, { once: true });
          });

          await server!.stop();

          const closeEvent = await closeEventPromise;
          expect(closeEvent.wasClean).toBe(true);
          expect(server!.isRunning).toBe(false);
          expect(client.readyState).toBe(WebSocketClient.CLOSED);
        } finally {
          await client.close();
        }
      });
    });

    describe('Worker RPCs', () => {
      it('should reject resets with an invalid entry, preserving existing handlers and client connections', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/retained`;
        const otherBaseURL = `ws://${server.hostname}:${server.port}/other`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });
        worker.onChannel('event', 'interceptors/ws/clients/connect', () => ({ accepted: true }));

        const rejectedRequests: Promise<unknown>[] = [];
        const client = new WebSocketClient<ChatMessage>(baseURL);
        const otherClient = new WebSocketClient<ChatMessage>(otherBaseURL);

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws' },
              waitForAuthentication: true,
            });

            await worker.request('interceptors/ws/workers/commit', { id: crypto.randomUUID(), baseURL });

            await client.open();

            const receivedMessages: string[] = [];
            client.addEventListener('message', ({ data }) => {
              receivedMessages.push(data);
            });

            rejectedRequests.push(
              worker.request('interceptors/ws/workers/reset', [
                { id: crypto.randomUUID(), baseURL: otherBaseURL },
                { id: crypto.randomUUID(), baseURL: `http://${server!.hostname}:${server!.port}/invalid` },
              ]),
            );

            await waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError)));
            expect(console.error).toHaveBeenCalledTimes(1);

            expect(client.readyState).toBe(WebSocketClient.OPEN);

            const message = JSON.stringify({ type: 'server', text: 'retained' } satisfies ChatMessage);
            worker.send('interceptors/ws/messages/send', { data: { type: 'text', data: message } });
            await waitFor(() => expect(receivedMessages).toEqual([message]));

            const otherCloseEventPromise = new Promise<WebSocketClient.CloseEvent<ChatMessage>>((resolve) => {
              otherClient.addEventListener('close', resolve, { once: true });
            });

            await otherClient.open();

            const otherCloseEvent = await otherCloseEventPromise;
            expect(otherCloseEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
            expect(otherCloseEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
          } finally {
            await Promise.all([client.close(), otherClient.close()]);
            await worker.stop();
            await Promise.allSettled(rejectedRequests);
          }
        });
      });

      it('should reject commits with an invalid id', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const rejectedRequests: Promise<unknown>[] = [];
        const client = new WebSocketClient<ChatMessage>(baseURL);

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws' },
              waitForAuthentication: true,
            });

            rejectedRequests.push(worker.request('interceptors/ws/workers/commit', { id: 1 as never, baseURL }));

            await waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError)));
            expect(console.error).toHaveBeenCalledTimes(1);

            const closeEventPromise = new Promise<WebSocketClient.CloseEvent<ChatMessage>>((resolve) => {
              client.addEventListener('close', resolve, { once: true });
            });

            await client.open();

            const closeEvent = await closeEventPromise;
            expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
            expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
          } finally {
            await client.close();
            await worker.stop();
            await Promise.allSettled(rejectedRequests);
          }
        });
      });

      it('should reject commits with a non-WebSocket base URL', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const rejectedRequests: Promise<unknown>[] = [];

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws' },
              waitForAuthentication: true,
            });

            rejectedRequests.push(
              worker.request('interceptors/ws/workers/commit', {
                id: crypto.randomUUID(),
                baseURL: `http://${server!.hostname}:${server!.port}/chat`,
              }),
            );

            await waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError)));
            expect(console.error).toHaveBeenCalledTimes(1);
          } finally {
            await worker.stop();
            await Promise.allSettled(rejectedRequests);
          }
        });
      });

      it('should reject malformed messages sent to clients and continue delivering valid messages', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
          messageTimeout: 500,
        });
        worker.onChannel('event', 'interceptors/ws/clients/connect', () => ({ accepted: true }));

        const client = new WebSocketClient<ChatMessage>(baseURL);

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws' },
              waitForAuthentication: true,
            });

            await worker.request('interceptors/ws/workers/commit', { id: crypto.randomUUID(), baseURL });

            await client.open();

            const receivedMessages: string[] = [];
            client.addEventListener('message', ({ data }) => {
              receivedMessages.push(data);
            });

            worker.send('interceptors/ws/messages/send', { data: { type: 'binary', data: 'not base64!' } });
            worker.send('interceptors/ws/messages/send', { data: { type: 'unknown', data: 'text' } as never });
            worker.send('interceptors/ws/messages/send', {
              clientId: 1 as never,
              data: { type: 'text', data: 'text' },
            });

            const validMessage = JSON.stringify({ type: 'server', text: 'valid' } satisfies ChatMessage);
            worker.send('interceptors/ws/messages/send', { data: { type: 'text', data: validMessage } });

            await waitFor(() => expect(receivedMessages).toEqual([validMessage]));
            expect(console.error).toHaveBeenCalledTimes(3);
            expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError));
          } finally {
            await client.close();
            await worker.stop();
          }
        });
      });

      it('should deliver arbitrary application messages sent to clients', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
          messageTimeout: 500,
        });
        worker.onChannel('event', 'interceptors/ws/clients/connect', () => ({ accepted: true }));

        const client = new WebSocketClient<ChatMessage>(baseURL);

        try {
          await worker.start({
            parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws' },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/ws/workers/commit', { id: crypto.randomUUID(), baseURL });

          await client.open();

          const receivedMessages: string[] = [];
          client.addEventListener('message', ({ data }) => {
            receivedMessages.push(data);
          });

          const messages = ['not json {', '', '{"unrelated":[1,2,3]}', 'ação 🚀'];

          for (const message of messages) {
            worker.send('interceptors/ws/messages/send', { data: { type: 'text', data: message } });
          }

          await waitFor(() => expect(receivedMessages).toEqual(messages));
        } finally {
          await client.close();
          await worker.stop();
        }
      });

      it('should close client connections when the connection reply is malformed and accept later connections', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
          messageTimeout: 500,
        });

        let connectionRequestsCount = 0;

        worker.onChannel('event', 'interceptors/ws/clients/connect', () => {
          connectionRequestsCount++;
          return connectionRequestsCount === 1 ? ({ accepted: 'yes' } as never) : { accepted: true };
        });

        const client = new WebSocketClient<ChatMessage>(baseURL);
        const otherClient = new WebSocketClient<ChatMessage>(baseURL);

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws' },
              waitForAuthentication: true,
            });

            await worker.request('interceptors/ws/workers/commit', { id: crypto.randomUUID(), baseURL });

            const closeEventPromise = new Promise<WebSocketClient.CloseEvent<ChatMessage>>((resolve) => {
              client.addEventListener('close', resolve, { once: true });
            });

            await client.open();

            const closeEvent = await closeEventPromise;
            expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
            expect(closeEvent.reason).toBe('Could not connect to the WebSocket interceptor.');

            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError));

            const receivedMessages: string[] = [];
            otherClient.addEventListener('message', ({ data }) => {
              receivedMessages.push(data);
            });

            await otherClient.open();

            const message = JSON.stringify({ type: 'server', text: 'accepted' } satisfies ChatMessage);
            worker.send('interceptors/ws/messages/send', { data: { type: 'text', data: message } });

            await waitFor(() => expect(receivedMessages).toEqual([message]));
          } finally {
            await Promise.all([client.close(), otherClient.close()]);
            await worker.stop();
          }
        });
      });

      it('should close pending client connections when their handler is removed by a worker reset and accept later connections', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
          messageTimeout: 500,
        });

        let connectionRequestsCount = 0;

        worker.onChannel('event', 'interceptors/ws/clients/connect', () => {
          connectionRequestsCount++;
          return connectionRequestsCount === 1
            ? new Promise<never>(() => {
                // Never replies, keeping the request pending.
              })
            : { accepted: true };
        });

        const client = new WebSocketClient<ChatMessage>(baseURL);
        const otherClient = new WebSocketClient<ChatMessage>(baseURL);

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws' },
              waitForAuthentication: true,
            });

            await worker.request('interceptors/ws/workers/commit', { id: crypto.randomUUID(), baseURL });

            const closeEventPromise = new Promise<WebSocketClient.CloseEvent<ChatMessage>>((resolve) => {
              client.addEventListener('close', resolve, { once: true });
            });

            await client.open();
            await waitFor(() => expect(connectionRequestsCount).toBe(1));

            await worker.request('interceptors/ws/workers/reset', []);

            const closeEvent = await closeEventPromise;
            expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);

            expect(console.error).not.toHaveBeenCalled();

            await worker.request('interceptors/ws/workers/commit', { id: crypto.randomUUID(), baseURL });

            const receivedMessages: string[] = [];
            otherClient.addEventListener('message', ({ data }) => {
              receivedMessages.push(data);
            });

            await otherClient.open();

            const message = JSON.stringify({ type: 'server', text: 'accepted' } satisfies ChatMessage);
            worker.send('interceptors/ws/messages/send', { data: { type: 'text', data: message } });

            await waitFor(() => expect(receivedMessages).toEqual([message]));
            expect(connectionRequestsCount).toBe(2);
          } finally {
            await Promise.all([client.close(), otherClient.close()]);
            await worker.stop();
          }
        });
      });

      it('should not allow HTTP workers to reset WebSocket handlers or send messages to their clients', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        await usingWebSocketInterceptor<ChatMessage>({ type: 'remote', baseURL }, async (interceptor) => {
          await interceptor.message();

          const client = new WebSocketClient<ChatMessage>(baseURL);
          const httpWorker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
            url: `ws://${server!.hostname}:${server!.port}`,
          });

          const rejectedRequests: Promise<unknown>[] = [];

          await usingIgnoredConsole(['error'], async (console) => {
            try {
              await client.open();
              await waitFor(() => expect(interceptor.clients).toHaveLength(1));

              const receivedMessages: string[] = [];
              client.addEventListener('message', ({ data }) => {
                receivedMessages.push(data);
              });

              await httpWorker.start({
                parameters: { [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http' },
                waitForAuthentication: true,
              });

              const httpWorkerMessage = JSON.stringify({ type: 'server', text: 'http worker' } satisfies ChatMessage);
              httpWorker.send('interceptors/ws/messages/send', { data: { type: 'text', data: httpWorkerMessage } });

              rejectedRequests.push(httpWorker.request('interceptors/ws/workers/reset', []));

              await waitFor(() => expect(console.error).toHaveBeenCalledTimes(2));
              expect(console.error).toHaveBeenCalledWith(
                new InvalidWebSocketMessageError('WebSocket RPC received from a non-WebSocket worker.'),
              );

              expect(client.readyState).toBe(WebSocketClient.OPEN);
              expect(interceptor.clients).toHaveLength(1);

              const ownerMessage = JSON.stringify({ type: 'server', text: 'owner' } satisfies ChatMessage);
              interceptor.server.send(ownerMessage);

              await waitFor(() => expect(receivedMessages).toContain(ownerMessage));
              expect(receivedMessages).toEqual([ownerMessage]);
            } finally {
              await httpWorker.stop();
              await Promise.allSettled(rejectedRequests);
              await client.close();
            }
          });
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
