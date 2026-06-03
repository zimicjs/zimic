import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import DisabledMessageSavingError from '../../errors/DisabledMessageSavingError';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';

export function declareDefaultWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
) {
  const { platform, type, startServer, stopServer, getBaseURL } = options;

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

  it('should not match any message if contains no declared response or effect', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        expect(interceptor.platform).toBe(platform);

        const handler = interceptor.message().times(0);

        await handler.checkTimes();
      },
    );
  });

  it('should match any message if contains a declared response and no restrictions', async () => {
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

  it('should not match any message if cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const handler = interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

        await expect(async () => {
          await handler.checkTimes();
        }).rejects.toThrow('Expected exactly 1 message, but got 0.');

        handler.clear();

        await handler.checkTimes();
      },
    );
  });

  it('should create response with declared message', async () => {
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

  it('should create response with declared message factory', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const handler = interceptor
          .message()
          .respond((message) => ({ type: 'delete', id: message.type }))
          .times(0);

        await handler.checkTimes();
      },
    );
  });

  it('should not throw an error if trying to create a response without a declared response', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const handler = interceptor.message();

        await handler.checkTimes();
      },
    );
  });

  it('should keep track of the intercepted messages', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
        messageSaving: { enabled: true },
      },
      (interceptor) => {
        const handler = interceptor.message().respond({ type: 'delete', id: '1' });

        expect(handler.messages).toEqual([]);
      },
    );
  });

  it('should clear restrictions after cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const handler = interceptor
          .message()
          .from(interceptor.server)
          .with({ type: 'create', body: { text: 'hello' } })
          .delay(1)
          .delay(1, 2)
          .effect(() => undefined)
          .respond({ type: 'delete', id: '1' })
          .times(1);

        await expect(async () => {
          await handler.checkTimes();
        }).rejects.toThrow('Expected exactly 1 matching message, but got 0.');

        handler.clear();

        await handler.checkTimes();
      },
    );
  });

  it('should throw an error if trying to access messages and message saving is disabled', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      (interceptor) => {
        const handler = interceptor.message().effect(() => undefined);

        expect(() => handler.messages).toThrow(DisabledMessageSavingError);
      },
    );
  });
}
