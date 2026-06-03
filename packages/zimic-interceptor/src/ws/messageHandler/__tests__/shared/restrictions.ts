import { beforeAll, beforeEach, afterAll, expectTypeOf, it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { ChatMessage, Schema, SharedWebSocketMessageHandlerTestOptions } from './types';

export function declareRestrictionWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
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

  it('should match only specific messages if contains a declared response and static restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      (interceptor) => {
        interceptor
          .message()
          .with({ type: 'create', body: { text: 'hello' } })
          .respond({ type: 'delete', id: '1' });
      },
    );
  });

  it('should match only specific messages if contains a declared response and computed restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      (interceptor) => {
        function isCreateMessage(message: ChatMessage): message is Extract<ChatMessage, { type: 'create' }> {
          return message.type === 'create';
        }

        interceptor
          .message()
          .with(isCreateMessage)
          .effect((message) => {
            expectTypeOf(message.body.priority).toEqualTypeOf<number | undefined>();
          });
      },
    );
  });
}
