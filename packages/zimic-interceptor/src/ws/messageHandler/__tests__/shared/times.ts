import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { expectWebSocketTimesCheckError, usingDirectWebSocketMessageHandler } from './utils';

export function declareTimesWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & { type: WebSocketInterceptorType },
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
    it('should include nested binary values in unmatched message diagnostics', async () => {
      type BinarySchema = WebSocketSchema<ArrayBuffer>;

      await usingDirectWebSocketMessageHandler<BinarySchema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async ({ handler, handleMessage }) => {
          const expectedBuffer = new Uint8Array([1, 2]).buffer;
          const receivedBuffer = new Uint8Array([3, 4]).buffer;

          handler.with(expectedBuffer).times(1);
          await handleMessage(receivedBuffer);

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 1 matching message, but got 0.',
            expectedNumberOfMessages: 1,
            unmatchedMessages: [
              '- {"message":ArrayBuffer { byteLength: 2, bytes: [3, 4] },"diff":{"data":{"expected":ArrayBuffer { byteLength: 2, bytes: [1, 2] },"received":ArrayBuffer { byteLength: 2, bytes: [3, 4] }}}}',
            ].join('\n'),
          });
        },
      );
    });

    it('should not match more than an exact number of limited messages when messages are handled concurrently', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          let limitedResponses = 0;
          let fallbackResponses = 0;
          const fallbackHandler = await interceptor.message().effect(() => {
            fallbackResponses++;
          });

          let numberOfEvaluatedMessages = 0;
          const restrictionsReady = Promise.withResolvers<void>();

          const limitedHandler = await interceptor
            .message()
            .with(async () => {
              numberOfEvaluatedMessages++;
              if (numberOfEvaluatedMessages === 2) {
                restrictionsReady.resolve();
              }
              await restrictionsReady.promise;
              return true;
            })
            .effect(() => {
              limitedResponses++;
            })
            .times(1);
          const clients = [new WebSocketClient<Schema>(baseURL), new WebSocketClient<Schema>(baseURL)];

          try {
            await Promise.all(clients.map((client) => client.open()));
            clients[0].send(JSON.stringify({ type: 'create', body: { text: 'overlap' } }));
            clients[1].send(JSON.stringify({ type: 'create', body: { text: 'overlap' } }));

            await restrictionsReady.promise;
            await waitFor(() => {
              expect(limitedHandler.messages).toHaveLength(1);
              expect(fallbackHandler.messages).toHaveLength(1);
            });
            expect(limitedResponses).toBe(1);
            expect(fallbackResponses).toBe(1);
            await limitedHandler.checkTimes();
          } finally {
            await Promise.all(clients.map((client) => client.close()));
          }
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
          const responsePromise = new Promise<string>((resolve) => {
            client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(responsePromise).resolves.toBe('{"type":"delete","id":"1"}');
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
          const responsePromise = new Promise<string>((resolve) => {
            client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
          await expect(responsePromise).resolves.toBe('{"type":"delete","id":"1"}');

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected exactly 2 messages, but got 1.',
            expectedNumberOfMessages: 2,
          });
        } finally {
          await client.close();
        }
      });
    });

    it('should not match more than an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor
            .message()
            .with({ type: 'create' })
            .respond({ type: 'delete', id: '1' })
            .times(1);
          const synchronizationHandler = await interceptor
            .message()
            .with({ type: 'delete', id: 'sync' })
            .respond({ type: 'delete', id: 'sync-response' });
          const client = new WebSocketClient<Schema>(baseURL);

          try {
            await client.open();
            const firstResponse = new Promise<string>((resolve) => {
              client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
            });
            client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
            await expect(firstResponse).resolves.toBe('{"type":"delete","id":"1"}');
            await handler.checkTimes();

            const responses: string[] = [];
            const synchronizationResponse = new Promise<string>((resolve) => {
              client.addEventListener('message', ({ data }) => {
                const response = String(data);
                responses.push(response);
                if (response === '{"type":"delete","id":"sync-response"}') {
                  resolve(response);
                }
              });
            });
            client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));
            client.send(JSON.stringify({ type: 'delete', id: 'sync' }));
            await expect(synchronizationResponse).resolves.toBe('{"type":"delete","id":"sync-response"}');
            expect(responses).toEqual(['{"type":"delete","id":"sync-response"}']);
            expect(handler.messages).toHaveLength(1);
            expect(synchronizationHandler.messages).toHaveLength(1);

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 1 matching message, but got 2.',
              expectedNumberOfMessages: 1,
            });
          } finally {
            await client.close();
          }
        },
      );
    });

    it('should match exactly zero messages', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const fallbackHandler = await interceptor.message().respond({ type: 'delete', id: 'fallback' });
          const handler = await interceptor
            .message()
            .with({ type: 'create' })
            .respond({ type: 'delete', id: '1' })
            .times(0);
          const client = new WebSocketClient<Schema>(baseURL);

          try {
            await client.open();
            await handler.checkTimes();
            const responsePromise = new Promise<string>((resolve) => {
              client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
            });
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
            await expect(responsePromise).resolves.toBe('{"type":"delete","id":"fallback"}');
            expect(handler.messages).toHaveLength(0);
            expect(fallbackHandler.messages).toHaveLength(1);
            await handler.checkTimes();
          } finally {
            await client.close();
          }
        },
      );
    });
  });

  describe('Range number of messages', () => {
    it('should match the minimum and maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(0, 3);
        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          await handler.checkTimes();

          for (const text of ['one', 'two', 'three']) {
            const responsePromise = new Promise<string>((resolve) => {
              client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
            });
            client.send(JSON.stringify({ type: 'create', body: { text } }));
            await expect(responsePromise).resolves.toBe('{"type":"delete","id":"1"}');
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
          const responsePromise = new Promise<string>((resolve) => {
            client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
          await expect(responsePromise).resolves.toBe('{"type":"delete","id":"1"}');

          await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
            message: 'Expected at least 2 and at most 3 messages, but got 1.',
            expectedNumberOfMessages: { min: 2, max: 3 },
          });
        } finally {
          await client.close();
        }
      });
    });

    it('should not match more than the maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor
            .message()
            .with({ type: 'create' })
            .respond({ type: 'delete', id: '1' })
            .times(0, 1);
          const synchronizationHandler = await interceptor
            .message()
            .with({ type: 'delete', id: 'sync' })
            .respond({ type: 'delete', id: 'sync-response' });
          const client = new WebSocketClient<Schema>(baseURL);

          try {
            await client.open();
            const firstResponse = new Promise<string>((resolve) => {
              client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
            });
            client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
            await expect(firstResponse).resolves.toBe('{"type":"delete","id":"1"}');

            const responses: string[] = [];
            const synchronizationResponse = new Promise<string>((resolve) => {
              client.addEventListener('message', ({ data }) => {
                const response = String(data);
                responses.push(response);
                if (response === '{"type":"delete","id":"sync-response"}') {
                  resolve(response);
                }
              });
            });
            client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));
            client.send(JSON.stringify({ type: 'delete', id: 'sync' }));
            await expect(synchronizationResponse).resolves.toBe('{"type":"delete","id":"sync-response"}');
            expect(responses).toEqual(['{"type":"delete","id":"sync-response"}']);
            expect(handler.messages).toHaveLength(1);
            expect(synchronizationHandler.messages).toHaveLength(1);

            await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected at least 0 and at most 1 matching message, but got 2.',
              expectedNumberOfMessages: { min: 0, max: 1 },
            });
          } finally {
            await client.close();
          }
        },
      );
    });
  });

  it('should reset times when cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

        await expectWebSocketTimesCheckError(() => handler.checkTimes(), {
          message: 'Expected exactly 1 message, but got 0.',
          expectedNumberOfMessages: 1,
        });

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();
          const responsePromise = new Promise<string>((resolve) => {
            client.addEventListener('message', ({ data }) => resolve(String(data)), { once: true });
          });
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));
          await expect(responsePromise).resolves.toBe('{"type":"delete","id":"1"}');
          await waitFor(() => expect(handler.messages).toHaveLength(1));
          await handler.checkTimes();

          const clearedHandler = await handler.clear();
          expect(clearedHandler.messages).toEqual([]);
          await clearedHandler.times(0);
          await clearedHandler.checkTimes();
        } finally {
          await client.close();
        }
      },
    );
  });
}
