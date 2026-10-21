import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor, waitForNot } from '@zimic/utils/time';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInternalWebSocketInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import RemoteWebSocketMessageHandler from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './utils';

export function declareDefaultWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
  },
) {
  const { type, startServer, stopServer, getBaseURL } = options;

  let baseURL: string;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  // No WebSocket counterpart for "should provide access to the method and path": WebSocket handlers have neither.

  // Unlike HTTP requests, a message needs no reply, so a handler without a declared response still matches.
  it('should match any message if contains no declared response', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.message().times(1);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });

          await handler.checkTimes();
        });
      },
    );
  });

  it('should match any message if contains a declared response and no restrictions', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const handler = await interceptor.message().respond({ type: 'delete', id: '1' });

      await usingWebSocketClient<Schema>(baseURL, async (client) => {
        let response = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));

        await handler.with({});

        response = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'delete', id: '2' }));
        await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));
      });
    });
  });

  // Unlike HTTP requests, a message needs no reply, so a cleared handler still matches.
  it('should match any message if cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' });
        await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          let response = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'before' } }));
          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));

          await handler.clear();

          response = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'cleared' } }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'cleared' } });

          // Messages on a socket are delivered in order, so the probe response arriving first means that the cleared
          // handler sent nothing.
          client.send(JSON.stringify({ type: 'delete', id: '1' }));
          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));

          await handler.respond({ type: 'delete', id: '2' });

          response = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'after' } }));
          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '2' }));
        });
      },
    );
  });

  // No WebSocket counterparts for creating responses from static or computed declarations, or without a declared
  // response: WebSocket handlers send replies through the interceptor, so the interceptor handler suite covers them.

  it('should keep track of the intercepted messages', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' });

        expect(handler.messages).toEqual([]);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const response = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          expect(handler.messages[0].sender).toBe(interceptor.clients[0]);
          expect(handler.messages[0].sender.url).toBe(client.url);
          expect(handler.messages[0].receiver).toBe(interceptor.server);
          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });
        });
      },
    );
  });

  it('should clear the intercepted messages after cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const response = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
          await response;

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          const [senderHandle] = interceptor.clients;
          const handlerMessages = handler.messages;
          const senderMessages = senderHandle.messages;
          const receiverMessages = interceptor.server.messages;

          expect(handlerMessages).toHaveLength(1);
          expect(senderMessages).toHaveLength(1);
          expect(receiverMessages).toHaveLength(1);

          handler.clear();

          expect(handler.messages).toBe(handlerMessages);
          expect(handler.messages).toHaveLength(0);
          expect(senderHandle.messages).toBe(senderMessages);
          expect(senderHandle.messages).toHaveLength(0);
          expect(interceptor.server.messages).toBe(receiverMessages);
          expect(interceptor.server.messages).toHaveLength(0);
        });
      },
    );
  });

  // No WebSocket counterparts for accessing raw intercepted requests and responses or their hidden properties:
  // intercepted messages carry parsed data, with no raw request or response objects.

  it('should clear restrictions after cleared', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'delete', id: 'fallback' });

      const handler = await interceptor
        .message()
        .with({ type: 'delete' })
        .respond({ type: 'delete', id: '1' })
        .times(1);

      await usingWebSocketClient<Schema>(baseURL, async (client) => {
        const restrictedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(restrictedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'fallback' }));

        await handler.clear().respond({ type: 'delete', id: '2' }).times(1);

        const clearedResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await expect(clearedResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: '2' }));

        await handler.checkTimes();
      });
    });
  });

  if (type === 'remote') {
    describe('Promise-like', () => {
      let interceptor: ReturnType<typeof createInternalWebSocketInterceptor<Schema>>;

      beforeEach(async () => {
        interceptor = createInternalWebSocketInterceptor<Schema>({ type, baseURL });
        await interceptor.start();
      });

      afterEach(async () => {
        await interceptor.stop();
      });

      it('should be then-able', async () => {
        const handler = new RemoteWebSocketMessageHandler<Schema>(interceptor.implementation);
        await handler.respond({ type: 'delete', id: '1' });

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        const fulfillmentListener = vi.fn((syncedHandler) => {
          expect(syncedHandler).toEqual(handler);
          expect(handler.isSynced).toBe(true);

          expect(syncedHandler).not.toHaveProperty('then');
          expect(syncedHandler).toHaveProperty('catch', expect.any(Function));
          expect(syncedHandler).toHaveProperty('finally', expect.any(Function));
        });

        expect(handler.isSynced).toBe(true);

        const pendingHandler = handler.with({});
        expect(pendingHandler).toEqual(handler);

        const syncPromise = createPromiseWithResolvers<void>();
        handler.registerSyncPromise(syncPromise);
        expect(handler.isSynced).toBe(false);

        const thenPromise = pendingHandler.then(fulfillmentListener);
        syncPromise.resolve();
        await thenPromise;

        expect(handler.isSynced).toBe(true);
        expect(pendingHandler.isSynced).toBe(true);

        expect(fulfillmentListener).toHaveBeenCalledTimes(1);
      });

      it('should wait until synced before resolving, even if new sync promises were added while waiting', async () => {
        const handler = new RemoteWebSocketMessageHandler<Schema>(interceptor.implementation);
        await handler.respond({ type: 'delete', id: '1' });

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        const fulfillmentListener = vi.fn((syncedHandler) => {
          expect(handler).toEqual(syncedHandler);
          expect(handler.isSynced).toBe(true);

          expect(syncedHandler).not.toHaveProperty('then');
          expect(syncedHandler).toHaveProperty('catch', expect.any(Function));
          expect(syncedHandler).toHaveProperty('finally', expect.any(Function));
        });

        const syncPromises = [
          createPromiseWithResolvers<void>(),
          createPromiseWithResolvers<void>(),
          createPromiseWithResolvers<void>(),
        ];

        expect(handler.isSynced).toBe(true);
        handler.registerSyncPromise(syncPromises[0]);
        expect(handler.isSynced).toBe(false);

        const thenPromise = handler.with({}).then(fulfillmentListener);

        handler.registerSyncPromise(syncPromises[1]);
        handler.registerSyncPromise(syncPromises[2]);
        expect(handler.isSynced).toBe(false);

        syncPromises[1].resolve();
        syncPromises[0].resolve();

        await waitForNot(() => {
          expect(fulfillmentListener).toHaveBeenCalled();
        });

        syncPromises[2].resolve();
        await thenPromise;

        expect(handler.isSynced).toBe(true);

        expect(fulfillmentListener).toHaveBeenCalledTimes(1);
      });

      it('should be catch-able', async () => {
        const handler = new RemoteWebSocketMessageHandler<Schema>(interceptor.implementation);
        await handler.respond({ type: 'delete', id: '1' });

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        // @ts-expect-error Forcing an exception in an internal method
        handler.syncPromises = 'not-an-array';

        const rejectionListener = vi.fn((error: unknown) => {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty('message', 'this.syncPromises.filter is not a function');
        });

        await handler.with({}).catch(rejectionListener);

        expect(rejectionListener).toHaveBeenCalledTimes(1);
      });

      it('should be finally-able', async () => {
        const handler = new RemoteWebSocketMessageHandler<Schema>(interceptor.implementation);
        await handler.respond({ type: 'delete', id: '1' });

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        const finallyListener = vi.fn();

        expect(handler.isSynced).toBe(true);

        const pendingHandler = handler.with({});
        expect(pendingHandler).toEqual(handler);

        const syncPromise = createPromiseWithResolvers<void>();
        handler.registerSyncPromise(syncPromise);
        expect(handler.isSynced).toBe(false);

        const finallyPromise = pendingHandler.finally(finallyListener);
        syncPromise.resolve();
        await finallyPromise;

        expect(handler.isSynced).toBe(true);
        expect(pendingHandler.isSynced).toBe(true);

        expect(finallyListener).toHaveBeenCalledTimes(1);
      });
    });
  }
}
