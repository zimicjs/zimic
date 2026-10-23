import { waitFor } from '@zimic/utils/time';
import { closeWebSocketClient } from '@zimic/utils/ws';
import ClientSocket from 'isomorphic-ws';
import { expect, it, vi } from 'vitest';

import { INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER } from '@/interceptor/constants';
import { waitForOpenClientSocket } from '@/utils/webSocket';
import WebSocketClient from '@/utils/webSocket/WebSocketClient';

import type { InterceptorServerWebSocketSchema } from '../types/schema';
import { createInterceptorToken, DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY, removeInterceptorToken } from '../utils/auth';

const httpPeerMock = vi.hoisted(() => ({ importAttempts: 0 }));

vi.mock('@zimic/http', () => {
  httpPeerMock.importAttempts++;

  const error = new Error('Cannot find package "@zimic/http".');
  Object.assign(error, { code: 'ERR_MODULE_NOT_FOUND' });
  throw error;
});

it('should isolate a missing HTTP peer from authenticated WebSocket workers', async () => {
  const { default: InterceptorServer } = await import('../InterceptorServer');

  const token = await createInterceptorToken();
  const server = new InterceptorServer({
    tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    logUnhandledRequests: false,
  });
  const workers: WebSocketClient<InterceptorServerWebSocketSchema>[] = [];
  let userSocket: ClientSocket | undefined;

  try {
    await server.start();

    await expect(fetch(`http://localhost:${server.port}/before-http-worker`)).rejects.toThrow();

    const serverURL = `ws://localhost:${server.port}`;
    const webSocketWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({ url: serverURL });
    const unauthenticatedHttpWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({ url: serverURL });
    const authenticatedHttpWorker = new WebSocketClient<InterceptorServerWebSocketSchema>({ url: serverURL });
    workers.push(webSocketWorker, unauthenticatedHttpWorker, authenticatedHttpWorker);

    const handledMessages: unknown[] = [];
    webSocketWorker.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => ({
      acceptedHandlerIds: data.handlerIds,
    }));
    webSocketWorker.onChannel('event', 'interceptors/ws/messages/handle', ({ data }) => {
      handledMessages.push(data);
      return { handled: true };
    });

    await webSocketWorker.start({
      parameters: {
        [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
        token: token.value,
      },
      waitForAuthentication: true,
    });

    const baseURL = `${serverURL}/chat`;
    await webSocketWorker.request('interceptors/ws/workers/commit', {
      id: crypto.randomUUID(),
      baseURL,
    });

    expect(httpPeerMock.importAttempts).toBe(0);

    await expect(
      unauthenticatedHttpWorker.start({
        parameters: {
          [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
        },
        waitForAuthentication: true,
      }),
    ).rejects.toThrow('An interceptor token is required, but none was provided. (code 1008)');
    expect(httpPeerMock.importAttempts).toBe(0);

    userSocket = new ClientSocket(baseURL);
    await waitForOpenClientSocket(userSocket);
    userSocket.send('before-http-worker');

    await waitFor(() => {
      expect(handledMessages).toHaveLength(1);
    });

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      authenticatedHttpWorker.start({
        parameters: {
          [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
          token: token.value,
        },
        waitForAuthentication: true,
      }),
    ).rejects.toThrow(
      'The optional peer dependency "@zimic/http" is required for HTTP interceptor workers. (code 1008)',
    );

    expect(consoleError).toHaveBeenCalledOnce();
    expect(httpPeerMock.importAttempts).toBe(1);
    expect(server.isRunning).toBe(true);
    expect(webSocketWorker.isRunning).toBe(true);

    userSocket.send('after-http-worker');

    await waitFor(() => {
      expect(handledMessages).toHaveLength(2);
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
