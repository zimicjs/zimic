import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import { createInternalWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

import { expectWebSocketTimesCheckError } from '../../../interceptor/__tests__/shared/utils';
import LocalWebSocketInterceptor from '../../../interceptor/LocalWebSocketInterceptor';
import RemoteWebSocketInterceptor from '../../../interceptor/RemoteWebSocketInterceptor';
import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import {
  createWebSocketInterceptorClient,
  InternalWebSocketInterceptorClient,
} from '../../../interceptor/WebSocketInterceptorHandle';
import WebSocketInterceptorImplementation from '../../../interceptor/WebSocketInterceptorImplementation';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { WebSocketMessageHandlerMessageMatch } from '../../WebSocketMessageHandlerImplementation';
import { ChatMessage, Schema, SharedWebSocketMessageHandlerTestOptions } from './utils';

export function declareRestrictionWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
) {
  const { type, startServer, stopServer, getBaseURL, Handler } = options;

  let baseURL: string;

  let interceptor: LocalWebSocketInterceptor<Schema> | RemoteWebSocketInterceptor<Schema>;
  let interceptorImplementation: WebSocketInterceptorImplementation<Schema>;

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

    await interceptor.start();

    sender = createWebSocketInterceptorClient<Schema>(baseURL, vi.fn());
  });

  afterEach(async () => {
    await interceptor.stop();
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  it('should match only specific messages if contains static restrictions', async () => {
    const handler = new Handler<Schema>(interceptorImplementation);
    await promiseIfRemote(handler.with({ type: 'create', body: { text: 'hello' } }), interceptor);

    const context = { sender, receiver: interceptorImplementation.server };

    const matchingMessage: Schema = { type: 'create', body: { text: 'hello' } };
    expect(
      await handler.implementation.matchesMessage(matchingMessage, context),
    ).toEqual<WebSocketMessageHandlerMessageMatch>({ success: true, message: matchingMessage });

    for (const mismatchingMessage of [
      { type: 'delete', id: '1' },
      { type: 'create', body: { text: 'goodbye' } },
    ] satisfies Schema[]) {
      expect(
        await handler.implementation.matchesMessage(mismatchingMessage, context),
      ).toEqual<WebSocketMessageHandlerMessageMatch>({
        success: false,
        cause: 'unmatchedRestrictions',
        message: mismatchingMessage,
        diff: {
          data: { expected: { type: 'create', body: { text: 'hello' } }, received: mismatchingMessage },
        },
      });
    }
  });

  it('should match only specific messages if contains computed restrictions', async () => {
    function isCreateMessage(message: ChatMessage): message is Extract<ChatMessage, { type: 'create' }> {
      return message.type === 'create';
    }

    const handler = new Handler<Schema>(interceptorImplementation);
    await promiseIfRemote(handler.with(isCreateMessage), interceptor);

    const context = { sender, receiver: interceptorImplementation.server };

    const matchingMessage: Schema = { type: 'create', body: { text: 'hello' } };
    expect(
      await handler.implementation.matchesMessage(matchingMessage, context),
    ).toEqual<WebSocketMessageHandlerMessageMatch>({ success: true, message: matchingMessage });

    const mismatchingMessage: Schema = { type: 'delete', id: '1' };
    expect(
      await handler.implementation.matchesMessage(mismatchingMessage, context),
    ).toEqual<WebSocketMessageHandlerMessageMatch>({
      success: false,
      cause: 'unmatchedRestrictions',
      message: mismatchingMessage,
      diff: { computed: { expected: true, received: false } },
    });
  });

  it('should match only specific messages if contains boolean computed restrictions', async () => {
    const handler = new Handler<Schema>(interceptorImplementation);
    await promiseIfRemote(
      handler.with((message: Schema): boolean => message.type === 'create' && message.body.text.startsWith('hello')),
      interceptor,
    );

    const context = { sender, receiver: interceptorImplementation.server };

    const matchingMessage: Schema = { type: 'create', body: { text: 'hello' } };
    expect(
      await handler.implementation.matchesMessage(matchingMessage, context),
    ).toEqual<WebSocketMessageHandlerMessageMatch>({ success: true, message: matchingMessage });

    for (const mismatchingMessage of [
      { type: 'delete', id: '1' },
      { type: 'create', body: { text: 'goodbye' } },
    ] satisfies Schema[]) {
      expect(
        await handler.implementation.matchesMessage(mismatchingMessage, context),
      ).toEqual<WebSocketMessageHandlerMessageMatch>({
        success: false,
        cause: 'unmatchedRestrictions',
        message: mismatchingMessage,
        diff: { computed: { expected: true, received: false } },
      });
    }
  });

  it('should match only messages from a restricted sender', async () => {
    const otherSender = createWebSocketInterceptorClient<Schema>(baseURL, vi.fn());

    const handler = new Handler<Schema>(interceptorImplementation);
    await promiseIfRemote(handler.from(sender), interceptor);

    const receiver = interceptorImplementation.server;
    const message: Schema = { type: 'create', body: { text: 'hello' } };

    expect(
      await handler.implementation.matchesMessage(message, { sender, receiver }),
    ).toEqual<WebSocketMessageHandlerMessageMatch>({ success: true, message });

    expect(
      await handler.implementation.matchesMessage(message, { sender: otherSender, receiver }),
    ).toEqual<WebSocketMessageHandlerMessageMatch>({
      success: false,
      cause: 'unmatchedRestrictions',
      message,
      diff: { sender: { expected: true, received: false } },
    });
  });

  it('should report messages from other senders as unmatched in times checks when message saving is enabled', async () => {
    const otherSender = createWebSocketInterceptorClient<Schema>(baseURL, vi.fn());

    const handler = new Handler<Schema>(interceptorImplementation);
    await promiseIfRemote(handler.from(sender).respond({ type: 'delete', id: '1' }).times(1), interceptor);

    const message: Schema = { type: 'create', body: { text: 'hello' } };
    const receiver = interceptorImplementation.server;

    await interceptorImplementation.handleInterceptedMessage(JSON.stringify(message), {
      sender: otherSender,
      receiver,
    });

    await expectWebSocketTimesCheckError(() => promiseIfRemote(handler.checkTimes(), handler), {
      message: 'Expected exactly 1 matching message, but got 0.',
      expectedNumberOfMessages: 1,
      unmatchedMessages:
        '- { "message": { "type": "create", "body": { "text": "hello" } }, ' +
        '"diff": { "sender": { "expected": "true", "received": "false" } } }',
    });
  });

  it('should match only messages satisfying multiple restrictions', async () => {
    const handler = new Handler<Schema>(interceptorImplementation);
    await promiseIfRemote(
      handler
        .with({ type: 'create' })
        .with(
          (message: Schema): message is Extract<Schema, { type: 'create' }> =>
            message.type === 'create' && message.body.text.startsWith('hello'),
        ),
      interceptor,
    );

    const context = { sender, receiver: interceptorImplementation.server };

    const matchingMessage: Schema = { type: 'create', body: { text: 'hello' } };
    expect(
      await handler.implementation.matchesMessage(matchingMessage, context),
    ).toEqual<WebSocketMessageHandlerMessageMatch>({ success: true, message: matchingMessage });

    const staticMismatchingMessage: Schema = { type: 'delete', id: '1' };
    expect(
      await handler.implementation.matchesMessage(staticMismatchingMessage, context),
    ).toEqual<WebSocketMessageHandlerMessageMatch>({
      success: false,
      cause: 'unmatchedRestrictions',
      message: staticMismatchingMessage,
      diff: { data: { expected: { type: 'create' }, received: staticMismatchingMessage } },
    });

    const computedMismatchingMessage: Schema = { type: 'create', body: { text: 'goodbye' } };
    expect(
      await handler.implementation.matchesMessage(computedMismatchingMessage, context),
    ).toEqual<WebSocketMessageHandlerMessageMatch>({
      success: false,
      cause: 'unmatchedRestrictions',
      message: computedMismatchingMessage,
      diff: { computed: { expected: true, received: false } },
    });
  });

  it('should clear restrictions after cleared', async () => {
    const handler = new Handler<Schema>(interceptorImplementation);
    await promiseIfRemote(handler.with({ type: 'delete' }).from(sender), interceptor);

    const otherSender = createWebSocketInterceptorClient<Schema>(baseURL, vi.fn());
    const message: Schema = { type: 'create', body: { text: 'hello' } };
    const context = { sender: otherSender, receiver: interceptorImplementation.server };

    expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>({
      success: false,
      cause: 'unmatchedRestrictions',
      message,
      diff: { sender: { expected: true, received: false } },
    });

    await promiseIfRemote(handler.clear(), interceptor);

    expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>({
      success: true,
      message,
    });
  });
}
