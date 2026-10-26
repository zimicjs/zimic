import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { collectWebSocketClientMessages, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { createBinaryMessage, expectWebSocketTimesCheckError } from './utils';

export function declareTimesWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
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
    it('should not match more than an exact number of limited messages when messages are handled concurrently', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        let numberOfEvaluatedMessages = 0;
        const restrictionsReadyPromise = createPromiseWithResolvers<void>();

        await interceptor.message().respond({ type: 'delete', id: 'fallback' });

        const limitedHandler = await interceptor
          .message()
          .with(async () => {
            numberOfEvaluatedMessages++;
            if (numberOfEvaluatedMessages === 2) {
              restrictionsReadyPromise.resolve();
            }

            await restrictionsReadyPromise;
            return true;
          })
          .respond({ type: 'delete', id: 'limited' })
          .times(1);

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          const responses = collectWebSocketClientMessages(client);

          const message: Schema = { type: 'create', body: { text: 'overlap' } };
          client.send(JSON.stringify(message));
          client.send(JSON.stringify(message));

          await waitFor(() => expect(responses).toHaveLength(2));

          expect(responses).toEqual(
            expect.arrayContaining([
              JSON.stringify({ type: 'delete', id: 'limited' }),
              JSON.stringify({ type: 'delete', id: 'fallback' }),
            ]),
          );

          await limitedHandler.checkTimes();
        } finally {
          await client.close();
        }
      });
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

          const response = waitForWebSocketClientMessage(client);

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

          const response = waitForWebSocketClientMessage(client);

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

    it('should not match more than an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          const response = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
          expect(await response).toBe(JSON.stringify({ type: 'delete', id: '1' }));

          await handler.checkTimes();

          client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

          await waitFor(() =>
            expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 1 message, but got 2.',
              expectedNumberOfMessages: 1,
            }),
          );

          const probeResponse = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'delete', id: 'unmatched' }));

          // The next message received is the probe response, so the over-limit message got no response.
          expect(await probeResponse).toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
        } finally {
          await client.close();
        }
      });
    });

    it('should match exactly zero messages', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(0);

        await handler.checkTimes();

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(() =>
            expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected exactly 0 messages, but got 1.',
              expectedNumberOfMessages: 0,
            }),
          );
        } finally {
          await client.close();
        }
      });
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
            const response = waitForWebSocketClientMessage(client);

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

          const response = waitForWebSocketClientMessage(client);

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

    it('should not match more than the maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<Schema>({ type, baseURL }, async (interceptor) => {
        await interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' });

        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(0, 1);

        const client = new WebSocketClient<Schema>(baseURL);

        try {
          await client.open();

          const response = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
          expect(await response).toBe(JSON.stringify({ type: 'delete', id: '1' }));

          client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

          await waitFor(() =>
            expectWebSocketTimesCheckError(() => handler.checkTimes(), {
              message: 'Expected at least 0 and at most 1 message, but got 2.',
              expectedNumberOfMessages: { min: 0, max: 1 },
            }),
          );

          const probeResponse = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'delete', id: 'unmatched' }));

          // The next message received is the probe response, so the over-limit message got no response.
          expect(await probeResponse).toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
        } finally {
          await client.close();
        }
      });
    });
  });

  describe('Unmatched messages', () => {
    it('should show unmatched JSON messages in times check errors', async () => {
      await usingWebSocketInterceptor<Schema>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor
            .message()
            .with({ type: 'delete' })
            .respond({ type: 'delete', id: '1' })
            .times(1);

          const client = new WebSocketClient<Schema>(baseURL);

          try {
            await client.open();

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitFor(() =>
              expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                message: 'Expected exactly 1 matching message, but got 0.',
                expectedNumberOfMessages: 1,
                unmatchedMessages:
                  '- { "message": { "type": "create", "body": { "text": "hello" } }, ' +
                  '"diff": { "data": { "expected": { "type": "delete" }, ' +
                  '"received": { "type": "create", "body": { "text": "hello" } } } } }',
              }),
            );
          } finally {
            await client.close();
          }
        },
      );
    });

    it('should show unmatched array buffer messages in times check errors', async () => {
      await usingWebSocketInterceptor<WebSocketSchema<ArrayBuffer>>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor
            .message()
            .with(createBinaryMessage(1, 2))
            .respond(createBinaryMessage(5, 6))
            .times(1);

          const client = new WebSocketClient<WebSocketSchema<ArrayBuffer>>(baseURL);

          try {
            await client.open();

            client.send(createBinaryMessage(3, 4));

            await waitFor(() =>
              expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                message: 'Expected exactly 1 matching message, but got 0.',
                expectedNumberOfMessages: 1,
                unmatchedMessages:
                  '- { "message": ArrayBuffer { byteLength: 2 }, ' +
                  '"diff": { "data": { "expected": ArrayBuffer { byteLength: 2 }, ' +
                  '"received": ArrayBuffer { byteLength: 2 } } } }',
              }),
            );
          } finally {
            await client.close();
          }
        },
      );
    });

    it('should show unmatched blob messages in times check errors', async () => {
      await usingWebSocketInterceptor<WebSocketSchema<Blob>>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const restrictedBlob = new Blob(['1'], { type: 'application/octet-stream' });
          const blob = new Blob(['blob'], { type: 'text/plain' });

          const handler = await interceptor
            .message()
            .with(restrictedBlob)
            .respond(new Blob(['response']))
            .times(1);

          const client = new WebSocketClient<WebSocketSchema<Blob>>(baseURL);

          try {
            await client.open();

            client.send(blob);

            await waitFor(() =>
              expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                message: 'Expected exactly 1 matching message, but got 0.',
                expectedNumberOfMessages: 1,
                unmatchedMessages:
                  '- { "message": ArrayBuffer { byteLength: 4 }, ' +
                  '"diff": { "data": { "expected": Blob { type: \'application/octet-stream\', size: 1 }, ' +
                  '"received": ArrayBuffer { byteLength: 4 } } } }',
              }),
            );
          } finally {
            await client.close();
          }
        },
      );
    });

    it('should show unmatched typed array messages in times check errors', async () => {
      await usingWebSocketInterceptor<WebSocketSchema<Uint8Array<ArrayBuffer>>>(
        { type, baseURL, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await interceptor
            .message()
            .with(new Uint8Array([1, 2]))
            .respond(new Uint8Array([5, 6]))
            .times(1);

          const client = new WebSocketClient<WebSocketSchema<Uint8Array<ArrayBuffer>>>(baseURL);

          try {
            await client.open();

            client.send(new Uint8Array([3, 4]));

            await waitFor(() =>
              expectWebSocketTimesCheckError(() => handler.checkTimes(), {
                message: 'Expected exactly 1 matching message, but got 0.',
                expectedNumberOfMessages: 1,
                unmatchedMessages:
                  '- { "message": ArrayBuffer { byteLength: 2 }, ' +
                  '"diff": { "data": { "expected": Uint8Array { byteLength: 2 }, ' +
                  '"received": ArrayBuffer { byteLength: 2 } } } }',
              }),
            );
          } finally {
            await client.close();
          }
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
