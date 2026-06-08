import { waitForNot } from '@zimic/utils/time';
import { WebSocketClient } from '@zimic/ws';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { expectWebSocketTimesCheckError, usingWebSocketClient, waitForWebSocketMessage } from './utils';

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

  async function sendMatchingMessage(client: WebSocketClient<Schema>, text = 'hello') {
    const messagePromise = waitForWebSocketMessage(client);

    client.send(JSON.stringify({ type: 'create', body: { text } }));

    await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
  }

  describe('Exact number of messages', () => {
    it('should match an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<Schema>(
        {
          type,
          baseURL,
        },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'delete', id: '1' }).times(1),
            interceptor,
          );

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 message, but got 0.',
            expectedNumberOfMessages: 1,
          });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            await sendMatchingMessage(client);
          });

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
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'delete', id: '1' }).times(2),
            interceptor,
          );

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 messages, but got 0.',
            expectedNumberOfMessages: 2,
          });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            await sendMatchingMessage(client);
          });

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 messages, but got 1.',
            expectedNumberOfMessages: 2,
          });
        },
      );
    });

    it('should not match to more than an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<Schema>(
        {
          type,
          baseURL,
        },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'delete', id: '1' }).times(1),
            interceptor,
          );

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            await sendMatchingMessage(client);
            await handler.checkTimes();

            const messageListener = vi.fn();
            client.addEventListener('message', messageListener);

            client.send(JSON.stringify({ type: 'create', body: { text: 'again' } }));

            await waitForNot(() => {
              expect(messageListener).toHaveBeenCalled();
            });
          });

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 message, but got 2.',
            expectedNumberOfMessages: 1,
          });
        },
      );
    });

    it('should match exactly zero messages', async () => {
      await usingWebSocketInterceptor<Schema>(
        {
          type,
          baseURL,
        },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'delete', id: '1' }).times(0),
            interceptor,
          );

          await handler.checkTimes();

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const messageListener = vi.fn();
            client.addEventListener('message', messageListener);

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitForNot(() => {
              expect(messageListener).toHaveBeenCalled();
            });
          });

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 0 messages, but got 1.',
            expectedNumberOfMessages: 0,
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
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'delete', id: '1' }).times(0, 3),
            interceptor,
          );

          await handler.checkTimes();

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            await sendMatchingMessage(client, 'one');
            await handler.checkTimes();

            await sendMatchingMessage(client, 'two');
            await handler.checkTimes();

            await sendMatchingMessage(client, 'three');
            await handler.checkTimes();
          });
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
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'delete', id: '1' }).times(2, 3),
            interceptor,
          );

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 2 and at most 3 messages, but got 0.',
            expectedNumberOfMessages: { min: 2, max: 3 },
          });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            await sendMatchingMessage(client);
          });

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 2 and at most 3 messages, but got 1.',
            expectedNumberOfMessages: { min: 2, max: 3 },
          });
        },
      );
    });

    it('should match the maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        {
          type,
          baseURL,
        },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'delete', id: '1' }).times(2, 3),
            interceptor,
          );

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            await sendMatchingMessage(client, 'one');
            await sendMatchingMessage(client, 'two');
            await sendMatchingMessage(client, 'three');
          });

          await handler.checkTimes();
        },
      );
    });

    it('should not match to more than the maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        {
          type,
          baseURL,
        },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'delete', id: '1' }).times(2, 3),
            interceptor,
          );

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            await sendMatchingMessage(client, 'one');
            await sendMatchingMessage(client, 'two');
            await sendMatchingMessage(client, 'three');
            await handler.checkTimes();

            const messageListener = vi.fn();
            client.addEventListener('message', messageListener);

            client.send(JSON.stringify({ type: 'create', body: { text: 'four' } }));

            await waitForNot(() => {
              expect(messageListener).toHaveBeenCalled();
            });
          });

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 2 and at most 3 messages, but got 4.',
            expectedNumberOfMessages: { min: 2, max: 3 },
          });
        },
      );
    });

    it('should match the exact number of messages limited in a range including zero', async () => {
      await usingWebSocketInterceptor<Schema>(
        {
          type,
          baseURL,
        },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'delete', id: '1' }).times(0, 1),
            interceptor,
          );

          await handler.checkTimes();

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            await sendMatchingMessage(client);
            await handler.checkTimes();

            const messageListener = vi.fn();
            client.addEventListener('message', messageListener);

            client.send(JSON.stringify({ type: 'create', body: { text: 'again' } }));

            await waitForNot(() => {
              expect(messageListener).toHaveBeenCalled();
            });
          });

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 0 and at most 1 message, but got 2.',
            expectedNumberOfMessages: { min: 0, max: 1 },
          });
        },
      );
    });

    it('should match the exact number of messages limited in a unitary range', async () => {
      await usingWebSocketInterceptor<Schema>(
        {
          type,
          baseURL,
        },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'delete', id: '1' }).times(1, 1),
            interceptor,
          );

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 message, but got 0.',
            expectedNumberOfMessages: { min: 1, max: 1 },
          });

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            await sendMatchingMessage(client);
          });

          await handler.checkTimes();
        },
      );
    });
  });

  describe('Unmatched messages', () => {
    it('should report unmatched messages when message saving is enabled', async () => {
      await usingWebSocketInterceptor<Schema>(
        {
          type,
          baseURL,
          messageSaving: { enabled: true },
        },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: '1' }).times(1),
            interceptor,
          );

          await usingWebSocketClient<Schema>(baseURL, async (client) => {
            const messageListener = vi.fn();
            client.addEventListener('message', messageListener);

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitForNot(() => {
              expect(messageListener).toHaveBeenCalled();
            });
          });

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 matching message, but got 0.',
            expectedNumberOfMessages: 1,
            unmatchedMessages:
              '- {"message":{"type":"create","body":{"text":"hello"}},"diff":{"data":{"expected":{"type":"delete"},"received":{"type":"create","body":{"text":"hello"}}}}}',
          });
        },
      );
    });
  });

  it('should reset message counts after cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.message().respond({ type: 'delete', id: '1' }).times(1),
          interceptor,
        );

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          await sendMatchingMessage(client);
        });

        await handler.checkTimes();

        await promiseIfRemote(handler.clear(), interceptor);

        await handler.checkTimes();
      },
    );
  });
}
