import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInternalWebSocketInterceptor, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import { WebSocketInterceptorClient } from '../../../interceptor/types/messages';
import { UnhandledMessageStrategy, WebSocketInterceptorType } from '../../../interceptor/types/options';
import RemoteWebSocketMessageHandler from '../../RemoteWebSocketMessageHandler';
import {
  InternalWebSocketMessageHandler,
  WebSocketMessageHandler,
  WebSocketMessageHandlerMessageComputedDeclaration,
} from '../../types/public';
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

  // No WebSocket message counterpart for "should provide access to the method and path": message handlers have neither.

  // No WebSocket message counterpart for "should provide access to the path": message handlers have no path.

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

  it('should not match any message if cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: 'older' });
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          let response = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'before' } }));
          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));

          await handler.clear();

          response = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'cleared' } }));
          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'older' }));

          expect(handler.messages).toHaveLength(0);

          await handler.respond({ type: 'delete', id: '2' });

          response = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'after' } }));
          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: '2' }));
        });
      },
    );
  });

  it.each<{
    condition: string;
    declareAfterClear: (handler: WebSocketMessageHandler<Schema>) => unknown;
  }>([
    { condition: 'cleared', declareAfterClear: (handler) => handler },
    {
      condition: 'cleared and redeclared',
      declareAfterClear: (handler) => handler.respond({ type: 'delete', id: 'redeclared' }),
    },
  ])('should not match messages if $condition while they are being matched', async ({ declareAfterClear }) => {
    const restrictionStartedPromise = createPromiseWithResolvers<void>();
    const restrictionReleasedPromise = createPromiseWithResolvers<void>();

    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        await interceptor.message().respond({ type: 'delete', id: 'older' });

        const handler = await interceptor
          .message()
          .with(async () => {
            restrictionStartedPromise.resolve();
            await restrictionReleasedPromise;
            return true;
          })
          .respond({ type: 'delete', id: '1' });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const response = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'pending' } }));
          await restrictionStartedPromise;

          await declareAfterClear(handler.clear());
          restrictionReleasedPromise.resolve();

          await expect(response).resolves.toBe(JSON.stringify({ type: 'delete', id: 'older' }));
          expect(handler.messages).toHaveLength(0);

          await handler.times(0);
          await handler.checkTimes();
        });
      },
    );
  });

  it.each<{
    declaration: string;
    declare: (handler: WebSocketMessageHandler<Schema>, sender: WebSocketInterceptorClient<Schema>) => unknown;
  }>([
    { declaration: 'with', declare: (handler) => handler.with({ type: 'create' }) },
    { declaration: 'from', declare: (handler, sender) => handler.from(sender) },
    { declaration: 'respond', declare: (handler) => handler.respond({ type: 'delete', id: '2' }) },
    { declaration: 'effect', declare: (handler) => handler.effect(vi.fn()) },
    { declaration: 'delay', declare: (handler) => handler.delay(0) },
    { declaration: 'times', declare: (handler) => handler.times(1) },
  ])('should match messages again if cleared and declared with $declaration', async ({ declare }) => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const olderHandler = await interceptor.message().respond({ type: 'delete', id: 'older' });
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          await declare(handler.clear(), interceptor.clients[0]);

          client.send(JSON.stringify({ type: 'create', body: { text: 'declared' } }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'declared' } });
          expect(olderHandler.messages).toHaveLength(0);
        });
      },
    );
  });

  // No WebSocket message counterpart for "should create response with declared status and body": a message response is
  // data sent through the socket, without a status or a response object to create.

  // No WebSocket message counterpart for "should create response with declared status and body factory": a message
  // response is data sent through the socket, without a status or a response object to create.

  // No WebSocket message counterpart for "should not throw an error if trying to create a response without a declared
  // response": a message needs no reply, so a handler without a declared response matches and sends nothing.

  // No WebSocket message counterpart for "should decide connections with a $response computed response": a message has
  // no handshake to accept or reject.

  it('should compute responses with the message', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const responseFactory = vi.fn<WebSocketMessageHandlerMessageComputedDeclaration<Schema, Schema>>(() => ({
        type: 'delete',
        id: '1',
      }));

      await interceptor.message().respond(responseFactory);

      await usingWebSocketClient<Schema>(baseURL, async (client) => {
        const response = waitForWebSocketClientMessage(client);

        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
        await response;

        expect(responseFactory).toHaveBeenCalledTimes(1);
        expect(responseFactory).toHaveBeenCalledWith(
          { type: 'create', body: { text: 'hello' } },
          { sender: interceptor.clients[0], receiver: interceptor.server },
        );
      });
    });
  });

  it.each<{
    condition: string;
    declareAfterClear: (handler: WebSocketMessageHandler<Schema>) => unknown;
  }>([
    { condition: 'cleared', declareAfterClear: (handler) => handler },
    {
      condition: 'cleared and redeclared',
      declareAfterClear: (handler) => handler.with({ type: 'create' }).respond({ type: 'delete', id: 'redeclared' }),
    },
  ])('should not respond to messages if $condition while computing their response', async ({ declareAfterClear }) => {
    const responseStartedPromise = createPromiseWithResolvers<void>();
    const responseReleasedPromise = createPromiseWithResolvers<void>();

    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true }, onUnhandledMessage },
      async (interceptor) => {
        const handler = await interceptor.message().respond(async () => {
          responseStartedPromise.resolve();
          await responseReleasedPromise;
          return { type: 'delete', id: '1' };
        });

        await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const firstResponse = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'pending' } }));
          await responseStartedPromise;

          await declareAfterClear(handler.clear());
          responseReleasedPromise.resolve();

          await waitFor(() => {
            expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
          });

          client.send(JSON.stringify({ type: 'delete', id: '2' }));

          // Messages on a socket are delivered in order, so the probe response arriving first means that the pending
          // message got no response.
          await expect(firstResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));

          expect(handler.messages).toHaveLength(0);

          await handler.times(0);
          await handler.checkTimes();
        });
      },
    );
  });

  // Unlike an HTTP response, a message response has no body to read before the message is saved, so the handler is
  // cleared right after computing the response instead.
  it('should not respond to messages if cleared after computing their response', async () => {
    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true }, onUnhandledMessage },
      async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' });

        await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

        // No public callback runs between computing the response and saving the message, so the handler is cleared when
        // its declarations resolve.
        const { implementation } = handler as unknown as InternalWebSocketMessageHandler<Schema>;
        const applyDeclarations = implementation.applyDeclarations.bind(implementation);

        vi.spyOn(implementation, 'applyDeclarations').mockImplementationOnce(async (message, context) => {
          const declaration = await applyDeclarations(message, context);
          await handler.clear();
          return declaration;
        });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const firstResponse = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'pending' } }));

          await waitFor(() => {
            expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
          });

          client.send(JSON.stringify({ type: 'delete', id: '2' }));

          // Messages on a socket are delivered in order, so the probe response arriving first means that the pending
          // message got no response.
          await expect(firstResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));

          expect(handler.messages).toHaveLength(0);

          await handler.times(0);
          await handler.checkTimes();
        });
      },
    );
  });

  it('should respond to messages if redeclared while computing their response', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const handler = await interceptor.message().respond(async () => {
        await handler.respond({ type: 'delete', id: 'redeclared' });
        return { type: 'delete', id: 'computed' };
      });

      await usingWebSocketClient<Schema>(baseURL, async (client) => {
        const firstResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'first' } }));
        await expect(firstResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'computed' }));

        const secondResponse = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'second' } }));
        await expect(secondResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'redeclared' }));
      });
    });
  });

  it.each<{
    condition: string;
    declareAfterClear: (
      handler: WebSocketMessageHandler<Schema>,
      redeclaredResponse: WebSocketMessageHandlerMessageComputedDeclaration<Schema, Schema>,
    ) => unknown;
  }>([
    { condition: 'cleared', declareAfterClear: (handler) => handler },
    {
      condition: 'cleared and redeclared',
      declareAfterClear: (handler, redeclaredResponse) => handler.with({ type: 'create' }).respond(redeclaredResponse),
    },
  ])('should not respond to messages if $condition while running their effect', async ({ declareAfterClear }) => {
    const effectStartedPromise = createPromiseWithResolvers<void>();
    const effectReleasedPromise = createPromiseWithResolvers<void>();

    const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));
    const redeclaredResponse = vi.fn<WebSocketMessageHandlerMessageComputedDeclaration<Schema, Schema>>();

    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true }, onUnhandledMessage },
      async (interceptor) => {
        const handler = await interceptor
          .message()
          .effect(async () => {
            effectStartedPromise.resolve();
            await effectReleasedPromise;
          })
          .respond({ type: 'delete', id: '1' });

        await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const firstResponse = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'pending' } }));
          await effectStartedPromise;

          await declareAfterClear(handler.clear(), redeclaredResponse);
          effectReleasedPromise.resolve();

          await waitFor(() => {
            expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
          });

          client.send(JSON.stringify({ type: 'delete', id: '2' }));

          // Messages on a socket are delivered in order, so the probe response arriving first means that the pending
          // message got no response.
          await expect(firstResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));

          expect(handler.messages).toHaveLength(0);
          expect(redeclaredResponse).not.toHaveBeenCalled();

          await handler.times(0);
          await handler.checkTimes();
        });
      },
    );
  });

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

  // No WebSocket message counterpart for "should provide access to the raw intercepted requests and responses":
  // intercepted messages carry parsed data, with no raw request or response objects.

  // No WebSocket message counterpart for "should provide no access to hidden properties in raw intercepted requests and
  // responses": intercepted messages carry parsed data, with no raw request or response objects to hide properties of.

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

        const fulfillmentListener = vi.fn((syncedHandler: unknown) => {
          expect(syncedHandler).toEqual(handler);

          expect(syncedHandler).not.toHaveProperty('then');
          expect(syncedHandler).toHaveProperty('catch', expect.any(Function));
          expect(syncedHandler).toHaveProperty('finally', expect.any(Function));
        });

        const pendingHandler = handler.with({});
        expect(pendingHandler).toEqual(handler);

        await pendingHandler.then(fulfillmentListener);

        expect(fulfillmentListener).toHaveBeenCalledTimes(1);
      });

      it('should be catch-able', async () => {
        const handler = new RemoteWebSocketMessageHandler<Schema>(interceptor.implementation);
        await handler.respond({ type: 'delete', id: '1' });

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        const rejectionListener = vi.fn<(error: unknown) => void>();

        const syncedHandler = await handler.with({}).catch(rejectionListener);

        expect(syncedHandler).toEqual(handler);
        expect(syncedHandler).not.toHaveProperty('then');
        expect(rejectionListener).not.toHaveBeenCalled();
      });

      it('should be finally-able', async () => {
        const handler = new RemoteWebSocketMessageHandler<Schema>(interceptor.implementation);
        await handler.respond({ type: 'delete', id: '1' });

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        const finallyListener = vi.fn();

        const pendingHandler = handler.with({});
        expect(pendingHandler).toEqual(handler);

        const syncedHandler = await pendingHandler.finally(finallyListener);

        expect(syncedHandler).toEqual(handler);
        expect(syncedHandler).not.toHaveProperty('then');
        expect(finallyListener).toHaveBeenCalledTimes(1);
      });
    });
  }
}
