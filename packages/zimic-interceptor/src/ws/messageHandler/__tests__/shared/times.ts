import { beforeAll, beforeEach, afterAll, describe, it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { expectWebSocketTimesCheckError } from './utils';

export function declareTimesWebSocketMessageHandlerTests(
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

  describe('Exact number of messages', () => {
    it('should match an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<Schema>(
        {
          type,
          baseURL,
        },
        async (interceptor) => {
          const handler = interceptor.message().respond({ type: 'delete', id: '1' }).times(0);

          await handler.checkTimes();
        },
      );
    });

    it('should match less than an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<Schema>(
        {
          type,
          baseURL,
        },
        async (interceptor) => {
          const handler = interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 message, but got 0.',
            expectedNumberOfMessages: 1,
          });
        },
      );
    });
  });

  describe('Range number of messages', () => {
    it('should match the minimum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        {
          type,
          baseURL,
        },
        async (interceptor) => {
          const handler = interceptor.message().respond({ type: 'delete', id: '1' }).times(0, 1);

          await handler.checkTimes();
        },
      );
    });

    it('should match less than the minimum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        {
          type,
          baseURL,
        },
        async (interceptor) => {
          const handler = interceptor.message().respond({ type: 'delete', id: '1' }).times(1, 2);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 1 and at most 2 messages, but got 0.',
            expectedNumberOfMessages: { min: 1, max: 2 },
          });
        },
      );
    });
  });
}
