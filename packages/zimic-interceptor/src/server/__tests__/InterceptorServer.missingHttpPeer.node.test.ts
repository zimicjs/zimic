import { expectFetchError } from '@zimic/utils/fetch';
import { waitFor } from '@zimic/utils/time';
import { closeWebSocketClient } from '@zimic/utils/ws';
import ClientSocket from 'isomorphic-ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER,
  INTERCEPTOR_SERVER_RPC_VERSION,
  INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER,
} from '@/interceptor/constants';
import { waitForOpenClientSocket } from '@/utils/webSocket';
import WebSocketClient from '@/utils/webSocket/WebSocketClient';
import { usingIgnoredConsole } from '@tests/utils/console';

import type { InterceptorServerWebSocketSchema } from '../types/schema';
import { createInterceptorToken, DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY, removeInterceptorToken } from '../utils/auth';

const httpPeerMock = vi.hoisted(() => ({ importAttempts: 0 }));

// Simulates an installation without the optional peer `@zimic/http`, which is always installed in this workspace.
vi.mock('@zimic/http', () => {
  httpPeerMock.importAttempts++;

  const error = new Error('Cannot find package "@zimic/http".');
  Object.assign(error, { code: 'ERR_MODULE_NOT_FOUND' });
  throw error;
});

describe('Interceptor server > Missing HTTP peer', () => {
  beforeEach(() => {
    // Each test needs a fresh server module, so the cached runtime import runs again and the import count starts at 0.
    vi.resetModules();
    httpPeerMock.importAttempts = 0;
  });

  it('should reject unauthenticated HTTP workers without importing @zimic/http', async () => {
    const { default: InterceptorServer } = await import('../InterceptorServer');

    const token = await createInterceptorToken();
    const server = new InterceptorServer({
      tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      logUnhandledRequests: false,
    });
    let worker: WebSocketClient<InterceptorServerWebSocketSchema> | undefined;

    try {
      await server.start();

      worker = new WebSocketClient<InterceptorServerWebSocketSchema>({ url: `ws://localhost:${server.port}` });

      await expect(
        worker.start({
          parameters: {
            [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
            [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
          },
          waitForAuthentication: true,
        }),
      ).rejects.toThrow('An interceptor token is required, but none was provided. (code 1008)');

      expect(httpPeerMock.importAttempts).toBe(0);
    } finally {
      await worker?.stop();
      await server.stop();
      await removeInterceptorToken(token.id);
    }
  });

  it('should reject authenticated HTTP workers with a missing peer error', async () => {
    const { default: InterceptorServer } = await import('../InterceptorServer');

    const token = await createInterceptorToken();
    const server = new InterceptorServer({
      tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      logUnhandledRequests: false,
    });
    let worker: WebSocketClient<InterceptorServerWebSocketSchema> | undefined;

    await usingIgnoredConsole(['error'], async (console) => {
      try {
        await server.start();

        worker = new WebSocketClient<InterceptorServerWebSocketSchema>({ url: `ws://localhost:${server.port}` });

        await expect(
          worker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
              token: token.value,
            },
            waitForAuthentication: true,
          }),
        ).rejects.toThrow(
          'The optional peer dependency "@zimic/http" is required for HTTP interceptor workers. (code 1008)',
        );

        expect(console.error).toHaveBeenCalledOnce();
        expect(httpPeerMock.importAttempts).toBe(1);

        await expectFetchError(fetch(`http://localhost:${server.port}/users`));
      } finally {
        await worker?.stop();
        await server.stop();
        await removeInterceptorToken(token.id);
      }
    });
  });

  it('should keep handling WebSocket workers after an HTTP worker fails with a missing peer error', async () => {
    const { default: InterceptorServer } = await import('../InterceptorServer');

    const token = await createInterceptorToken();
    const server = new InterceptorServer({
      tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      logUnhandledRequests: false,
    });
    const workers: WebSocketClient<InterceptorServerWebSocketSchema>[] = [];
    let userSocket: ClientSocket | undefined;

    await usingIgnoredConsole(['error'], async () => {
      try {
        await server.start();

        const serverURL = `ws://localhost:${server.port}`;
        const webSocketWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({ url: serverURL });
        const httpWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({ url: serverURL });
        workers.push(webSocketWorker, httpWorker);

        const handledMessages: unknown[] = [];
        webSocketWorker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => ({
          acceptedInterceptorIds: data.interceptorIds,
        }));
        webSocketWorker.onChannel('event', 'interceptors/ws/messages/handle', ({ data }) => {
          handledMessages.push(data);
        });

        await webSocketWorker.start({
          parameters: {
            [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
            [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
            token: token.value,
          },
          waitForAuthentication: true,
        });

        const baseURL = `${serverURL}/chat`;
        await webSocketWorker.request('interceptors/ws/workers/reset', {
          interceptors: [{ id: crypto.randomUUID(), baseURL }],
        });

        await expect(
          httpWorker.start({
            parameters: {
              [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
              [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
              token: token.value,
            },
            waitForAuthentication: true,
          }),
        ).rejects.toThrow(
          'The optional peer dependency "@zimic/http" is required for HTTP interceptor workers. (code 1008)',
        );

        expect(webSocketWorker.isRunning).toBe(true);

        userSocket = new ClientSocket(baseURL);
        await waitForOpenClientSocket(userSocket);
        userSocket.send('after-http-worker');

        await waitFor(() => {
          expect(handledMessages).toHaveLength(1);
        });
      } finally {
        if (userSocket) {
          await closeWebSocketClient(userSocket);
        }
        await Promise.all(workers.map((worker) => worker.stop()));
        await server.stop();
        await removeInterceptorToken(token.id);
      }
    });
  });
});
