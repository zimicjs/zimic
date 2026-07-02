import { afterAll, beforeAll, expect, expectTypeOf, it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { InterceptedWebSocketInterceptorMessage } from '../../../interceptor/types/messages';
import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import type { WebSocketMessageHandlerApplyContext } from '../../WebSocketMessageHandlerImplementation';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';

type CreateMessage = Extract<Schema, { type: 'create' }>;
type PrioritizedCreateMessage = CreateMessage & {
  body: CreateMessage['body'] & { priority: number };
};

export function declareTypeAssertionWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
) {
  const { type, startServer, stopServer, getBaseURL } = options;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  it('should narrow message schemas through static restrictions', async () => {
    const baseURL = await getBaseURL(type);

    await usingWebSocketInterceptor<Schema>({ type, baseURL }, (interceptor) => {
      function effect(message: Extract<Schema, { type: 'create' }>) {
        expectTypeOf(message).toEqualTypeOf<Extract<Schema, { type: 'create' }>>();
        expectTypeOf(message.body.text).toEqualTypeOf<string>();
      }

      effect({ type: 'create', body: { text: 'hello' } });

      interceptor.message().with({ type: 'create' }).effect(effect);
    });
  });

  it('should preserve the root schema while chaining static and computed restrictions', async () => {
    const baseURL = await getBaseURL(type);

    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      function hasPriority(message: CreateMessage): message is PrioritizedCreateMessage {
        return message.body.priority !== undefined;
      }

      expect(hasPriority({ type: 'create', body: { text: 'hello', priority: 1 } })).toBe(true);
      expect(hasPriority({ type: 'create', body: { text: 'hello' } })).toBe(false);

      const pendingHandler = interceptor.message().with({ type: 'create' });
      const syncedHandler = await pendingHandler;
      const handler = syncedHandler.with(hasPriority);

      handler.delay((message) => {
        expectTypeOf(message).toEqualTypeOf<PrioritizedCreateMessage>();
        return message.body.priority;
      });

      handler.effect((message, context) => {
        expectTypeOf(message).toEqualTypeOf<PrioritizedCreateMessage>();
        expectTypeOf(context).toEqualTypeOf<WebSocketMessageHandlerApplyContext<Schema>>();

        context.sender.send(JSON.stringify({ type: 'delete', id: message.body.text }));
        context.receiver.send(JSON.stringify({ type: 'create', body: { text: 'response' } }));
      });

      handler.respond((message, context) => {
        expectTypeOf(message).toEqualTypeOf<PrioritizedCreateMessage>();
        expectTypeOf(context.sender.messages).toEqualTypeOf<typeof context.receiver.messages>();

        return { type: 'delete', id: message.body.text };
      });

      handler.respond({ type: 'delete', id: '1' });

      expectTypeOf<typeof handler.messages>().toEqualTypeOf<
        readonly InterceptedWebSocketInterceptorMessage<PrioritizedCreateMessage, Schema>[]
      >();

      await handler;
    });
  });

  it('should accept boolean computed restrictions without narrowing message schemas', async () => {
    const baseURL = await getBaseURL(type);

    await usingWebSocketInterceptor<Schema>({ type, baseURL }, (interceptor) => {
      const handler = interceptor.message().with((message): boolean => message.type === 'create');

      handler.effect((message) => {
        expectTypeOf(message).toEqualTypeOf<Schema>();
      });
    });
  });

  it('should reject invalid message declarations', async () => {
    const baseURL = await getBaseURL(type);

    await usingWebSocketInterceptor<Schema>({ type, baseURL }, (interceptor) => {
      // @ts-expect-error Invalid static restriction.
      interceptor.message().with({ type: 'update' });

      // @ts-expect-error Invalid static response.
      interceptor.message().respond({ type: 'update' });

      function responseFactory(message: Schema) {
        expectTypeOf(message).toEqualTypeOf<Schema>();

        return message;
      }
      responseFactory({ type: 'delete', id: '1' });
      interceptor.message().respond(responseFactory);

      function invalidResponseFactory() {
        return { type: 'update' };
      }
      invalidResponseFactory();
      // @ts-expect-error Invalid computed response.
      interceptor.message().respond(invalidResponseFactory);

      const restrictedHandler = interceptor
        .message()
        .with({ type: 'create' })
        .with((message): message is CreateMessage => {
          return message.body.text.length > 0;
        });

      restrictedHandler.respond({ type: 'delete', id: '1' });

      // @ts-expect-error Invalid restriction after narrowing.
      restrictedHandler.with({ type: 'delete' });

      // @ts-expect-error Invalid response after narrowing.
      restrictedHandler.respond({ type: 'update' });
    });
  });
}
