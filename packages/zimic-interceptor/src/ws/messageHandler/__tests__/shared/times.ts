import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { expectWebSocketTimesCheckError, usingDirectWebSocketMessageHandler } from './utils';

export function declareTimesWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
) {
  const { type, Handler, startServer, stopServer, getBaseURL } = options;

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
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ handler, handleMessage }) => {
          handler.respond({ type: 'delete', id: '1' }).times(1);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 message, but got 0.',
            expectedNumberOfMessages: 1,
          });

          await handleMessage({ type: 'create', body: { text: 'hello' } });

          await handler.checkTimes();
        },
      );
    });

    it('should match less than an exact number of limited messages', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ handler, handleMessage }) => {
          handler.respond({ type: 'delete', id: '1' }).times(2);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 messages, but got 0.',
            expectedNumberOfMessages: 2,
          });

          await handleMessage({ type: 'create', body: { text: 'hello' } });

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 messages, but got 1.',
            expectedNumberOfMessages: 2,
          });
        },
      );
    });

    it('should not match more than an exact number of limited messages', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ handler, sender, handleMessage }) => {
          handler.respond({ type: 'delete', id: '1' }).times(1);

          await expect(handleMessage({ type: 'create', body: { text: 'one' } })).resolves.toBe(true);
          await handler.checkTimes();
          await expect(handleMessage({ type: 'create', body: { text: 'two' } })).resolves.toBe(false);

          expect(sender.sentMessages).toEqual([JSON.stringify({ type: 'delete', id: '1' })]);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 message, but got 2.',
            expectedNumberOfMessages: 1,
          });
        },
      );
    });

    it('should match exactly zero messages', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ handler, handleMessage }) => {
          handler.respond({ type: 'delete', id: '1' }).times(0);

          await handler.checkTimes();
          await expect(handleMessage({ type: 'create', body: { text: 'hello' } })).resolves.toBe(false);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 0 messages, but got 1.',
            expectedNumberOfMessages: 0,
          });
        },
      );
    });
  });

  describe('Range number of messages', () => {
    it('should match the minimum and maximum number of messages limited in a range', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ handler, handleMessage }) => {
          handler.respond({ type: 'delete', id: '1' }).times(0, 3);

          await handler.checkTimes();

          await handleMessage({ type: 'create', body: { text: 'one' } });
          await handler.checkTimes();

          await handleMessage({ type: 'create', body: { text: 'two' } });
          await handler.checkTimes();

          await handleMessage({ type: 'create', body: { text: 'three' } });
          await handler.checkTimes();
        },
      );
    });

    it('should match less than the minimum number of messages limited in a range', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ handler, handleMessage }) => {
          handler.respond({ type: 'delete', id: '1' }).times(2, 3);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 2 and at most 3 messages, but got 0.',
            expectedNumberOfMessages: { min: 2, max: 3 },
          });

          await handleMessage({ type: 'create', body: { text: 'hello' } });

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 2 and at most 3 messages, but got 1.',
            expectedNumberOfMessages: { min: 2, max: 3 },
          });
        },
      );
    });

    it('should not match more than the maximum number of messages limited in a range', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ handler, handleMessage }) => {
          handler.respond({ type: 'delete', id: '1' }).times(0, 1);

          await expect(handleMessage({ type: 'create', body: { text: 'one' } })).resolves.toBe(true);
          await expect(handleMessage({ type: 'create', body: { text: 'two' } })).resolves.toBe(false);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 0 and at most 1 message, but got 2.',
            expectedNumberOfMessages: { min: 0, max: 1 },
          });
        },
      );
    });
  });

  it('should reset times when cleared', async () => {
    await usingDirectWebSocketMessageHandler<Schema>({ type, baseURL, Handler }, async ({ handler }) => {
      handler.respond({ type: 'delete', id: '1' }).times(1);

      await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
        message: 'Expected exactly 1 message, but got 0.',
        expectedNumberOfMessages: 1,
      });

      handler.clear();

      await handler.checkTimes();
    });
  });
}
