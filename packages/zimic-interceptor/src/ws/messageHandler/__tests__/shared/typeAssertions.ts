import { afterAll, beforeAll, expectTypeOf, it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
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
      interceptor
        .message()
        .with({ type: 'create' })
        .effect((message) => {
          expectTypeOf(message).toEqualTypeOf<Extract<Schema, { type: 'create' }>>();
          expectTypeOf(message.body.text).toEqualTypeOf<string>();
        });
    });
  });

  it('should narrow message schemas through computed restrictions', async () => {
    const baseURL = await getBaseURL(type);

    await usingWebSocketInterceptor<Schema>({ type, baseURL }, (interceptor) => {
      function isCreateMessage(message: ChatMessage): message is Extract<ChatMessage, { type: 'create' }> {
        return message.type === 'create';
      }

      interceptor
        .message()
        .with(isCreateMessage)
        .effect((message, context) => {
          expectTypeOf(message).toEqualTypeOf<Extract<Schema, { type: 'create' }>>();
          expectTypeOf(context.sender.messages).toEqualTypeOf<typeof context.receiver.messages>();
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

      interceptor.message().respond((message) => {
        expectTypeOf(message).toEqualTypeOf<Schema>();

        return message;
      });

      // @ts-expect-error Invalid computed response.
      interceptor.message().respond(() => ({ type: 'update' }));
    });
  });
}
