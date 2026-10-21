import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInternalWebSocketInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
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

  it('should normalize incoming text messages before matching handlers and saving intercepted messages', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        let effectMessage: Schema | undefined;
        const firstRestriction = vi.fn((_message: Schema) => true);
        const handler = await interceptor
          .message()
          .with(firstRestriction)
          .effect((message) => {
            effectMessage = message;
          });

        const secondRestriction = vi.fn((_message: Schema) => false);
        await interceptor.message().with(secondRestriction);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          client.send(JSON.stringify({ type: 'create', body: { text: 'serialized' } }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          const normalizedMessage = firstRestriction.mock.calls[0][0];
          expect(normalizedMessage).toEqual({ type: 'create', body: { text: 'serialized' } });
          expect(secondRestriction.mock.calls[0][0]).toBe(normalizedMessage);
          expect(effectMessage).toBe(normalizedMessage);
          expect(handler.messages[0].data).toBe(normalizedMessage);

          expect(interceptor.clients[0].messages).toHaveLength(1);
          expect(interceptor.server.messages).toHaveLength(1);
        });
      },
    );
  });

  it('should match any message without a declared response, effect, or restrictions', async () => {
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

  it('should keep track of intercepted messages', async () => {
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

  it('should clear intercepted messages in place after cleared', async () => {
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
