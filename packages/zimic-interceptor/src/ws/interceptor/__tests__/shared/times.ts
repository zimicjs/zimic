import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import color from 'picocolors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  collectWebSocketClientMessages,
  createBinaryMessage,
  expectWebSocketTimesCheckError,
  readBytes,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import { UnhandledMessageStrategy, WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'create'; body: { text: string } } | { type: 'delete'; id: string }>;
type BinarySchema = WebSocketSchema<ArrayBuffer | Blob>;

export function declareTimesWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = { ...getInterceptorOptions(), messageSaving: { enabled: true } };
  });

  async function sendMatchingMessage(client: WebSocketClient<MessageSchema>, text = 'hello') {
    const messagePromise = waitForWebSocketClientMessage(client);

    client.send(JSON.stringify({ type: 'create', body: { text } }));

    await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));
  }

  describe('Exact number of messages', () => {
    it('should intercept an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(1), interceptor);

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 message, but got 0.',
          expectedNumberOfMessages: 1,
        });

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await sendMatchingMessage(client);
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should intercept less than an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(2), interceptor);

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 2 messages, but got 0.',
          expectedNumberOfMessages: 2,
        });

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await sendMatchingMessage(client);
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 2 messages, but got 1.',
          expectedNumberOfMessages: 2,
        });
      });
    });

    it('should not intercept more than an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(1), interceptor);

        await promiseIfRemote(
          interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await sendMatchingMessage(client);
          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          const probeResponse = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'again' } }));

          // Messages on a socket are delivered in order, so the probe response arriving first means that the
          // over-limit message got no response.
          client.send(JSON.stringify({ type: 'delete', id: 'probe' }));

          await expect(probeResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 message, but got 2.',
          expectedNumberOfMessages: 1,
        });
      });
    });
  });

  describe('Range number of messages', () => {
    it('should intercept the minimum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(0, 3), interceptor);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await sendMatchingMessage(client, 'one');
          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          await sendMatchingMessage(client, 'two');
          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        });
      });
    });

    it('should intercept less than the minimum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(2, 3), interceptor);

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected at least 2 and at most 3 messages, but got 0.',
          expectedNumberOfMessages: { min: 2, max: 3 },
        });

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await sendMatchingMessage(client);
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected at least 2 and at most 3 messages, but got 1.',
          expectedNumberOfMessages: { min: 2, max: 3 },
        });
      });
    });

    it('should intercept the maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(2, 3), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await sendMatchingMessage(client, 'one');
          await sendMatchingMessage(client, 'two');
          await sendMatchingMessage(client, 'three');
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should not intercept more than the maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(2, 3), interceptor);

        await promiseIfRemote(
          interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await sendMatchingMessage(client, 'one');
          await sendMatchingMessage(client, 'two');
          await sendMatchingMessage(client, 'three');
          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          const probeResponse = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'four' } }));

          // Messages on a socket are delivered in order, so the probe response arriving first means that the
          // over-limit message got no response.
          client.send(JSON.stringify({ type: 'delete', id: 'probe' }));

          await expect(probeResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected at least 2 and at most 3 messages, but got 4.',
          expectedNumberOfMessages: { min: 2, max: 3 },
        });
      });
    });

    it('should not intercept more than a singular maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(0, 1), interceptor);

        await promiseIfRemote(
          interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await sendMatchingMessage(client, 'one');
          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          const probeResponse = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

          // Messages on a socket are delivered in order, so the probe response arriving first means that the
          // over-limit message got no response.
          client.send(JSON.stringify({ type: 'delete', id: 'probe' }));

          await expect(probeResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected at least 0 and at most 1 message, but got 2.',
          expectedNumberOfMessages: { min: 0, max: 1 },
        });
      });
    });

    it('should intercept the exact number of messages limited in a range where the minimum and maximum are equal', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(1, 1), interceptor);

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 message, but got 0.',
          expectedNumberOfMessages: { min: 1, max: 1 },
        });

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await sendMatchingMessage(client);
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });
  });

  describe('Message distribution', () => {
    it('should distribute messages to the next matching handler when the maximum number of messages is reached and no restrictions are used', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const firstHandler = await promiseIfRemote(
          interceptor.message().respond({ type: 'delete', id: 'first' }).times(1),
          interceptor,
        );
        const secondHandler = await promiseIfRemote(
          interceptor.message().respond({ type: 'delete', id: 'second' }).times(1),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          let messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: 'second' }));

          messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: 'first' }));
        });

        await firstHandler.checkTimes();
        await secondHandler.checkTimes();
        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    it('should distribute messages to the next matching handler when the maximum number of messages is reached and restrictions are used', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const firstMessage: MessageSchema = { type: 'create', body: { text: '1' } };
        const secondMessage: MessageSchema = { type: 'create', body: { text: '2' } };
        const unknownMessage: MessageSchema = { type: 'create', body: { text: 'unknown' } };

        const handlers = [
          await promiseIfRemote(
            interceptor.message().with(firstMessage).respond({ type: 'delete', id: '0' }).times(1),
            interceptor,
          ),
          await promiseIfRemote(
            interceptor.message().with(secondMessage).respond({ type: 'delete', id: '1' }).times(1, 2),
            interceptor,
          ),
          await promiseIfRemote(
            interceptor.message().with(secondMessage).respond({ type: 'delete', id: '2' }).times(2),
            interceptor,
          ),
        ];

        await promiseIfRemote(
          interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' }),
          interceptor,
        );

        const unmatchedMessageLines = [
          '',
          'Messages evaluated by this handler:',
          '',
          `  ${color.green('- Expected')}`,
          `  ${color.red('+ Received')}`,
          '',
          '1: { "type": "create", "body": { "text": "unknown" } }',
          '     Data:',
          `       ${color.green('- { "type": "create", "body": { "text": "2" } }')}`,
          `       ${color.red('+ { "type": "create", "body": { "text": "unknown" } }')}`,
        ];

        await expectWebSocketTimesCheckError(() => handlers[0].checkTimes(), {
          message: 'Expected exactly 1 matching message, but got 0.',
          expectedNumberOfMessages: 1,
        });
        await expectWebSocketTimesCheckError(() => handlers[1].checkTimes(), {
          message: 'Expected at least 1 and at most 2 matching messages, but got 0.',
          expectedNumberOfMessages: { min: 1, max: 2 },
        });
        await expectWebSocketTimesCheckError(() => handlers[2].checkTimes(), {
          message: 'Expected exactly 2 matching messages, but got 0.',
          expectedNumberOfMessages: 2,
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 matching message, but got 0.',
          expectedNumberOfMessages: 1,
        });

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          let messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify(secondMessage));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '2' }));

          expect(handlers[0].messages).toHaveLength(0);
          expect(handlers[1].messages).toHaveLength(0);
          expect(handlers[2].messages).toHaveLength(1);

          await expectWebSocketTimesCheckError(() => handlers[2].checkTimes(), {
            message: 'Expected exactly 2 matching messages, but got 1.',
            expectedNumberOfMessages: 2,
          });

          messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify(firstMessage));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '0' }));

          expect(handlers[0].messages).toHaveLength(1);
          expect(handlers[1].messages).toHaveLength(0);
          expect(handlers[2].messages).toHaveLength(1);

          await handlers[0].checkTimes();

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected at least 1 and at most 2 matching messages, but got 0.',
            expectedNumberOfMessages: { min: 1, max: 2 },
          });

          messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify(unknownMessage));

          // Messages on a socket are delivered in order, so the probe response arriving first means that the unknown
          // message got no response.
          client.send(JSON.stringify({ type: 'delete', id: 'probe' }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));

          expect(handlers[0].messages).toHaveLength(1);
          expect(handlers[1].messages).toHaveLength(0);
          expect(handlers[2].messages).toHaveLength(1);

          await handlers[0].checkTimes();
          await expectWebSocketTimesCheckError(() => handlers[1].checkTimes(), {
            message: ['Expected at least 1 and at most 2 matching messages, but got 0.', ...unmatchedMessageLines].join(
              '\n',
            ),
            expectedNumberOfMessages: { min: 1, max: 2 },
          });
          await expectWebSocketTimesCheckError(() => handlers[2].checkTimes(), {
            message: ['Expected exactly 2 matching messages, but got 1.', ...unmatchedMessageLines].join('\n'),
            expectedNumberOfMessages: 2,
          });

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: ['Expected at least 1 and at most 2 matching messages, but got 0.', ...unmatchedMessageLines].join(
              '\n',
            ),
            expectedNumberOfMessages: { min: 1, max: 2 },
          });

          messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify(secondMessage));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '2' }));

          expect(handlers[2].messages).toHaveLength(2);

          await handlers[2].checkTimes();

          messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify(secondMessage));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));

          expect(handlers[0].messages).toHaveLength(1);
          expect(handlers[1].messages).toHaveLength(1);
          expect(handlers[2].messages).toHaveLength(2);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify(secondMessage));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));

          expect(handlers[1].messages).toHaveLength(2);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify(secondMessage));

          // Messages on a socket are delivered in order, so the probe response arriving first means that the
          // over-limit message got no response.
          client.send(JSON.stringify({ type: 'delete', id: 'probe' }));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));

          expect(handlers[0].messages).toHaveLength(1);
          expect(handlers[1].messages).toHaveLength(2);
          expect(handlers[2].messages).toHaveLength(2);
        });

        await handlers[0].checkTimes();
        await handlers[1].checkTimes();
        await expectWebSocketTimesCheckError(() => handlers[2].checkTimes(), {
          message: ['Expected exactly 2 matching messages, but got 3.', ...unmatchedMessageLines].join('\n'),
          expectedNumberOfMessages: 2,
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: ['Expected exactly 2 matching messages, but got 3.', ...unmatchedMessageLines].join('\n'),
          expectedNumberOfMessages: 2,
        });
      });
    });

    it('should distribute messages to a matching handler of another interceptor when the maximum number of messages is reached', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (olderInterceptor) => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().respond({ type: 'delete', id: 'newer-interceptor' }),
            interceptor,
          );

          const olderHandler = await promiseIfRemote(
            olderInterceptor.message().respond({ type: 'delete', id: 'older-interceptor' }).times(1),
            olderInterceptor,
          );

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            let messagePromise = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));
            await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: 'older-interceptor' }));

            expect(olderHandler.messages).toHaveLength(1);
            expect(handler.messages).toHaveLength(0);

            messagePromise = waitForWebSocketClientMessage(client);
            client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));
            await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: 'newer-interceptor' }));

            expect(olderHandler.messages).toHaveLength(1);
            expect(handler.messages).toHaveLength(1);
          });

          await promiseIfRemote(olderInterceptor.checkTimes(), olderInterceptor);
        });
      });
    });

    it('should distribute concurrent messages to the next matching handler when the maximum number of messages is reached', async () => {
      const concurrentMessageCount = 2;
      const allMessagesMatchingPromise = createPromiseWithResolvers<void>();

      const restriction = vi.fn(async () => {
        if (restriction.mock.calls.length === concurrentMessageCount) {
          allMessagesMatchingPromise.resolve();
        }

        await allMessagesMatchingPromise;
        return true;
      });

      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const fallbackHandler = await promiseIfRemote(
          interceptor.message().respond({ type: 'delete', id: 'fallback' }),
          interceptor,
        );

        const limitedHandler = await promiseIfRemote(
          interceptor.message().with(restriction).respond({ type: 'delete', id: 'limited' }).times(1),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const receivedMessages = collectWebSocketClientMessages(client);

          for (let index = 0; index < concurrentMessageCount; index++) {
            client.send(JSON.stringify({ type: 'create', body: { text: `${index}` } }));
          }

          await waitFor(() => {
            expect(receivedMessages).toHaveLength(concurrentMessageCount);
          });

          expect(receivedMessages.toSorted()).toEqual([
            JSON.stringify({ type: 'delete', id: 'fallback' }),
            JSON.stringify({ type: 'delete', id: 'limited' }),
          ]);
        });

        expect(restriction).toHaveBeenCalledTimes(concurrentMessageCount);
        expect(limitedHandler.messages).toHaveLength(1);
        expect(fallbackHandler.messages).toHaveLength(1);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });
  });

  describe('Unmatched messages', () => {
    it('should not consider messages unmatched due to restrictions in times checks', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(
          interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: '1' }).times(1),
          interceptor,
        );

        await promiseIfRemote(
          interceptor
            .message()
            .with({ type: 'create', body: { text: 'probe' } })
            .respond({ type: 'delete', id: 'probe' }),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const probeResponse = waitForWebSocketClientMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          // Messages on a socket are delivered in order, so the probe response arriving first means that the unmatched
          // message got no response.
          client.send(JSON.stringify({ type: 'create', body: { text: 'probe' } }));

          await expect(probeResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));

          await waitFor(async () => {
            await expect(async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            }).rejects.toThrow('1: { "type": "create", "body": { "text": "hello" } }');
          });
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: [
            'Expected exactly 1 matching message, but got 0.',
            '',
            'Messages evaluated by this handler:',
            '',
            `  ${color.green('- Expected')}`,
            `  ${color.red('+ Received')}`,
            '',
            '1: { "type": "create", "body": { "text": "hello" } }',
            '     Data:',
            `       ${color.green('- { "type": "delete" }')}`,
            `       ${color.red('+ { "type": "create", "body": { "text": "hello" } }')}`,
          ].join('\n'),
          expectedNumberOfMessages: 1,
        });
      });
    });

    it('should not consider binary messages unmatched due to restrictions in times checks', async () => {
      await usingWebSocketInterceptor<BinarySchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(
          interceptor.message().with(createBinaryMessage(1, 2)).respond(createBinaryMessage(5, 6)).times(1),
          interceptor,
        );

        await promiseIfRemote(
          interceptor.message().with(createBinaryMessage(9, 9)).respond(createBinaryMessage(9, 0)),
          interceptor,
        );

        await usingWebSocketClient<BinarySchema>(baseURL, async (client) => {
          const probeResponse = waitForWebSocketClientMessage(client);

          client.send(createBinaryMessage(3, 4));
          client.send(new Blob([createBinaryMessage(7, 8)]));

          // Messages on a socket are delivered in order, so the probe response arriving first means that the unmatched
          // messages got no response.
          client.send(createBinaryMessage(9, 9));

          expect(await readBytes(await probeResponse)).toEqual([9, 0]);

          await waitFor(async () => {
            await expect(async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            }).rejects.toThrow('2: ArrayBuffer { byteLength: 2 }');
          });
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: [
            'Expected exactly 1 matching message, but got 0.',
            '',
            'Messages evaluated by this handler:',
            '',
            `  ${color.green('- Expected')}`,
            `  ${color.red('+ Received')}`,
            '',
            '1: ArrayBuffer { byteLength: 2 }',
            '     Data:',
            `       ${color.green('- ArrayBuffer { byteLength: 2 }')}`,
            `       ${color.red('+ ArrayBuffer { byteLength: 2 }')}`,
            '',
            '2: ArrayBuffer { byteLength: 2 }',
            '     Data:',
            `       ${color.green('- ArrayBuffer { byteLength: 2 }')}`,
            `       ${color.red('+ ArrayBuffer { byteLength: 2 }')}`,
          ].join('\n'),
          expectedNumberOfMessages: 1,
        });
      });
    });

    // Unlike HTTP requests, a message needs no reply, so a handler without actions still matches.
    it('should not consider messages unmatched due to missing response declarations in times checks', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().times(1), interceptor);

        expect(handler.messages).toHaveLength(0);

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 message, but got 0.',
          expectedNumberOfMessages: 1,
        });

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'create', body: { text: 'one' } }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

          await waitFor(async () => {
            await expect(async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            }).rejects.toThrow('Expected exactly 1 message, but got 2.');
          });
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 message, but got 2.',
          expectedNumberOfMessages: 1,
        });
      });
    });

    it('should not consider messages with restrictions unmatched due to missing response declarations in times checks', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().with({ type: 'delete' }).times(1), interceptor);

        expect(handler.messages).toHaveLength(0);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));

          await waitFor(async () => {
            await expect(async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            }).rejects.toThrow('Messages evaluated by this handler:');
          });

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: [
              'Expected exactly 1 matching message, but got 0.',
              '',
              'Messages evaluated by this handler:',
              '',
              `  ${color.green('- Expected')}`,
              `  ${color.red('+ Received')}`,
              '',
              '1: { "type": "create", "body": { "text": "other" } }',
              '     Data:',
              `       ${color.green('- { "type": "delete" }')}`,
              `       ${color.red('+ { "type": "create", "body": { "text": "other" } }')}`,
            ].join('\n'),
            expectedNumberOfMessages: 1,
          });

          expect(handler.messages).toHaveLength(0);

          client.send(JSON.stringify({ type: 'delete', id: '1' }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        });
      });
    });

    it('should not consider messages unmatched due to missing response declarations when no messages are expected in times checks', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().times(0), interceptor);

        expect(handler.messages).toHaveLength(0);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(async () => {
            await expect(async () => {
              await promiseIfRemote(interceptor.checkTimes(), interceptor);
            }).rejects.toThrow('Expected exactly 0 messages, but got 1.');
          });
        });

        expect(handler.messages).toHaveLength(0);

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 0 messages, but got 1.',
          expectedNumberOfMessages: 0,
        });
      });
    });

    it('should consider messages unmatched by cleared handlers instead of older handlers in times checks', async () => {
      const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: false }));

      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, onUnhandledMessage },
        async (interceptor) => {
          await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(0), interceptor);
          const handler = await promiseIfRemote(interceptor.message().times(1), interceptor);

          await promiseIfRemote(handler.clear(), interceptor);

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitFor(() => {
              expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
            });
          });

          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        },
      );
    });

    // No WebSocket counterpart for "should not consider requests unmatched due to unmocked path in times checks":
    // WebSocket handlers have no per-handler path.

    it('should not consider messages handled by another interceptor unmatched in times checks', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (olderInterceptor) => {
        const olderHandler = await promiseIfRemote(
          olderInterceptor.message().respond({ type: 'delete', id: '1' }),
          olderInterceptor,
        );

        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: '2' }).times(1),
            interceptor,
          );

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            await sendMatchingMessage(client);
          });

          expect(handler.messages).toHaveLength(0);
          expect(olderHandler.messages).toHaveLength(1);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected exactly 1 matching message, but got 0.',
            expectedNumberOfMessages: 1,
          });
        });
      });
    });
  });

  it('should reset message counts when cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(1), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        await sendMatchingMessage(client);
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);

      await interceptor.clear();
      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  // Remote-only: local `checkTimes()` throws synchronously, so it has no returned promise to await later.
  if (type === 'remote') {
    it('should check times when called, before the returned promise is awaited', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const handler = await interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

        const timesCheckPromise = interceptor.checkTimes();
        await handler.times(0);

        await expectWebSocketTimesCheckError(() => timesCheckPromise, {
          message: 'Expected exactly 1 message, but got 0.',
          expectedNumberOfMessages: 1,
        });
      });
    });
  }
}
