import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { describe, expect, it, vi } from 'vitest';

import { createInternalWebSocketInterceptor, getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { createWebSocketInterceptorWorker } from '../factory';
import { declareDefaultWebSocketInterceptorWorkerTests } from './shared/default';
import testMatrix from './shared/matrix';

describe.each(testMatrix)('WebSocketInterceptorWorker (node, $type)', (defaultWorkerOptions) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareDefaultWebSocketInterceptorWorkerTests({
    platform: 'node',
    defaultWorkerOptions,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
  });

  if (defaultWorkerOptions.type === 'remote') {
    it('should accept an HTTP server URL', async () => {
      const worker = createWebSocketInterceptorWorker({
        type: 'remote',
        serverURL: new URL(getNodeBaseURL('remote', server)),
      });

      try {
        await worker.start();

        expect(worker.isRunning).toBe(true);
      } finally {
        await worker.stop();
      }
    });

    it('should ignore stale close events while preserving registered clients', async () => {
      type MessageSchema = WebSocketSchema<{ type: 'client' } | { type: 'server' }>;
      const remoteBaseURL = getNodeBaseURL('remote', server).replace(/^http/, 'ws');
      const firstInterceptor = createInternalWebSocketInterceptor<MessageSchema>({
        type: 'remote',
        baseURL: `${remoteBaseURL}/first`,
      });
      const secondInterceptor = createInternalWebSocketInterceptor<MessageSchema>({
        type: 'remote',
        baseURL: `${remoteBaseURL}/second`,
      });
      const worker = createWebSocketInterceptorWorker({
        type: 'remote',
        serverURL: new URL(getNodeBaseURL('remote', server)),
      });
      const client = new WebSocketClient<MessageSchema>(`${remoteBaseURL}/first`);
      const preservedClient = new WebSocketClient<MessageSchema>(`${remoteBaseURL}/second`);
      const closeEventPromise = new Promise<WebSocketClient.CloseEvent<MessageSchema>>((resolve) => {
        client.addEventListener('close', resolve, { once: true });
      });
      let releaseResetRequest: (() => void) | undefined;
      let clearHandlersPromise: Promise<void> | undefined;
      let staleCloseEventReceived = false;
      worker.webSocketClient.onChannel('event', 'interceptors/ws/clients/close', () => {
        staleCloseEventReceived = true;
      });

      try {
        await worker.start();
        await worker.use(firstInterceptor.implementation);
        await worker.use(secondInterceptor.implementation);
        await client.open();
        await preservedClient.open();

        const resetRequest = new Promise<void>((resolve) => {
          releaseResetRequest = resolve;
        });
        const originalRequest = worker.webSocketClient.request.bind(worker.webSocketClient);
        vi.spyOn(worker.webSocketClient, 'request').mockImplementationOnce(async (...args) => {
          await resetRequest;
          return originalRequest(...args);
        });
        clearHandlersPromise = worker.clearHandlers({ interceptor: firstInterceptor.implementation });

        await client.close();
        await waitFor(() => {
          expect(staleCloseEventReceived).toBe(true);
        });
        releaseResetRequest?.();
        await clearHandlersPromise;

        await expect(closeEventPromise).resolves.toBeDefined();

        const messagePromise = new Promise<WebSocketClient.MessageEvent<MessageSchema>>((resolve) => {
          preservedClient.addEventListener('message', resolve, { once: true });
        });
        await worker.sendToClient(secondInterceptor.implementation.clients[0], JSON.stringify({ type: 'server' }));

        await expect(messagePromise).resolves.toMatchObject({ data: JSON.stringify({ type: 'server' }) });

        await preservedClient.close();
        await waitFor(() => {
          expect(secondInterceptor.implementation.clients).toHaveLength(0);
        });
      } finally {
        releaseResetRequest?.();
        await Promise.allSettled([clearHandlersPromise]);
        await worker.stop();
        await client.close();
        await preservedClient.close();
      }
    });
  }
});
