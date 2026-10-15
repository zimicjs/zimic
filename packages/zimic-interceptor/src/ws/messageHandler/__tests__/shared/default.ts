import { WebSocketMessageData } from '@zimic/ws';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInternalWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

import LocalWebSocketInterceptor from '../../../interceptor/LocalWebSocketInterceptor';
import RemoteWebSocketInterceptor from '../../../interceptor/RemoteWebSocketInterceptor';
import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import {
  createWebSocketInterceptorClient,
  InternalWebSocketInterceptorClient,
} from '../../../interceptor/WebSocketInterceptorHandle';
import WebSocketInterceptorImplementation from '../../../interceptor/WebSocketInterceptorImplementation';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { WebSocketMessageHandlerMessageMatch } from '../../WebSocketMessageHandlerImplementation';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './utils';

export function declareDefaultWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
) {
  const { platform, type, startServer, stopServer, getBaseURL, Handler } = options;

  let baseURL: string;

  let interceptor: LocalWebSocketInterceptor<Schema> | RemoteWebSocketInterceptor<Schema>;
  let interceptorImplementation: WebSocketInterceptorImplementation<Schema>;

  let sendToSender: ReturnType<typeof vi.fn<(data: WebSocketMessageData<Schema>) => void>>;
  let sender: InternalWebSocketInterceptorClient<Schema>;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);

    interceptor = createInternalWebSocketInterceptor<Schema>({ type, baseURL, messageSaving: { enabled: true } });
    interceptorImplementation = interceptor.implementation;

    expect(interceptor.platform).toBe(null);

    await interceptor.start();

    expect(interceptor.platform).toBe(platform);

    sendToSender = vi.fn();
    sender = createWebSocketInterceptorClient<Schema>(baseURL, sendToSender);
  });

  afterEach(async () => {
    await interceptor.stop();
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  it('should match any message if contains no declared response, effect, or restrictions', async () => {
    const handler = new Handler<Schema>(interceptorImplementation);

    const message: Schema = { type: 'create', body: { text: 'hello' } };
    const context = { sender, receiver: interceptorImplementation.server };

    expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>({
      success: true,
      message,
    });

    await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }).with({}), interceptor);

    expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>({
      success: true,
      message,
    });
  });

  it('should keep track of the intercepted messages', async () => {
    const handler = new Handler<Schema>(interceptorImplementation);
    await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }), interceptor);

    expect(handler.messages).toEqual([]);

    const message: Schema = { type: 'create', body: { text: 'hello' } };
    const receiver = interceptorImplementation.server;

    const wasHandled = await interceptorImplementation.handleInterceptedMessage(JSON.stringify(message), {
      sender,
      receiver,
    });
    expect(wasHandled).toBe(true);

    expect(sendToSender).toHaveBeenCalledTimes(1);
    expect(sendToSender).toHaveBeenCalledWith(JSON.stringify({ type: 'delete', id: '1' }));

    expect(handler.messages).toHaveLength(1);
    expect(handler.messages[0].sender).toBe(sender);
    expect(handler.messages[0].receiver).toBe(receiver);
    expect(handler.messages[0].data).toEqual(message);
  });

  it('should normalize incoming text messages before matching handlers and saving intercepted messages', async () => {
    let effectMessage: Schema | undefined;

    const restriction = vi.fn((_message: Schema) => true);
    const handler = new Handler<Schema>(interceptorImplementation);
    await promiseIfRemote(
      handler.with(restriction).effect((message) => {
        effectMessage = message;
      }),
      interceptor,
    );

    const message: Schema = { type: 'create', body: { text: 'serialized' } };

    const wasHandled = await interceptorImplementation.handleInterceptedMessage(JSON.stringify(message), {
      sender,
      receiver: interceptorImplementation.server,
    });
    expect(wasHandled).toBe(true);

    const normalizedMessage = restriction.mock.calls[0][0];
    expect(normalizedMessage).toEqual(message);
    expect(effectMessage).toBe(normalizedMessage);
    expect(handler.messages).toHaveLength(1);
    expect(handler.messages[0].data).toBe(normalizedMessage);
  });

  it('should clear the intercepted messages in place after cleared', async () => {
    const handler = new Handler<Schema>(interceptorImplementation);
    await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }), interceptor);

    const message: Schema = { type: 'create', body: { text: 'hello' } };
    const receiver = interceptorImplementation.server;

    await interceptorImplementation.handleInterceptedMessage(JSON.stringify(message), { sender, receiver });

    const handlerMessages = handler.messages;
    const senderMessages = sender.messages;
    const receiverMessages = receiver.messages;

    expect(handlerMessages).toHaveLength(1);
    expect(senderMessages).toHaveLength(1);
    expect(receiverMessages).toHaveLength(1);

    await promiseIfRemote(handler.clear(), interceptor);

    expect(handler.messages).toBe(handlerMessages);
    expect(handlerMessages).toHaveLength(0);
    expect(sender.messages).toBe(senderMessages);
    expect(senderMessages).toHaveLength(0);
    expect(receiver.messages).toBe(receiverMessages);
    expect(receiverMessages).toHaveLength(0);
  });

  it('should not save intercepted messages after cleared while a message is being handled', async () => {
    const handler = new Handler<Schema>(interceptorImplementation);

    const effectStarted = Promise.withResolvers<void>();
    const effectRelease = Promise.withResolvers<void>();

    await promiseIfRemote(
      handler.effect(async (message) => {
        if (message.type === 'create' && message.body.text === 'pending') {
          effectStarted.resolve();
          await effectRelease.promise;
        }
      }),
      interceptor,
    );

    const receiver = interceptorImplementation.server;

    const existingMessage: Schema = { type: 'create', body: { text: 'existing' } };
    await interceptorImplementation.handleInterceptedMessage(JSON.stringify(existingMessage), { sender, receiver });

    const handlerMessages = handler.messages;
    const senderMessages = sender.messages;
    const receiverMessages = receiver.messages;

    const pendingMessage: Schema = { type: 'create', body: { text: 'pending' } };
    const handlingPromise = interceptorImplementation.handleInterceptedMessage(JSON.stringify(pendingMessage), {
      sender,
      receiver,
    });

    await effectStarted.promise;

    expect(handlerMessages).toHaveLength(1);
    expect(senderMessages).toHaveLength(1);
    expect(receiverMessages).toHaveLength(1);

    await interceptor.clear();
    effectRelease.resolve();
    await handlingPromise;

    expect(handler.messages).toBe(handlerMessages);
    expect(handlerMessages).toEqual([]);
    expect(sender.messages).toBe(senderMessages);
    expect(senderMessages).toEqual([]);
    expect(receiver.messages).toBe(receiverMessages);
    expect(receiverMessages).toEqual([]);
  });

  if (Handler === RemoteWebSocketMessageHandler) {
    describe('Promise-like', () => {
      it('should be then-able', async () => {
        const handler = new Handler<Schema>(interceptorImplementation);
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

        const syncPromise = Promise.withResolvers<void>();
        handler.registerSyncPromise(syncPromise.promise);
        expect(handler.isSynced).toBe(false);

        const thenPromise = pendingHandler.then(fulfillmentListener);
        syncPromise.resolve();
        await thenPromise;

        expect(handler.isSynced).toBe(true);
        expect(pendingHandler.isSynced).toBe(true);

        expect(fulfillmentListener).toHaveBeenCalledTimes(1);
      });

      it('should be catch-able', async () => {
        const handler = new Handler<Schema>(interceptorImplementation);
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
        const handler = new Handler<Schema>(interceptorImplementation);
        await handler.respond({ type: 'delete', id: '1' });

        expect(handler).toHaveProperty('then', expect.any(Function));
        expect(handler).toHaveProperty('catch', expect.any(Function));
        expect(handler).toHaveProperty('finally', expect.any(Function));

        const finallyListener = vi.fn();

        expect(handler.isSynced).toBe(true);

        const pendingHandler = handler.with({});
        expect(pendingHandler).toEqual(handler);

        const syncPromise = Promise.withResolvers<void>();
        handler.registerSyncPromise(syncPromise.promise);
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
