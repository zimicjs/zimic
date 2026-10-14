import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { createBinaryMessage, expectWebSocketTimesCheckError, usingDirectWebSocketMessageHandler } from './utils';

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
    // The direct fixture holds two dispatches in flight at the same time, which the transport cannot schedule
    // deterministically.
    it('should not match more than an exact number of limited messages when messages are handled concurrently', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler },
        async ({ interceptor, handler, handleMessage }) => {
          let limitedResponses = 0;
          let fallbackResponses = 0;
          handler.effect(() => {
            fallbackResponses++;
          });

          const limitedHandler = interceptor.message();
          let numberOfEvaluatedMessages = 0;
          const restrictionsReady = Promise.withResolvers<void>();

          limitedHandler.with(async () => {
            numberOfEvaluatedMessages++;
            if (numberOfEvaluatedMessages === 2) {
              restrictionsReady.resolve();
            }
            await restrictionsReady.promise;
            return true;
          });
          limitedHandler.effect(() => {
            limitedResponses++;
          });
          limitedHandler.times(1);

          const message: Schema = { type: 'create', body: { text: 'overlap' } };
          const messageResultsPromise = Promise.all([handleMessage(message), handleMessage(message)]);

          await restrictionsReady.promise;
          expect(await messageResultsPromise).toEqual([true, true]);
          expect(limitedResponses).toBe(1);
          expect(fallbackResponses).toBe(1);
          await limitedHandler.checkTimes();
        },
      );
    });

    it('should match an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

        await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
          message: 'Expected exactly 1 message, but got 0.',
          expectedNumberOfMessages: 1,
        });

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          const response = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            client.addEventListener('message', resolve, { once: true });
          });

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
          await response;

          await handler.checkTimes();
        } finally {
          await client.close();
        }
      });
    });

    it('should match less than an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(2);

        await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
          message: 'Expected exactly 2 messages, but got 0.',
          expectedNumberOfMessages: 2,
        });

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          const response = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            client.addEventListener('message', resolve, { once: true });
          });

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
          await response;

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 messages, but got 1.',
            expectedNumberOfMessages: 2,
          });
        } finally {
          await client.close();
        }
      });
    });

    // The next tests send messages beyond the declared limit. They read the dispatch match result, since the transport
    // drops an unmatched message without any signal to the client.
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
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(0, 3);

        await handler.checkTimes();

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          for (const text of ['one', 'two', 'three']) {
            const response = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
              client.addEventListener('message', resolve, { once: true });
            });

            client.send(JSON.stringify({ type: 'create', body: { text } }));
            await response;

            await handler.checkTimes();
          }
        } finally {
          await client.close();
        }
      });
    });

    it('should match less than the minimum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(2, 3);

        await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
          message: 'Expected at least 2 and at most 3 messages, but got 0.',
          expectedNumberOfMessages: { min: 2, max: 3 },
        });

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          const response = new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
            client.addEventListener('message', resolve, { once: true });
          });

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
          await response;

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 2 and at most 3 messages, but got 1.',
            expectedNumberOfMessages: { min: 2, max: 3 },
          });
        } finally {
          await client.close();
        }
      });
    });

    // Reads the dispatch match result, since the transport drops an unmatched message without any signal to the client.
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

  // These tests read the dispatch match result, since the transport drops an unmatched message without any signal to
  // the client.
  describe('Unmatched messages', () => {
    it('should show unmatched JSON messages in times check errors', async () => {
      await usingDirectWebSocketMessageHandler<Schema>(
        { type, baseURL, Handler, messageSaving: { enabled: true } },
        async ({ handler, handleMessage }) => {
          handler.with({ type: 'delete' }).respond({ type: 'delete', id: '1' }).times(1);

          await expect(handleMessage({ type: 'create', body: { text: 'hello' } })).resolves.toBe(false);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 matching message, but got 0.',
            expectedNumberOfMessages: 1,
            unmatchedMessages:
              '- { "message": { "type": "create", "body": { "text": "hello" } }, ' +
              '"diff": { "data": { "expected": { "type": "delete" }, ' +
              '"received": { "type": "create", "body": { "text": "hello" } } } } }',
          });
        },
      );
    });

    it('should show unmatched array buffer messages in times check errors', async () => {
      await usingDirectWebSocketMessageHandler<WebSocketSchema<ArrayBuffer>>(
        { type, baseURL, Handler, messageSaving: { enabled: true } },
        async ({ handler, handleMessage }) => {
          handler.with(createBinaryMessage(1, 2)).respond(createBinaryMessage(5, 6)).times(1);

          await expect(handleMessage(createBinaryMessage(3, 4))).resolves.toBe(false);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 matching message, but got 0.',
            expectedNumberOfMessages: 1,
            unmatchedMessages:
              '- { "message": ArrayBuffer { byteLength: 2, bytes: [3, 4] }, ' +
              '"diff": { "data": { "expected": ArrayBuffer { byteLength: 2, bytes: [1, 2] }, ' +
              '"received": ArrayBuffer { byteLength: 2, bytes: [3, 4] } } } }',
          });
        },
      );
    });

    it('should show unmatched blob messages in times check errors', async () => {
      await usingDirectWebSocketMessageHandler<WebSocketSchema<Blob>>(
        { type, baseURL, Handler, messageSaving: { enabled: true } },
        async ({ handler, handleMessage }) => {
          const restrictedBlob = new Blob(['1'], { type: 'application/octet-stream' });
          const blob = new Blob(['blob'], { type: 'text/plain' });

          handler
            .with(restrictedBlob)
            .respond(new Blob(['response']))
            .times(1);

          await expect(handleMessage(blob)).resolves.toBe(false);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 matching message, but got 0.',
            expectedNumberOfMessages: 1,
            unmatchedMessages:
              '- { "message": Blob { type: \'text/plain\', size: 4 }, ' +
              '"diff": { "data": { "expected": Blob { type: \'application/octet-stream\', size: 1 }, ' +
              '"received": Blob { type: \'text/plain\', size: 4 } } } }',
          });
        },
      );
    });
  });

  it('should reset times when cleared', async () => {
    await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
      const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

      await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
        message: 'Expected exactly 1 message, but got 0.',
        expectedNumberOfMessages: 1,
      });

      handler.clear();

      await handler.checkTimes();
    });
  });
}
