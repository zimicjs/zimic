import { HttpSchema } from '@zimic/http';
import { createPromiseWithResolvers } from '@zimic/utils/data';
import { expectFetchError } from '@zimic/utils/fetch';
import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { once } from 'events';
import ClientSocket from 'isomorphic-ws';
import { connect } from 'net';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { version } from '@@/package.json';

import { verifyUnhandledRequestMessage } from '@/http/interceptor/__tests__/shared/utils';
import {
  INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER,
  INTERCEPTOR_SERVER_RPC_VERSION,
  INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER,
} from '@/interceptor/constants';
import { DEFAULT_WEB_SOCKET_MESSAGE_TIMEOUT, WebSocketMessageTimeoutError } from '@/utils/webSocket';
import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import InterceptorServerWebSocketClient from '@/utils/webSocket/WebSocketClient';
import { usingIgnoredConsole } from '@tests/utils/console';
import {
  createInternalHttpInterceptor,
  createInternalWebSocketInterceptor,
  usingHttpInterceptor,
  usingWebSocketInterceptor,
  usingWebSocketInterceptorWorker,
} from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';
import {
  collectWebSocketClientMessages,
  waitForWebSocketClientClose,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import { DEFAULT_HOSTNAME, DEFAULT_LOG_UNHANDLED_REQUESTS } from '../constants';
import RunningInterceptorServerError from '../errors/RunningInterceptorServerError';
import InterceptorServer from '../InterceptorServer';
import type { InterceptorServerWebSocketSchema, WebSocketClientConnectionReply } from '../types/schema';
import { DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY } from '../utils/auth';
import WebSocketInterceptorServerRuntime from '../ws/WebSocketInterceptorServerRuntime';

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

    it('should handle HTTP requests after restarted if an HTTP worker connected while stopping', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      const baseURL = `http://${server.hostname}:${server.port}`;

      // No public signal tells when stop has started without finishing, so the WebSocket runtime stop is held open to
      // let an HTTP worker connect deterministically while the server is stopping.
      const webSocketRuntimeStopRelease = createPromiseWithResolvers<void>();
      const originalWebSocketRuntimeStop = WebSocketInterceptorServerRuntime.prototype.stop;

      const webSocketRuntimeStopSpy = vi
        .spyOn(WebSocketInterceptorServerRuntime.prototype, 'stop')
        .mockImplementationOnce(async function (this: WebSocketInterceptorServerRuntime) {
          await webSocketRuntimeStopRelease;
          await originalWebSocketRuntimeStop.call(this);
        });

      const stoppingWorker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
      });

      try {
        const stopPromise = server.stop();

        await stoppingWorker.start({
          parameters: {
            [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
            [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
          },
          waitForAuthentication: true,
        });

        webSocketRuntimeStopRelease.resolve();
        await stopPromise;
        expect(server.isRunning).toBe(false);
      } finally {
        webSocketRuntimeStopRelease.resolve();
        webSocketRuntimeStopSpy.mockRestore();
        await stoppingWorker.stop();
      }

      await server.start();
      expect(server.isRunning).toBe(true);

      type Schema = HttpSchema<{ '/users': { GET: { response: { 204: {} } } } }>;

      await usingHttpInterceptor<Schema>({ type: 'remote', baseURL }, async (interceptor) => {
        await interceptor.get('/users').respond({ status: 204 });

        const response = await fetch(`${baseURL}/users`);
        expect(response.status).toBe(204);
      });
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
      it('should reject requests before an HTTP worker connects when unhandled request logging is disabled', async () => {
        server = createInternalInterceptorServer({ logUnhandledRequests: false });
        await server.start();

        await expectFetchError(fetch(`http://${server.hostname}:${server.port}/resource`));
      });

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

            // Respond with an incomplete body to simulate a malformed request.
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

            // Send a request with an invalid host header to simulate a malformed request.
            socket.end('GET /users HTTP/1.1\r\nHost: [invalid\r\n\r\n');

            await socketClosed;

            expect(Buffer.concat(responseChunks).toString()).toMatch(
              /^(?:$|HTTP\/1\.1 4\d\d |HTTP\/1\.1 500 Internal Server Error\r\nContent-Length: 0\r\nContent-Length: 1\r\n\r\n$)/,
            );

            const response = await fetch(`http://${server!.hostname}:${server!.port}/users`, { method: 'OPTIONS' });
            expect(response.status).toBe(204);
          } finally {
            socket.destroy();
          }
        });
      });
    });
  });

  describe('Worker connections', () => {
    // Remote interceptors always send the RPC version of the installed package, so a raw RPC client simulates workers
    // on other versions.
    const otherWorkerRPCVersion = String(INTERCEPTOR_SERVER_RPC_VERSION + 1);

    it.each([
      { protocol: 'http', scenario: 'missing', workerRPCVersion: undefined },
      { protocol: 'ws', scenario: 'missing', workerRPCVersion: undefined },
      { protocol: 'http', scenario: 'different', workerRPCVersion: otherWorkerRPCVersion },
      { protocol: 'ws', scenario: 'different', workerRPCVersion: otherWorkerRPCVersion },
    ] as const)(
      'should reject $protocol workers if their RPC version is $scenario',
      async ({ protocol, workerRPCVersion }) => {
        server = createInternalInterceptorServer();
        await server.start();

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        try {
          const startPromise = worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: protocol,
              ...(workerRPCVersion === undefined
                ? {}
                : { [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: workerRPCVersion }),
            },
            waitForAuthentication: true,
          });

          await expect(startPromise).rejects.toThrow(UnauthorizedWebSocketConnectionError);
          await expect(startPromise).rejects.toThrow(
            `Interceptor is incompatible with server ${version}. ` +
              'Use the same @zimic/interceptor version in both. (code 1008)',
          );

          expect(worker.isRunning).toBe(false);
        } finally {
          await worker.stop();
        }
      },
    );
  });

  describe('HTTP worker RPCs', () => {
    it('should reject resets with an invalid base URL, preserving existing base URLs and pending requests', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      const baseURL = `http://${server.hostname}:${server.port}/users`;
      const otherBaseURL = `http://${server.hostname}:${server.port}/posts`;

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
      });

      const rejectedRequests: Promise<unknown>[] = [];
      const handledRequestURLs: string[] = [];

      const pendingResponseReleasedPromise = createPromiseWithResolvers();

      worker.onChannel('event', 'interceptors/http/requests/handle', async ({ data }) => {
        handledRequestURLs.push(data.request.url);

        if (handledRequestURLs.length === 1) {
          await pendingResponseReleasedPromise;
        }

        return {
          response: { type: 'basic', status: 204, statusText: '', headers: {}, body: null },
          matchedSomeHandler: true,
          wasUnhandledRequestLogged: false,
        };
      });

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/http/workers/reset', { interceptorBaseURLs: [baseURL] });

          const pendingResponsePromise = fetch(baseURL);

          await waitFor(() => {
            expect(handledRequestURLs).toHaveLength(1);
          });

          rejectedRequests.push(
            worker.request('interceptors/http/workers/reset', {
              interceptorBaseURLs: [otherBaseURL, `ws://${server!.hostname}:${server!.port}/chat`],
            }),
          );

          await waitFor(() => {
            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError));
          });

          pendingResponseReleasedPromise.resolve();

          const pendingResponse = await pendingResponsePromise;
          expect(pendingResponse.status).toBe(204);

          const response = await fetch(baseURL);
          expect(response.status).toBe(204);
          expect(handledRequestURLs).toEqual([baseURL, baseURL]);

          await expectFetchError(fetch(otherBaseURL));
          expect(handledRequestURLs).toHaveLength(2);
        } finally {
          pendingResponseReleasedPromise.resolve();
          await worker.stop();
          await Promise.allSettled(rejectedRequests);
        }
      });
    });

    it('should reject resets with an invalid payload, preserving existing base URLs', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      const baseURL = `http://${server.hostname}:${server.port}/users`;

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
      });

      const rejectedRequests: Promise<unknown>[] = [];

      worker.onChannel('event', 'interceptors/http/requests/handle', () => ({
        response: { type: 'basic', status: 204, statusText: '', headers: {}, body: null },
        matchedSomeHandler: true,
        wasUnhandledRequestLogged: false,
      }));

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/http/workers/reset', { interceptorBaseURLs: [baseURL] });

          rejectedRequests.push(worker.request('interceptors/http/workers/reset', { invalid: true } as never));

          await waitFor(() => {
            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError));
          });

          const response = await fetch(baseURL);
          expect(response.status).toBe(204);
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

      worker.onChannel('event', 'interceptors/http/requests/handle', () => {
        handledRequestsCount++;

        if (handledRequestsCount === 1) {
          return {
            response: { type: 'basic', status: 'ok' },
            matchedSomeHandler: true,
            wasUnhandledRequestLogged: false,
          } as never;
        }

        return {
          response: { type: 'basic', status: 204, statusText: '', headers: {}, body: null },
          matchedSomeHandler: true,
          wasUnhandledRequestLogged: false,
        };
      });

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/http/workers/reset', { interceptorBaseURLs: [baseURL] });

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

    it('should log and reject requests when the request handling reply is malformed', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: true });
      await server.start();

      const baseURL = `http://${server.hostname}:${server.port}/api`;

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
        messageTimeout: 500,
      });

      worker.onChannel(
        'event',
        'interceptors/http/requests/handle',
        () => ({ response: null, matchedSomeHandler: false, wasUnhandledRequestLogged: 'yes' }) as never,
      );

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/http/workers/reset', { interceptorBaseURLs: [baseURL] });

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

    it('should log and reject requests when the worker disconnects before replying to the request handling RPC', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: true });
      await server.start();

      const baseURL = `http://${server.hostname}:${server.port}/api`;

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
        messageTimeout: 500,
      });

      let workerStopPromise: Promise<void> | undefined;

      const unresolvedResponsePromise = createPromiseWithResolvers<{
        response: null;
        matchedSomeHandler: boolean;
        wasUnhandledRequestLogged: boolean;
      }>();

      worker.onChannel('event', 'interceptors/http/requests/handle', () => {
        workerStopPromise = worker.stop();
        // Never replies within the handler, keeping the request pending.
        return unresolvedResponsePromise;
      });

      await usingIgnoredConsole(['error'], async (console) => {
        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/http/workers/reset', { interceptorBaseURLs: [baseURL] });

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
          unresolvedResponsePromise.resolve({
            response: null,
            matchedSomeHandler: false,
            wasUnhandledRequestLogged: true,
          });
          await Promise.all([workerStopPromise, unresolvedResponsePromise]);
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

      worker.onChannel('event', 'interceptors/http/requests/handle', () => ({
        response: { type: 'basic', status: 204, statusText: '', headers: {}, body: null },
        matchedSomeHandler: true,
        wasUnhandledRequestLogged: false,
      }));

      try {
        await worker.start({
          parameters: {
            [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
            [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
          },
          waitForAuthentication: true,
        });

        await worker.request('interceptors/http/workers/reset', { interceptorBaseURLs: [baseURL] });

        const response = await fetch(`${baseURL}/`);
        expect(response.status).toBe(204);
      } finally {
        await worker.stop();
      }
    });

    it('should not handle requests with a worker whose base URL is the root of another port starting with the server port', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      const otherPortBaseURL = `http://${server.hostname}:${String(server.port).slice(0, -1)}`;

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
        messageTimeout: 500,
      });

      const handleRequestListener = vi.fn(() => ({
        response: { type: 'basic' as const, status: 204, statusText: '', headers: {}, body: null },
        matchedSomeHandler: true,
        wasUnhandledRequestLogged: false,
      }));
      worker.onChannel('event', 'interceptors/http/requests/handle', handleRequestListener);

      try {
        await worker.start({
          parameters: {
            [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
            [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
          },
          waitForAuthentication: true,
        });

        await worker.request('interceptors/http/workers/reset', { interceptorBaseURLs: [otherPortBaseURL] });

        await expectFetchError(fetch(`http://${server.hostname}:${server.port}/`));

        expect(handleRequestListener).not.toHaveBeenCalled();
      } finally {
        await worker.stop();
      }
    });

    it('should not allow WebSocket workers to reset HTTP workers', async () => {
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
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          rejectedRequests.push(
            webSocketWorker.request('interceptors/http/workers/reset', { interceptorBaseURLs: [otherBaseURL] }),
          );

          await waitFor(() => {
            expect(console.error).toHaveBeenCalledTimes(1);
          });
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

    it('should not register WebSocket interceptors reset by HTTP interceptor workers', async () => {
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
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          rejectedRequests.push(
            httpWorkerClient.request('interceptors/ws/workers/reset', {
              interceptors: [{ id: crypto.randomUUID(), baseURL }],
            }),
          );

          await waitFor(() => {
            expect(console.error).toHaveBeenCalledWith(
              new InvalidWebSocketMessageError('WebSocket RPC received from a non-WebSocket worker.'),
            );
          });

          const client = new WebSocketClient<ChatMessage>(baseURL);
          const closeEventPromise = waitForWebSocketClientClose(client);

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

      const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
      });
      const otherWorker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
        url: `ws://${server.hostname}:${server.port}`,
      });

      const connectionPromise = createPromiseWithResolvers<{ clientId: string }>();

      worker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
        connectionPromise.resolve(data);
        return { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
      });

      const client = new WebSocketClient<ChatMessage>(baseURL);

      try {
        for (const workerClient of [worker, otherWorker]) {
          await workerClient.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });
        }

        await worker.request('interceptors/ws/workers/reset', {
          interceptors: [{ id: crypto.randomUUID(), baseURL }],
        });

        const receivedMessages = collectWebSocketClientMessages(client);

        await client.open();
        const { clientId } = await connectionPromise;

        const otherWorkerMessage = JSON.stringify({ type: 'server', text: 'other worker' } satisfies ChatMessage);
        otherWorker.send('interceptors/ws/messages/send', {
          clientId,
          data: { type: 'text', data: otherWorkerMessage },
        });

        // A reply from the same worker socket guarantees the server already processed the previous send.
        await otherWorker.request('interceptors/ws/workers/reset', { interceptors: [] });

        const ownerMessage = JSON.stringify({ type: 'server', text: 'owner' } satisfies ChatMessage);
        worker.send('interceptors/ws/messages/send', { clientId, data: { type: 'text', data: ownerMessage } });

        await waitFor(() => {
          expect(receivedMessages).toEqual([ownerMessage]);
        });
      } finally {
        await client.close();
        await otherWorker.stop();
        await worker.stop();
      }
    });

    it('should keep client connections of retained interceptors and close those of removed interceptors when a worker is reset', async () => {
      server = createInternalInterceptorServer();
      await server.start();

      const serverURL = new URL(`ws://${server.hostname}:${server.port}`);

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

          await waitFor(() => {
            expect(removedInterceptor.clients).toHaveLength(1);
          });

          await waitFor(() => {
            expect(retainedInterceptor.clients).toHaveLength(1);
          });

          const removedCloseEventPromise = waitForWebSocketClientClose(removedClient);

          await worker.clearHandlers({ interceptor: removedInterceptor.implementation });

          const removedCloseEvent = await removedCloseEventPromise;
          expect(removedCloseEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);
          expect(retainedClient.readyState).toBe(WebSocketClient.OPEN);

          const retainedMessage = JSON.stringify({ type: 'server', text: 'retained' } satisfies ChatMessage);
          const retainedMessagePromise = waitForWebSocketClientMessage(retainedClient);

          await worker.sendToClients(retainedInterceptor.implementation, retainedMessage);

          await expect(retainedMessagePromise).resolves.toBe(retainedMessage);
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
        const client = new WebSocketClient<ChatMessage>(baseURL);

        try {
          await client.open();

          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          const closeEventPromise = waitForWebSocketClientClose(client);

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

    it('should accept client connections that request a protocol with URL-encoded characters', async () => {
      server = createInternalInterceptorServer();
      await server.start();

      const baseURL = `ws://${server.hostname}:${server.port}/chat`;

      await usingWebSocketInterceptor<ChatMessage>({ type: 'remote', baseURL }, async (interceptor) => {
        const client = new WebSocketClient<ChatMessage>(baseURL, ['v1%beta']);

        try {
          await client.open();
          await waitFor(() => expect(interceptor.clients).toHaveLength(1));

          expect(client.readyState).toBe(WebSocketClient.OPEN);
        } finally {
          await client.close();
        }
      });
    });

    it('should close worker connections that request an unknown RPC protocol', async () => {
      server = createInternalInterceptorServer();
      await server.start();

      const worker = new ClientSocket(`ws://${server.hostname}:${server.port}`, [
        encodeURIComponent(`${INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER}=unknown`),
        encodeURIComponent(`${INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER}=${INTERCEPTOR_SERVER_RPC_VERSION}`),
      ]);

      try {
        const closeEvent = await new Promise<ClientSocket.CloseEvent>((resolve) => {
          worker.addEventListener('close', resolve, { once: true });
        });

        expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.POLICY_VIOLATION);
        expect(closeEvent.reason).toBe('Invalid interceptor worker protocol.');
      } finally {
        worker.terminate();
      }
    });

    describe('Worker RPCs', () => {
      it('should close pending client connections when stopped', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const connectionReceivedPromise = createPromiseWithResolvers<void>();

        worker.onChannel('event', 'interceptors/ws/clients/connect', () => {
          connectionReceivedPromise.resolve();
          return new Promise<never>(() => {
            // Never replies, keeping the connection pending until the server stops.
          });
        });

        const client = new WebSocketClient<ChatMessage>(baseURL);

        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/ws/workers/reset', {
            interceptors: [{ id: crypto.randomUUID(), baseURL }],
          });

          const closeEventPromise = waitForWebSocketClientClose(client);

          // The server answers the handshake only after the worker decides the connection, so the client never opens.
          const openRejectionExpectation = expect(client.open()).rejects.toBeInstanceOf(Event);
          await connectionReceivedPromise;

          await server.stop();

          await openRejectionExpectation;

          const closeEvent = await closeEventPromise;
          expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.ABNORMAL_CLOSURE);
          expect(client.readyState).toBe(WebSocketClient.CLOSED);
        } finally {
          await client.close();
          await worker.stop();
        }
      });

      it('should deliver messages only to the targeted client', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/first`;
        const otherBaseURL = `ws://${server.hostname}:${server.port}/second`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const connectionPromise = createPromiseWithResolvers<{ clientId: string }>();
        const otherConnectionPromise = createPromiseWithResolvers<{ clientId: string }>();

        worker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
          const targetConnectionPromise = data.url === otherBaseURL ? otherConnectionPromise : connectionPromise;
          targetConnectionPromise.resolve(data);
          return { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
        });

        const client = new WebSocketClient<ChatMessage>(baseURL);
        const otherClient = new WebSocketClient<ChatMessage>(otherBaseURL);

        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/ws/workers/reset', {
            interceptors: [
              { id: crypto.randomUUID(), baseURL },
              { id: crypto.randomUUID(), baseURL: otherBaseURL },
            ],
          });

          const receivedMessages: string[] = [];
          const otherReceivedMessages: string[] = [];
          client.addEventListener('message', ({ data }) => {
            receivedMessages.push(data);
          });
          otherClient.addEventListener('message', ({ data }) => {
            otherReceivedMessages.push(data);
          });

          await Promise.all([client.open(), otherClient.open()]);
          const { clientId } = await connectionPromise;
          const { clientId: otherClientId } = await otherConnectionPromise;

          worker.send('interceptors/ws/messages/send', { clientId, data: { type: 'text', data: 'first' } });
          worker.send('interceptors/ws/messages/send', {
            clientId: otherClientId,
            data: { type: 'text', data: 'second' },
          });

          await waitFor(() => {
            expect(receivedMessages).toEqual(['first']);
            expect(otherReceivedMessages).toEqual(['second']);
          });
        } finally {
          await Promise.all([client.close(), otherClient.close()]);
          await worker.stop();
        }
      });

      it('should route client connections to an interceptor registered at the root of the server URL', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const interceptorId = crypto.randomUUID();
        const connectionReceivedPromise = createPromiseWithResolvers<{ interceptorIds: string[] }>();

        worker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
          connectionReceivedPromise.resolve(data);
          return { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
        });

        const client = new WebSocketClient<ChatMessage>(baseURL);

        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/ws/workers/reset', { interceptors: [{ id: interceptorId, baseURL }] });

          await client.open();

          await expect(connectionReceivedPromise).resolves.toMatchObject({ interceptorIds: [interceptorId] });
          expect(client.readyState).toBe(WebSocketClient.OPEN);
        } finally {
          await client.close();
          await worker.stop();
        }
      });

      it('should not route client connections to an interceptor registered at the root of another port starting with the server port', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const otherPortBaseURL = `ws://${server.hostname}:${String(server.port).slice(0, -1)}`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const connectionListener = vi.fn(
          ({ data }: { data: { interceptorIds: string[] } }): WebSocketClientConnectionReply => ({
            action: 'accept',
            acceptedInterceptorIds: data.interceptorIds,
          }),
        );
        worker.onChannel('event', 'interceptors/ws/clients/connect', connectionListener);

        const client = new WebSocketClient<ChatMessage>(`ws://${server.hostname}:${server.port}/`);

        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/ws/workers/reset', {
            interceptors: [{ id: crypto.randomUUID(), baseURL: otherPortBaseURL }],
          });

          const closeEventPromise = waitForWebSocketClientClose(client);

          await client.open();

          const closeEvent = await closeEventPromise;
          expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
          expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
          expect(connectionListener).not.toHaveBeenCalled();
        } finally {
          await client.close();
          await worker.stop();
        }
      });

      it('should reject resets with an invalid entry, preserving existing interceptors and client connections', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/retained`;
        const otherBaseURL = `ws://${server.hostname}:${server.port}/other`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const connectionPromise = createPromiseWithResolvers<{ clientId: string }>();

        worker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
          connectionPromise.resolve(data);
          return { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
        });

        const rejectedRequests: Promise<unknown>[] = [];
        const client = new WebSocketClient<ChatMessage>(baseURL);
        const otherClient = new WebSocketClient<ChatMessage>(otherBaseURL);

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: {
                [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
                [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
              },
              waitForAuthentication: true,
            });

            await worker.request('interceptors/ws/workers/reset', {
              interceptors: [{ id: crypto.randomUUID(), baseURL }],
            });

            await client.open();

            const receivedMessages = collectWebSocketClientMessages(client);

            rejectedRequests.push(
              worker.request('interceptors/ws/workers/reset', {
                interceptors: [
                  { id: crypto.randomUUID(), baseURL: otherBaseURL },
                  { id: crypto.randomUUID(), baseURL: `http://${server!.hostname}:${server!.port}/invalid` },
                ],
              }),
            );

            await waitFor(() => {
              expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError));
            });
            expect(console.error).toHaveBeenCalledTimes(1);

            expect(client.readyState).toBe(WebSocketClient.OPEN);

            const { clientId } = await connectionPromise;

            const message = JSON.stringify({ type: 'server', text: 'retained' } satisfies ChatMessage);
            worker.send('interceptors/ws/messages/send', { clientId, data: { type: 'text', data: message } });

            await waitFor(() => {
              expect(receivedMessages).toEqual([message]);
            });

            const otherCloseEventPromise = waitForWebSocketClientClose(otherClient);

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

      it('should reject resets with an invalid interceptor id', async () => {
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
              parameters: {
                [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
                [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
              },
              waitForAuthentication: true,
            });

            rejectedRequests.push(
              worker.request('interceptors/ws/workers/reset', { interceptors: [{ id: 1 as never, baseURL }] }),
            );

            await waitFor(() => {
              expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError));
            });
            expect(console.error).toHaveBeenCalledTimes(1);

            const closeEventPromise = waitForWebSocketClientClose(client);

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

      it('should reject malformed messages sent to clients and continue delivering valid messages', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
          messageTimeout: 500,
        });

        const connectionPromise = createPromiseWithResolvers<{ clientId: string }>();

        worker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
          connectionPromise.resolve(data);
          return { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
        });

        const client = new WebSocketClient<ChatMessage>(baseURL);

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: {
                [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
                [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
              },
              waitForAuthentication: true,
            });

            await worker.request('interceptors/ws/workers/reset', {
              interceptors: [{ id: crypto.randomUUID(), baseURL }],
            });

            await client.open();
            const { clientId } = await connectionPromise;

            const receivedMessages = collectWebSocketClientMessages(client);

            worker.send('interceptors/ws/messages/send', { clientId, data: { type: 'binary', data: 'not base64!' } });
            worker.send('interceptors/ws/messages/send', {
              clientId,
              data: { type: 'unknown', data: 'text' } as never,
            });
            worker.send('interceptors/ws/messages/send', {
              clientId: 1 as never,
              data: { type: 'text', data: 'text' },
            });

            const validMessage = JSON.stringify({ type: 'server', text: 'valid' } satisfies ChatMessage);
            worker.send('interceptors/ws/messages/send', { clientId, data: { type: 'text', data: validMessage } });

            await waitFor(() => {
              expect(receivedMessages).toEqual([validMessage]);
            });
            expect(console.error).toHaveBeenCalledTimes(3);
            expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError));
          } finally {
            await client.close();
            await worker.stop();
          }
        });
      });

      it('should close client connections only when requested by the worker owning them', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });
        const otherWorker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const connectionPromise = createPromiseWithResolvers<{ clientId: string }>();

        worker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
          connectionPromise.resolve(data);
          return { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
        });

        const client = new WebSocketClient<ChatMessage>(baseURL);

        try {
          for (const workerClient of [worker, otherWorker]) {
            await workerClient.start({
              parameters: {
                [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
                [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
              },
              waitForAuthentication: true,
            });
          }

          await worker.request('interceptors/ws/workers/reset', {
            interceptors: [{ id: crypto.randomUUID(), baseURL }],
          });

          const receivedMessages = collectWebSocketClientMessages(client);
          const closeEventPromise = waitForWebSocketClientClose(client);

          await client.open();
          const { clientId } = await connectionPromise;

          otherWorker.send('interceptors/ws/clients/disconnect', { clientId, code: 4000, reason: 'Other worker.' });

          // A reply from the same worker socket guarantees the server already processed the previous disconnection.
          await otherWorker.request('interceptors/ws/workers/reset', { interceptors: [] });

          worker.send('interceptors/ws/messages/send', { clientId, data: { type: 'text', data: 'still open' } });

          await waitFor(() => {
            expect(receivedMessages).toEqual(['still open']);
          });
          expect(client.readyState).toBe(WebSocketClient.OPEN);

          worker.send('interceptors/ws/clients/disconnect', { clientId, code: 4001, reason: 'Owner worker.' });

          const closeEvent = await closeEventPromise;
          expect(closeEvent.code).toBe(4001);
          expect(closeEvent.reason).toBe('Owner worker.');
        } finally {
          await client.close();
          await otherWorker.stop();
          await worker.stop();
        }
      });

      it('should reject malformed client disconnections and keep the client connections open', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const connectionPromise = createPromiseWithResolvers<{ clientId: string }>();

        worker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
          connectionPromise.resolve(data);
          return { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
        });

        const client = new WebSocketClient<ChatMessage>(baseURL);

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: {
                [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
                [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
              },
              waitForAuthentication: true,
            });

            await worker.request('interceptors/ws/workers/reset', {
              interceptors: [{ id: crypto.randomUUID(), baseURL }],
            });

            const receivedMessages = collectWebSocketClientMessages(client);

            await client.open();
            const { clientId } = await connectionPromise;

            worker.send('interceptors/ws/clients/disconnect', { clientId: 1 as never });
            worker.send('interceptors/ws/clients/disconnect', { clientId, code: 1001 });
            worker.send('interceptors/ws/clients/disconnect', { clientId, code: '4000' as never });
            // Workers round codes before sending them, so the server accepts only integers.
            worker.send('interceptors/ws/clients/disconnect', { clientId, code: 3000.5 });
            // 62 two-byte characters, which exceed the 123-byte limit of close reasons.
            worker.send('interceptors/ws/clients/disconnect', { clientId, code: 4000, reason: 'é'.repeat(62) });

            worker.send('interceptors/ws/messages/send', { clientId, data: { type: 'text', data: 'still open' } });

            await waitFor(() => {
              expect(receivedMessages).toEqual(['still open']);
            });
            expect(client.readyState).toBe(WebSocketClient.OPEN);
            expect(console.error).toHaveBeenCalledTimes(5);
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

        const connectionPromise = createPromiseWithResolvers<{ clientId: string }>();

        worker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
          connectionPromise.resolve(data);
          return { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
        });

        const client = new WebSocketClient<ChatMessage>(baseURL);

        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/ws/workers/reset', {
            interceptors: [{ id: crypto.randomUUID(), baseURL }],
          });

          await client.open();
          const { clientId } = await connectionPromise;

          const receivedMessages = collectWebSocketClientMessages(client);

          const messages = ['not json {', '', '{"unrelated":[1,2,3]}', 'ação 🚀'];

          for (const message of messages) {
            worker.send('interceptors/ws/messages/send', { clientId, data: { type: 'text', data: message } });
          }

          await waitFor(() => {
            expect(receivedMessages).toEqual(messages);
          });
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
        const requestedClientIds: string[] = [];

        worker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
          connectionRequestsCount++;
          requestedClientIds.push(data.clientId);
          return connectionRequestsCount === 1
            ? ({ acceptedInterceptorIds: 'all' } as never)
            : { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
        });

        const client = new WebSocketClient<ChatMessage>(baseURL);
        const otherClient = new WebSocketClient<ChatMessage>(baseURL);

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: {
                [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
                [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
              },
              waitForAuthentication: true,
            });

            await worker.request('interceptors/ws/workers/reset', {
              interceptors: [{ id: crypto.randomUUID(), baseURL }],
            });

            const closeEventPromise = waitForWebSocketClientClose(client);

            await client.open();

            const closeEvent = await closeEventPromise;
            expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
            expect(closeEvent.reason).toBe('Could not connect to the WebSocket interceptor.');

            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith(expect.any(InvalidWebSocketMessageError));

            const receivedMessages = collectWebSocketClientMessages(otherClient);

            await otherClient.open();

            const message = JSON.stringify({ type: 'server', text: 'accepted' } satisfies ChatMessage);
            worker.send('interceptors/ws/messages/send', {
              clientId: requestedClientIds[1],
              data: { type: 'text', data: message },
            });

            await waitFor(() => {
              expect(receivedMessages).toEqual([message]);
            });
          } finally {
            await Promise.all([client.close(), otherClient.close()]);
            await worker.stop();
          }
        });
      });

      it('should close pending client connections when their interceptor is removed by a worker reset and accept later connections', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
          messageTimeout: 500,
        });

        let connectionRequestsCount = 0;
        const requestedClientIds: string[] = [];
        const closedClientIds: string[] = [];

        const unresolvedConnectPromise = createPromiseWithResolvers<WebSocketClientConnectionReply>();

        worker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
          connectionRequestsCount++;
          requestedClientIds.push(data.clientId);
          return connectionRequestsCount === 1
            ? // Never replies within the handler, keeping the request pending.
              unresolvedConnectPromise
            : { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
        });
        worker.onChannel('event', 'interceptors/ws/clients/close', ({ data }) => {
          closedClientIds.push(data.clientId);
        });

        const client = new WebSocketClient<ChatMessage>(baseURL);
        const otherClient = new WebSocketClient<ChatMessage>(baseURL);

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: {
                [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
                [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
              },
              waitForAuthentication: true,
            });

            await worker.request('interceptors/ws/workers/reset', {
              interceptors: [{ id: crypto.randomUUID(), baseURL }],
            });

            const closeEventPromise = waitForWebSocketClientClose(client);

            // The server answers the handshake only after the worker decides the connection.
            const openPromise = client.open();

            await waitFor(() => {
              expect(connectionRequestsCount).toBe(1);
            });

            await worker.request('interceptors/ws/workers/reset', { interceptors: [] });

            await openPromise;

            const closeEvent = await closeEventPromise;
            expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);

            expect(console.error).not.toHaveBeenCalled();

            await worker.request('interceptors/ws/workers/reset', {
              interceptors: [{ id: crypto.randomUUID(), baseURL }],
            });

            // The server notifies the worker in the same task that closes the client, so this later reply on the
            // worker socket arrives after every notification for the client.
            expect(closedClientIds).toEqual([requestedClientIds[0]]);

            const receivedMessages = collectWebSocketClientMessages(otherClient);

            await otherClient.open();

            const message = JSON.stringify({ type: 'server', text: 'accepted' } satisfies ChatMessage);
            worker.send('interceptors/ws/messages/send', {
              clientId: requestedClientIds[1],
              data: { type: 'text', data: message },
            });

            await waitFor(() => {
              expect(receivedMessages).toEqual([message]);
            });
            expect(connectionRequestsCount).toBe(2);
          } finally {
            unresolvedConnectPromise.resolve({ action: 'accept', acceptedInterceptorIds: [] });
            await Promise.all([client.close(), otherClient.close(), unresolvedConnectPromise]);
            await worker.stop();
          }
        });
      });

      it('should not allow HTTP workers to reset WebSocket interceptors or send messages to their clients', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        await usingWebSocketInterceptor<ChatMessage>({ type: 'remote', baseURL }, async (interceptor) => {
          const client = new WebSocketClient<ChatMessage>(baseURL);
          const httpWorker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
            url: `ws://${server!.hostname}:${server!.port}`,
          });

          const rejectedRequests: Promise<unknown>[] = [];

          await usingIgnoredConsole(['error'], async (console) => {
            try {
              await client.open();

              await waitFor(() => {
                expect(interceptor.clients).toHaveLength(1);
              });

              const receivedMessages = collectWebSocketClientMessages(client);

              await httpWorker.start({
                parameters: {
                  [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
                  [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
                },
                waitForAuthentication: true,
              });

              const httpWorkerMessage = JSON.stringify({ type: 'server', text: 'http worker' } satisfies ChatMessage);
              httpWorker.send('interceptors/ws/messages/send', {
                clientId: crypto.randomUUID(),
                data: { type: 'text', data: httpWorkerMessage },
              });

              rejectedRequests.push(httpWorker.request('interceptors/ws/workers/reset', { interceptors: [] }));

              await waitFor(() => {
                expect(console.error).toHaveBeenCalledTimes(2);
              });
              expect(console.error).toHaveBeenCalledWith(
                new InvalidWebSocketMessageError('WebSocket RPC received from a non-WebSocket worker.'),
              );

              expect(client.readyState).toBe(WebSocketClient.OPEN);
              expect(interceptor.clients).toHaveLength(1);

              const ownerMessage = JSON.stringify({ type: 'server', text: 'owner' } satisfies ChatMessage);
              interceptor.server.send(ownerMessage);

              await waitFor(() => {
                expect(receivedMessages).toContain(ownerMessage);
              });
              expect(receivedMessages).toEqual([ownerMessage]);
            } finally {
              await httpWorker.stop();
              await Promise.allSettled(rejectedRequests);
              await client.close();
            }
          });
        });
      });

      it('should close client connections when the worker accepts the connection for none of its interceptors', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });
        worker.onChannel('event', 'interceptors/ws/clients/connect', () => ({
          action: 'accept',
          acceptedInterceptorIds: [],
        }));

        const client = new WebSocketClient<ChatMessage>(baseURL);

        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/ws/workers/reset', {
            interceptors: [{ id: crypto.randomUUID(), baseURL }],
          });

          const closeEventPromise = waitForWebSocketClientClose(client);

          await client.open();

          const closeEvent = await closeEventPromise;
          expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
          expect(closeEvent.reason).toBe('Could not connect to the WebSocket interceptor.');
        } finally {
          await client.close();
          await worker.stop();
        }
      });

      it('should not confirm client connections with replies from other workers', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const connectionRequestPromise = createPromiseWithResolvers<{ id: string; clientId: string }>();
        const spoofedReplyProcessedPromise = createPromiseWithResolvers<void>();
        const handledClientIds: string[] = [];

        worker.onChannel('event', 'interceptors/ws/clients/connect', async (request) => {
          connectionRequestPromise.resolve({ id: request.id, clientId: request.data.clientId });
          await spoofedReplyProcessedPromise;
          return { action: 'accept', acceptedInterceptorIds: request.data.interceptorIds };
        });
        worker.onChannel('event', 'interceptors/ws/messages/handle', ({ data }) => {
          handledClientIds.push(data.clientId);
        });

        // A raw socket lets the other worker send a reply to a request it never received.
        const otherWorker = new ClientSocket(`ws://${server.hostname}:${server.port}`, [
          encodeURIComponent(`${INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER}=ws`),
          encodeURIComponent(`${INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER}=${INTERCEPTOR_SERVER_RPC_VERSION}`),
        ]);

        const client = new WebSocketClient<WebSocketSchema<string>>(baseURL);

        try {
          const [authenticationMessage] = (await once(otherWorker, 'message')) as [Buffer];
          expect(authenticationMessage.toString()).toBe('socket:auth:valid');

          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/ws/workers/reset', {
            interceptors: [{ id: crypto.randomUUID(), baseURL }],
          });

          // The server answers the handshake only after the worker decides the connection.
          const openPromise = client.open();
          const connectionRequest = await connectionRequestPromise;

          otherWorker.send(
            JSON.stringify({
              id: crypto.randomUUID(),
              channel: 'interceptors/ws/clients/connect',
              requestId: connectionRequest.id,
              data: { action: 'accept', acceptedInterceptorIds: [] },
            }),
          );

          const resetRequestId = crypto.randomUUID();

          const resetReplyPromise = new Promise<void>((resolve) => {
            otherWorker.on('message', (rawMessage: Buffer) => {
              const message = JSON.parse(rawMessage.toString()) as { requestId?: string };

              if (message.requestId === resetRequestId) {
                resolve();
              }
            });
          });

          // A reply on the same socket guarantees the server already processed the spoofed reply.
          otherWorker.send(
            JSON.stringify({
              id: resetRequestId,
              channel: 'interceptors/ws/workers/reset',
              data: { interceptors: [] },
              expectsReply: true,
            }),
          );
          await resetReplyPromise;

          spoofedReplyProcessedPromise.resolve();
          await openPromise;

          // Had the spoofed reply been accepted, the server would have closed the client instead of confirming it.
          client.send('after-confirmation');
          await waitFor(() => expect(handledClientIds).toEqual([connectionRequest.clientId]));
        } finally {
          spoofedReplyProcessedPromise.resolve();
          otherWorker.terminate();
          await client.close();
          await worker.stop();
        }
      });

      it('should close pending client connections when the worker disconnects before confirming them', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const connectionReceivedPromise = createPromiseWithResolvers<void>();

        worker.onChannel('event', 'interceptors/ws/clients/connect', () => {
          connectionReceivedPromise.resolve();
          return new Promise<never>(() => {
            // Never replies, keeping the request pending until the worker disconnects.
          });
        });

        const client = new WebSocketClient<ChatMessage>(baseURL);

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: {
                [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
                [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
              },
              waitForAuthentication: true,
            });

            await worker.request('interceptors/ws/workers/reset', {
              interceptors: [{ id: crypto.randomUUID(), baseURL }],
            });

            const closeEventPromise = waitForWebSocketClientClose(client);

            // The server answers the handshake only after the worker decides the connection.
            const openPromise = client.open();
            await connectionReceivedPromise;

            await worker.stop();
            await openPromise;

            const closeEvent = await closeEventPromise;
            expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
            expect(closeEvent.reason).toBe('Could not connect to the WebSocket interceptor.');

            expect(console.error).not.toHaveBeenCalled();
          } finally {
            await client.close();
            await worker.stop();
          }
        });
      });

      it('should log and close pending client connections when the worker does not confirm them in time', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const connectionReceivedPromise = createPromiseWithResolvers<void>();

        worker.onChannel('event', 'interceptors/ws/clients/connect', () => {
          connectionReceivedPromise.resolve();
          return new Promise<never>(() => {
            // Never replies, keeping the request pending until the server times out.
          });
        });

        let client: WebSocket | undefined;

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: {
                [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
                [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
              },
              waitForAuthentication: true,
            });

            await worker.request('interceptors/ws/workers/reset', {
              interceptors: [{ id: crypto.randomUUID(), baseURL }],
            });

            // The server answers the handshake only after the worker decides the connection, so the client stays
            // opening until the request times out. A native socket is used because it sets no open timeout, which the
            // faked clock would fire first.
            client = new WebSocket(baseURL);

            const closeEventPromise = new Promise<CloseEvent>((resolve) => {
              client?.addEventListener('close', resolve, { once: true });
            });

            // The server message timeout is not configurable, so the clock is faked before the server sends the
            // connection request.
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

            try {
              await connectionReceivedPromise;

              await vi.advanceTimersByTimeAsync(DEFAULT_WEB_SOCKET_MESSAGE_TIMEOUT);
            } finally {
              vi.useRealTimers();
            }

            const closeEvent = await closeEventPromise;
            expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
            expect(closeEvent.reason).toBe('Could not connect to the WebSocket interceptor.');

            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith(expect.any(WebSocketMessageTimeoutError));
          } finally {
            client?.close();
            await worker.stop();
          }
        });
      });

      it('should not list clients of connections that time out while the worker decides them', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;
        const otherBaseURL = `ws://${server.hostname}:${server.port}/other`;

        const restrictionStartedPromise = createPromiseWithResolvers<void>();
        const restrictionReleasedPromise = createPromiseWithResolvers<void>();
        const effect = vi.fn();

        await usingIgnoredConsole(['error'], async (console) => {
          await usingWebSocketInterceptor<ChatMessage>(
            { type: 'remote', baseURL, messageSaving: { enabled: true } },
            async (interceptor) => {
              const handler = await interceptor
                .connection()
                .with(async () => {
                  restrictionStartedPromise.resolve();
                  await restrictionReleasedPromise;
                  return true;
                })
                .effect(effect);

              // A native socket is used because it sets no open timeout, which the faked clock would fire first.
              const client = new WebSocket(baseURL);

              const closeEventPromise = new Promise<CloseEvent>((resolve) => {
                client.addEventListener('close', resolve, { once: true });
              });

              // The server message timeout is not configurable, so the clock is faked before the server sends the
              // connection request.
              vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

              try {
                await restrictionStartedPromise;

                await vi.advanceTimersByTimeAsync(DEFAULT_WEB_SOCKET_MESSAGE_TIMEOUT);
              } finally {
                vi.useRealTimers();
              }

              const closeEvent = await closeEventPromise;
              expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);

              // Starting another interceptor gets a reply on the same worker socket, which arrives after the server
              // notified the worker that the client closed.
              await usingWebSocketInterceptor<ChatMessage>({ type: 'remote', baseURL: otherBaseURL }, () => {
                restrictionReleasedPromise.resolve();
              });

              await waitFor(() => {
                expect(handler.connections).toHaveLength(1);
              });

              expect(interceptor.clients).toHaveLength(0);
              expect(effect).not.toHaveBeenCalled();

              expect(console.error).toHaveBeenCalledTimes(1);
              expect(console.error).toHaveBeenCalledWith(expect.any(WebSocketMessageTimeoutError));
            },
          );
        });
      });

      it('should close only the pending client connections whose interceptors are removed by a worker reset', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/removed`;
        const otherBaseURL = `ws://${server.hostname}:${server.port}/retained`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const connectionPromise = createPromiseWithResolvers<void>();
        const otherConnectionPromise = createPromiseWithResolvers<void>();
        const connectionReceivedPromise = createPromiseWithResolvers<void>();
        const otherConnectionReceivedPromise = createPromiseWithResolvers<{ clientId: string }>();

        worker.onChannel('event', 'interceptors/ws/clients/connect', async ({ data }) => {
          if (data.url === baseURL) {
            connectionReceivedPromise.resolve();
            await connectionPromise;
          } else {
            otherConnectionReceivedPromise.resolve(data);
            await otherConnectionPromise;
          }

          return { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
        });

        const client = new WebSocketClient<ChatMessage>(baseURL);
        const otherClient = new WebSocketClient<ChatMessage>(otherBaseURL);

        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          const otherInterceptorId = crypto.randomUUID();
          await worker.request('interceptors/ws/workers/reset', {
            interceptors: [
              { id: crypto.randomUUID(), baseURL },
              { id: otherInterceptorId, baseURL: otherBaseURL },
            ],
          });

          const closeEventPromise = waitForWebSocketClientClose(client);
          const otherMessagePromise = waitForWebSocketClientMessage(otherClient);

          // The server answers the handshakes only after the worker decides the connections.
          const openPromise = client.open();
          const otherOpenPromise = otherClient.open();
          await Promise.all([connectionReceivedPromise, otherConnectionReceivedPromise]);

          await worker.request('interceptors/ws/workers/reset', {
            interceptors: [{ id: otherInterceptorId, baseURL: otherBaseURL }],
          });

          await openPromise;

          const closeEvent = await closeEventPromise;
          expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.DEFAULT);

          connectionPromise.resolve();
          otherConnectionPromise.resolve();

          await otherOpenPromise;
          expect(otherClient.readyState).toBe(WebSocketClient.OPEN);

          const { clientId: otherClientId } = await otherConnectionReceivedPromise;

          const message = JSON.stringify({ type: 'server', text: 'retained' } satisfies ChatMessage);
          worker.send('interceptors/ws/messages/send', {
            clientId: otherClientId,
            data: { type: 'text', data: message },
          });

          await expect(otherMessagePromise).resolves.toBe(message);
        } finally {
          connectionPromise.resolve();
          otherConnectionPromise.resolve();
          await Promise.all([client.close(), otherClient.close()]);
          await worker.stop();
        }
      });

      // Remote interceptors send through a queue, so whether their sends reach the server before or after it receives
      // the connection reply depends on timing. A worker replying after its sends makes the pending case deterministic.
      it('should deliver messages and closes sent by the worker while client connections are pending once they are accepted', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const closeReason = 'closed while pending';

        worker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
          worker.send('interceptors/ws/messages/send', {
            clientId: data.clientId,
            data: { type: 'text', data: 'first' },
          });
          worker.send('interceptors/ws/clients/disconnect', {
            clientId: data.clientId,
            code: 3000,
            reason: closeReason,
          });
          worker.send('interceptors/ws/messages/send', {
            clientId: data.clientId,
            data: { type: 'text', data: 'after close' },
          });

          return { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
        });

        const client = new WebSocketClient<WebSocketSchema<string>>(baseURL);
        const receivedMessages = collectWebSocketClientMessages(client);
        const closeEventPromise = waitForWebSocketClientClose(client);

        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/ws/workers/reset', {
            interceptors: [{ id: crypto.randomUUID(), baseURL }],
          });

          await client.open();

          const closeEvent = await closeEventPromise;
          expect(closeEvent.code).toBe(3000);
          expect(closeEvent.reason).toBe(closeReason);

          expect(receivedMessages).toEqual(['first']);
        } finally {
          await client.close();
          await worker.stop();
        }
      });

      it('should notify the worker when a client closes while the connection confirmation is pending', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const connectionPromise = createPromiseWithResolvers<void>();
        const connectionReceivedPromise = createPromiseWithResolvers<{ clientId: string }>();
        const closedClientIds: string[] = [];

        worker.onChannel('event', 'interceptors/ws/clients/connect', async ({ data }) => {
          connectionReceivedPromise.resolve(data);
          await connectionPromise;
          return { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
        });
        worker.onChannel('event', 'interceptors/ws/clients/close', ({ data }) => {
          closedClientIds.push(data.clientId);
        });

        let client: ClientSocket | undefined;

        try {
          await worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            },
            waitForAuthentication: true,
          });

          await worker.request('interceptors/ws/workers/reset', {
            interceptors: [{ id: crypto.randomUUID(), baseURL }],
          });

          // The server answers the handshake only after the worker decides the connection, so the client disconnects
          // while still opening.
          client = new ClientSocket(baseURL);
          const clientSocket = client;

          const closeEventPromise = new Promise<ClientSocket.CloseEvent>((resolve) => {
            clientSocket.addEventListener('close', resolve, { once: true });
          });

          // Terminating a socket still opening reports an error, which `ws` would otherwise throw.
          const errorEventPromise = new Promise<ClientSocket.ErrorEvent>((resolve) => {
            clientSocket.addEventListener('error', resolve, { once: true });
          });

          const { clientId } = await connectionReceivedPromise;

          clientSocket.terminate();
          await Promise.all([errorEventPromise, closeEventPromise]);

          await waitFor(() => {
            expect(closedClientIds).toEqual([clientId]);
          });

          connectionPromise.resolve();

          // A reply from the same worker socket guarantees the server already processed the connection reply.
          await worker.request('interceptors/ws/workers/reset', { interceptors: [] });

          expect(closedClientIds).toEqual([clientId]);
        } finally {
          connectionPromise.resolve();
          client?.terminate();
          await worker.stop();
        }
      });

      it('should notify the worker when a client closes without waiting for its in-flight messages and ignore later sends to it', async () => {
        server = createInternalInterceptorServer();
        await server.start();

        const baseURL = `ws://${server.hostname}:${server.port}/chat`;

        const worker = new InterceptorServerWebSocketClient<InterceptorServerWebSocketSchema>({
          url: `ws://${server.hostname}:${server.port}`,
        });

        const connectionReceivedPromise = createPromiseWithResolvers<{ clientId: string }>();
        const messageStartedPromise = createPromiseWithResolvers<void>();
        const messageFinishedPromise = createPromiseWithResolvers<void>();
        const closedClientIds: string[] = [];

        worker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
          connectionReceivedPromise.resolve(data);
          return { action: 'accept', acceptedInterceptorIds: data.interceptorIds };
        });
        worker.onChannel('event', 'interceptors/ws/messages/handle', async () => {
          messageStartedPromise.resolve();
          await messageFinishedPromise;
        });
        worker.onChannel('event', 'interceptors/ws/clients/close', ({ data }) => {
          closedClientIds.push(data.clientId);
        });

        const client = new WebSocketClient<WebSocketSchema<string>>(baseURL);

        await usingIgnoredConsole(['error'], async (console) => {
          try {
            await worker.start({
              parameters: {
                [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
                [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
              },
              waitForAuthentication: true,
            });

            await worker.request('interceptors/ws/workers/reset', {
              interceptors: [{ id: crypto.randomUUID(), baseURL }],
            });

            await client.open();
            const { clientId } = await connectionReceivedPromise;

            client.send('in-flight');
            await messageStartedPromise;

            await client.close();
            await waitFor(() => expect(closedClientIds).toEqual([clientId]));

            worker.send('interceptors/ws/messages/send', { clientId, data: { type: 'text', data: 'late' } });
            messageFinishedPromise.resolve();

            // A reply from the same worker socket guarantees the server already processed the previous send.
            await worker.request('interceptors/ws/workers/reset', { interceptors: [] });

            expect(console.error).not.toHaveBeenCalled();
          } finally {
            messageFinishedPromise.resolve();
            await client.close();
            await worker.stop();
          }
        });
      });
    });
  });

  describe('HTTP requests after the HTTP runtime loads', () => {
    it('should log unhandled requests rejected by the runtime', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: true });
      await server.start();

      type Schema = HttpSchema<{
        '/handled': {
          GET: {
            response: { 204: {} };
          };
        };
      }>;
      const interceptor = createInternalHttpInterceptor<Schema>({
        type: 'remote',
        baseURL: `http://${server.hostname}:${server.port}/handled-base`,
      });

      try {
        await interceptor.start();
        await interceptor.get('/handled').respond({ status: 204 });

        const request = new Request(`http://${server.hostname}:${server.port}/unhandled`);

        await usingIgnoredConsole(['error'], async (console) => {
          await expectFetchError(fetch(request.clone()));

          expect(console.error).toHaveBeenCalledTimes(1);
          await verifyUnhandledRequestMessage(console.error.mock.calls[0].join(' '), {
            request,
            platform: 'node',
            type: 'reject',
          });
        });
      } finally {
        await interceptor.stop();
      }
    });

    it('should reject requests with methods forbidden by the Fetch API and continue handling requests', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: true });
      await server.start();

      type Schema = HttpSchema<{
        '/users': {
          GET: {
            response: { 204: {} };
          };
        };
      }>;
      const interceptor = createInternalHttpInterceptor<Schema>({
        type: 'remote',
        baseURL: `http://${server.hostname}:${server.port}`,
      });

      try {
        await interceptor.start();
        await interceptor.get('/users').respond({ status: 204 });

        await usingIgnoredConsole(['error'], async (console) => {
          const socket = connect({ host: server!.hostname, port: server!.port! });
          const socketClosed = once(socket, 'close');
          const responseChunks: Buffer[] = [];

          socket.on('data', (chunk: Buffer) => responseChunks.push(chunk));

          try {
            await once(socket, 'connect');

            // Fetch rejects `TRACE` requests, so the request is sent through a raw socket.
            socket.end(['TRACE /users HTTP/1.1', `Host: ${server!.hostname}:${server!.port}`, '', ''].join('\r\n'));

            await socketClosed;

            expect(Buffer.concat(responseChunks).toString()).toBe(
              'HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nContent-Length: 1\r\n\r\n',
            );

            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith(expect.any(TypeError));
          } finally {
            socket.destroy();
          }

          const response = await fetch(`http://${server!.hostname}:${server!.port}/users`, { method: 'GET' });
          expect(response.status).toBe(204);
        });
      } finally {
        await interceptor.stop();
      }
    });

    it('should reject unhandled requests without logging when runtime logging is disabled', async () => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      type Schema = HttpSchema<{
        '/handled': {
          GET: {
            response: { 204: {} };
          };
        };
      }>;
      const interceptor = createInternalHttpInterceptor<Schema>({
        type: 'remote',
        baseURL: `http://${server.hostname}:${server.port}/handled-base`,
      });

      try {
        await interceptor.start();
        await interceptor.get('/handled').respond({ status: 204 });

        await usingIgnoredConsole(['error'], async (console) => {
          await expectFetchError(fetch(`http://${server!.hostname}:${server!.port}/unhandled`));
          expect(console.error).not.toHaveBeenCalled();
        });
      } finally {
        await interceptor.stop();
      }
    });
  });

  describe('Hostname', () => {
    it('should start correctly with a defined hostname', async () => {
      server = createInternalInterceptorServer({ hostname: '0.0.0.0', port: 8080 });

      expect(server.isRunning).toBe(false);
      expect(server.hostname).toBe('0.0.0.0');
      expect(server.port).toBe(8080);

      await usingIgnoredConsole(['warn'], async () => {
        await server!.start();
      });

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

      await usingIgnoredConsole(['warn'], async () => {
        await server!.start();
      });
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
