import { afterAll, beforeAll, expect, expectTypeOf, it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import type { WebSocketMessageHandlerApplyContext } from '../../WebSocketMessageHandlerImplementation';
import { ChatMessage, Schema, SharedWebSocketMessageHandlerTestOptions } from './types';

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

  it('should narrow message schemas through computed restrictions', async () => {
    const baseURL = await getBaseURL(type);

    await usingWebSocketInterceptor<Schema>({ type, baseURL }, (interceptor) => {
      function isCreateMessage(message: ChatMessage): message is Extract<ChatMessage, { type: 'create' }> {
        return message.type === 'create';
      }

      expect(isCreateMessage({ type: 'create', body: { text: 'hello' } })).toBe(true);
      expect(isCreateMessage({ type: 'delete', id: '1' })).toBe(false);

      function effect(
        message: Extract<Schema, { type: 'create' }>,
        context: WebSocketMessageHandlerApplyContext<Schema>,
      ) {
        expectTypeOf(message).toEqualTypeOf<Extract<Schema, { type: 'create' }>>();
        expectTypeOf(context.sender.messages).toEqualTypeOf<typeof context.receiver.messages>();
      }

      effect({ type: 'create', body: { text: 'hello' } }, {
        sender: { messages: [] },
        receiver: { messages: [] },
      } as unknown as Parameters<typeof effect>[1]);

      interceptor.message().with(isCreateMessage).effect(effect);
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
    });
  });
}
