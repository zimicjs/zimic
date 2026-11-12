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
  expectWebSocketConnectionToBeRefused,
  expectWebSocketConnectionToOpen,
  expectWebSocketTimesCheckError,
  openWebSocketUntilSettled,
  readBytes,
  REFUSED_WEB_SOCKET_EVENT_TYPES,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import { UnhandledMessageStrategy, WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type Message = { type: 'create'; body: { text: string } } | { type: 'delete'; id: string };

type MessageSchema = WebSocketSchema<{
  '/': {
    connection: { protocols: 'legacy' | 'first' | 'second' };
    message: Message;
  };
  '/users': {
    connection: { searchParams: { value?: string } };
    message: Message;
  };
}>;

type BinarySchema = WebSocketSchema<{
  '/': {
    message: ArrayBuffer | Blob;
  };
}>;

export function declareTimesWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = {
      ...getInterceptorOptions(),
      messageSaving: { enabled: true },
      connectionSaving: { enabled: true },
    };
  });

  async function sendMatchingMessage(client: WebSocketClient<MessageSchema, '/'>, text = 'hello') {
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
          expectedNumberOfMatches: 1,
        });

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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
          expectedNumberOfMatches: 2,
        });

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
          await sendMatchingMessage(client);
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 2 messages, but got 1.',
          expectedNumberOfMatches: 2,
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

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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
          expectedNumberOfMatches: 1,
        });
      });
    });
  });

  describe('Range number of messages', () => {
    it('should intercept the minimum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(0, 3), interceptor);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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
          expectedNumberOfMatches: { min: 2, max: 3 },
        });

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
          await sendMatchingMessage(client);
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected at least 2 and at most 3 messages, but got 1.',
          expectedNumberOfMatches: { min: 2, max: 3 },
        });
      });
    });

    it('should intercept the maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(2, 3), interceptor);

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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
          expectedNumberOfMatches: { min: 2, max: 3 },
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

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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
          expectedNumberOfMatches: { min: 0, max: 1 },
        });
      });
    });

    it('should intercept the exact number of messages limited in a range where the minimum and maximum are equal', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(1, 1), interceptor);

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 message, but got 0.',
          expectedNumberOfMatches: { min: 1, max: 1 },
        });

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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
        const firstMessage: Message = { type: 'create', body: { text: '1' } };
        const secondMessage: Message = { type: 'create', body: { text: '2' } };
        const unknownMessage: Message = { type: 'create', body: { text: 'unknown' } };

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
          expectedNumberOfMatches: 1,
        });
        await expectWebSocketTimesCheckError(() => handlers[1].checkTimes(), {
          message: 'Expected at least 1 and at most 2 matching messages, but got 0.',
          expectedNumberOfMatches: { min: 1, max: 2 },
        });
        await expectWebSocketTimesCheckError(() => handlers[2].checkTimes(), {
          message: 'Expected exactly 2 matching messages, but got 0.',
          expectedNumberOfMatches: 2,
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 matching message, but got 0.',
          expectedNumberOfMatches: 1,
        });

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
          let messagePromise = waitForWebSocketClientMessage(client);
          client.send(JSON.stringify(secondMessage));
          await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '2' }));

          expect(handlers[0].messages).toHaveLength(0);
          expect(handlers[1].messages).toHaveLength(0);
          expect(handlers[2].messages).toHaveLength(1);

          await expectWebSocketTimesCheckError(() => handlers[2].checkTimes(), {
            message: 'Expected exactly 2 matching messages, but got 1.',
            expectedNumberOfMatches: 2,
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
            expectedNumberOfMatches: { min: 1, max: 2 },
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
            expectedNumberOfMatches: { min: 1, max: 2 },
          });
          await expectWebSocketTimesCheckError(() => handlers[2].checkTimes(), {
            message: ['Expected exactly 2 matching messages, but got 1.', ...unmatchedMessageLines].join('\n'),
            expectedNumberOfMatches: 2,
          });

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: ['Expected at least 1 and at most 2 matching messages, but got 0.', ...unmatchedMessageLines].join(
              '\n',
            ),
            expectedNumberOfMatches: { min: 1, max: 2 },
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
          expectedNumberOfMatches: 2,
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: ['Expected exactly 2 matching messages, but got 3.', ...unmatchedMessageLines].join('\n'),
          expectedNumberOfMatches: 2,
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

          await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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
          expectedNumberOfMatches: 1,
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
          expectedNumberOfMatches: 1,
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
          expectedNumberOfMatches: 1,
        });

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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
          expectedNumberOfMatches: 1,
        });
      });
    });

    it('should not consider messages with restrictions unmatched due to missing response declarations in times checks', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().with({ type: 'delete' }).times(1), interceptor);

        expect(handler.messages).toHaveLength(0);

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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
            expectedNumberOfMatches: 1,
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

        await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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
          expectedNumberOfMatches: 0,
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

          await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitFor(() => {
              expect(onUnhandledMessage).toHaveBeenCalledTimes(1);
            });
          });

          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        },
      );
    });

    // No WebSocket message counterpart for "should not consider requests unmatched due to unmocked path in times checks":
    // message handlers have no per-handler paths.

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

          await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
            await sendMatchingMessage(client);
          });

          expect(handler.messages).toHaveLength(0);
          expect(olderHandler.messages).toHaveLength(1);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected exactly 1 matching message, but got 0.',
            expectedNumberOfMatches: 1,
          });
        });
      });
    });
  });

  it('should reset message counts when cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(1), interceptor);

      await usingWebSocketClient<MessageSchema, '/'>(baseURL, async (client) => {
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
          expectedNumberOfMatches: 1,
        });
      });
    });
  }

  describe('Connections', () => {
    describe('Exact number of connections', () => {
      it('should intercept an exact number of limited connections', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }).times(1), interceptor);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected exactly 1 connection, but got 0.',
            expectedNumberOfMatches: 1,
          });

          await expectWebSocketConnectionToBeRefused(baseURL);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        });
      });

      it('should intercept less than an exact number of limited connections', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }).times(2), interceptor);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected exactly 2 connections, but got 0.',
            expectedNumberOfMatches: 2,
          });

          await expectWebSocketConnectionToBeRefused(baseURL);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected exactly 2 connections, but got 1.',
            expectedNumberOfMatches: 2,
          });
        });
      });

      it('should not intercept more than an exact number of limited connections', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }).times(1), interceptor);

          await expectWebSocketConnectionToBeRefused(baseURL);
          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          // A connection no handler decides is accepted, so the handler did not reject the over-limit connection.
          await expectWebSocketConnectionToOpen(baseURL);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected exactly 1 connection, but got 2.',
            expectedNumberOfMatches: 1,
          });
        });
      });
    });

    describe('Range number of connections', () => {
      it('should intercept the minimum number of connections limited in a range', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }).times(0, 3), interceptor);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          await expectWebSocketConnectionToBeRefused(baseURL);
          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          await expectWebSocketConnectionToBeRefused(baseURL);
          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        });
      });

      it('should intercept less than the minimum number of connections limited in a range', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }).times(2, 3), interceptor);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected at least 2 and at most 3 connections, but got 0.',
            expectedNumberOfMatches: { min: 2, max: 3 },
          });

          await expectWebSocketConnectionToBeRefused(baseURL);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected at least 2 and at most 3 connections, but got 1.',
            expectedNumberOfMatches: { min: 2, max: 3 },
          });
        });
      });

      it('should intercept the maximum number of connections limited in a range', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }).times(2, 3), interceptor);

          await expectWebSocketConnectionToBeRefused(baseURL);
          await expectWebSocketConnectionToBeRefused(baseURL);
          await expectWebSocketConnectionToBeRefused(baseURL);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        });
      });

      it('should not intercept more than the maximum number of connections limited in a range', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }).times(2, 3), interceptor);

          await expectWebSocketConnectionToBeRefused(baseURL);
          await expectWebSocketConnectionToBeRefused(baseURL);
          await expectWebSocketConnectionToBeRefused(baseURL);
          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          // A connection no handler decides is accepted, so the handler did not reject the over-limit connection.
          await expectWebSocketConnectionToOpen(baseURL);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected at least 2 and at most 3 connections, but got 4.',
            expectedNumberOfMatches: { min: 2, max: 3 },
          });
        });
      });

      it('should not intercept more than a singular maximum number of connections limited in a range', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }).times(0, 1), interceptor);

          await expectWebSocketConnectionToBeRefused(baseURL);
          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          // A connection no handler decides is accepted, so the handler did not reject the over-limit connection.
          await expectWebSocketConnectionToOpen(baseURL);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected at least 0 and at most 1 connection, but got 2.',
            expectedNumberOfMatches: { min: 0, max: 1 },
          });
        });
      });

      it('should intercept the exact number of connections limited in a range where the minimum and maximum are equal', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }).times(1, 1), interceptor);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected exactly 1 connection, but got 0.',
            expectedNumberOfMatches: { min: 1, max: 1 },
          });

          await expectWebSocketConnectionToBeRefused(baseURL);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        });
      });
    });

    it('should count accepted and rejected connections in interceptor times checks', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.connection().times(1), interceptor);
        await promiseIfRemote(
          interceptor
            .connection()
            .with({ protocols: ['legacy'] })
            .respond({ action: 'reject' })
            .times(1),
          interceptor,
        );

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 connection, but got 0.',
          expectedNumberOfMatches: 1,
        });

        await expectWebSocketConnectionToOpen(baseURL);
        await expectWebSocketConnectionToBeRefused(baseURL, ['legacy']);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });

    describe('Connection distribution', () => {
      it('should distribute connections to the next matching handler when the maximum number of connections is reached and no restrictions are used', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          const olderHandler = await promiseIfRemote(interceptor.connection().times(1), interceptor);
          const newerHandler = await promiseIfRemote(
            interceptor.connection().respond({ action: 'reject' }).times(1),
            interceptor,
          );

          await expectWebSocketConnectionToBeRefused(baseURL);
          await expectWebSocketConnectionToOpen(baseURL);

          expect(newerHandler.connections).toHaveLength(1);
          expect(olderHandler.connections).toHaveLength(1);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        });
      });

      it('should distribute connections to the next matching handler when the maximum number of connections is reached and restrictions are used', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          const handlers = [
            await promiseIfRemote(
              interceptor
                .connection()
                .with({ protocols: ['first'] })
                .respond({ action: 'reject' })
                .times(1),
              interceptor,
            ),
            await promiseIfRemote(
              interceptor
                .connection()
                .with({ protocols: ['second'] })
                .respond({ action: 'reject' })
                .times(1, 2),
              interceptor,
            ),
            await promiseIfRemote(
              interceptor
                .connection()
                .with({ protocols: ['second'] })
                .respond({ action: 'reject' })
                .times(2),
              interceptor,
            ),
          ];

          function expectConnectionCounts(expectedCounts: number[]) {
            expect(handlers.map((handler) => handler.connections.length)).toEqual(expectedCounts);
          }

          await expectWebSocketConnectionToBeRefused(baseURL, ['second']);
          expectConnectionCounts([0, 0, 1]);

          await expectWebSocketTimesCheckError(() => handlers[2].checkTimes(), {
            message: 'Expected exactly 2 matching connections, but got 1.',
            expectedNumberOfMatches: 2,
          });

          await expectWebSocketConnectionToBeRefused(baseURL, ['first']);
          expectConnectionCounts([1, 0, 1]);

          await handlers[0].checkTimes();

          const { socket } = await openWebSocketUntilSettled(baseURL, ['unknown']);
          socket.close();
          expectConnectionCounts([1, 0, 1]);

          const unmatchedConnectionLines = [
            '',
            'Connections evaluated by this handler:',
            '',
            `  ${color.green('- Expected')}`,
            `  ${color.red('+ Received')}`,
            '',
            `1: ${socket.url}`,
            '     Protocols:',
            `       ${color.green('- [ "second" ]')}`,
            `       ${color.red('+ [ "unknown" ]')}`,
          ];

          await handlers[0].checkTimes();
          await expectWebSocketTimesCheckError(() => handlers[1].checkTimes(), {
            message: [
              'Expected at least 1 and at most 2 matching connections, but got 0.',
              ...unmatchedConnectionLines,
            ].join('\n'),
            expectedNumberOfMatches: { min: 1, max: 2 },
          });
          await expectWebSocketTimesCheckError(() => handlers[2].checkTimes(), {
            message: ['Expected exactly 2 matching connections, but got 1.', ...unmatchedConnectionLines].join('\n'),
            expectedNumberOfMatches: 2,
          });

          await expectWebSocketConnectionToBeRefused(baseURL, ['second']);
          expectConnectionCounts([1, 0, 2]);

          await handlers[2].checkTimes();

          await expectWebSocketConnectionToBeRefused(baseURL, ['second']);
          expectConnectionCounts([1, 1, 2]);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          await expectWebSocketConnectionToBeRefused(baseURL, ['second']);
          expectConnectionCounts([1, 2, 2]);

          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          // A connection no handler decides is accepted, so no handler rejected the over-limit connection.
          await expectWebSocketConnectionToOpen(baseURL, ['second']);
          expectConnectionCounts([1, 2, 2]);

          await handlers[0].checkTimes();
          await handlers[1].checkTimes();
          await expectWebSocketTimesCheckError(() => handlers[2].checkTimes(), {
            message: ['Expected exactly 2 matching connections, but got 3.', ...unmatchedConnectionLines].join('\n'),
            expectedNumberOfMatches: 2,
          });

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: ['Expected exactly 2 matching connections, but got 3.', ...unmatchedConnectionLines].join('\n'),
            expectedNumberOfMatches: 2,
          });
        });
      });

      it('should distribute connections to a matching handler of another interceptor when the maximum number of connections is reached', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (olderInterceptor) => {
          await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
            const handler = await promiseIfRemote(interceptor.connection().respond({ action: 'accept' }), interceptor);

            const olderHandler = await promiseIfRemote(
              olderInterceptor.connection().respond({ action: 'reject' }).times(1),
              olderInterceptor,
            );

            await expectWebSocketConnectionToBeRefused(baseURL);

            expect(olderHandler.connections).toHaveLength(1);
            expect(handler.connections).toHaveLength(0);

            await expectWebSocketConnectionToOpen(baseURL);

            expect(olderHandler.connections).toHaveLength(1);
            expect(handler.connections).toHaveLength(1);

            await promiseIfRemote(olderInterceptor.checkTimes(), olderInterceptor);
          });
        });
      });

      // Browsers open one connection to a host at a time, so a remote handshake waits for the previous one to be decided
      // and two connections are never matched concurrently. Local connections never reach the network.
      if (!(platform === 'browser' && type === 'remote')) {
        it('should distribute concurrent connections to the next matching handler when the maximum number of connections is reached', async () => {
          const concurrentConnectionCount = 2;
          const allConnectionsMatchingPromise = createPromiseWithResolvers<void>();

          const restriction = vi.fn(async () => {
            if (restriction.mock.calls.length === concurrentConnectionCount) {
              allConnectionsMatchingPromise.resolve();
            }

            await allConnectionsMatchingPromise;
            return true;
          });

          await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
            const fallbackHandler = await promiseIfRemote(
              interceptor.connection().respond({ action: 'accept' }),
              interceptor,
            );

            const limitedHandler = await promiseIfRemote(
              interceptor.connection().with(restriction).respond({ action: 'reject' }).times(1),
              interceptor,
            );

            const attempts = await Promise.all(
              Array.from({ length: concurrentConnectionCount }, () => openWebSocketUntilSettled(baseURL)),
            );

            for (const { socket } of attempts) {
              socket.close();
            }

            expect(attempts.map(({ eventTypes }) => eventTypes)).toEqual(
              expect.arrayContaining([['open'], REFUSED_WEB_SOCKET_EVENT_TYPES]),
            );

            expect(restriction).toHaveBeenCalledTimes(concurrentConnectionCount);
            expect(limitedHandler.connections).toHaveLength(1);
            expect(fallbackHandler.connections).toHaveLength(1);

            await promiseIfRemote(interceptor.checkTimes(), interceptor);
          });
        });
      }
    });

    describe('Unmatched connections', () => {
      it('should not consider connections unmatched due to restrictions in times checks', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor
              .connection()
              .with({ protocols: ['legacy'] })
              .respond({ action: 'reject' })
              .times(1),
            interceptor,
          );

          expect(handler.connections).toHaveLength(0);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected exactly 1 matching connection, but got 0.',
            expectedNumberOfMatches: 1,
          });

          const { socket, eventTypes } = await openWebSocketUntilSettled(baseURL, ['chat']);
          socket.close();

          expect(eventTypes).toEqual(['open']);
          expect(handler.connections).toHaveLength(0);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: [
              'Expected exactly 1 matching connection, but got 0.',
              '',
              'Connections evaluated by this handler:',
              '',
              `  ${color.green('- Expected')}`,
              `  ${color.red('+ Received')}`,
              '',
              `1: ${socket.url}`,
              '     Protocols:',
              `       ${color.green('- [ "legacy" ]')}`,
              `       ${color.red('+ [ "chat" ]')}`,
            ].join('\n'),
            expectedNumberOfMatches: 1,
          });
        });
      });

      // No WebSocket counterpart for "should consider requests unmatched due to missing response declarations in times checks":
      // a handshake needs no declared response, so a connection handler without one matches and accepts the connection.

      // No WebSocket counterpart for "should consider requests with restrictions unmatched due to missing response declarations in times checks":
      // a handshake needs no declared response, so a connection handler without one matches and accepts the connection.

      // No WebSocket counterpart for "should consider requests unmatched due to missing response declarations when no requests are expected in times checks":
      // a handshake needs no declared response, so a connection handler without one matches and accepts the connection.

      it('should consider connections unmatched by cleared handlers instead of older handlers in times checks', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }).times(0), interceptor);
          const handler = await promiseIfRemote(interceptor.connection().times(1), interceptor);

          await promiseIfRemote(handler.clear(), interceptor);

          const { socket } = await openWebSocketUntilSettled(baseURL);
          socket.close();

          await promiseIfRemote(interceptor.checkTimes(), interceptor);
        });
      });

      it('should not consider connections unmatched due to unmocked path in times checks', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor
              .connection('/users')
              .with({ searchParams: { value: '1' } })
              .respond({ action: 'reject' })
              .times(1),
            interceptor,
          );

          expect(handler.connections).toHaveLength(0);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected exactly 1 matching connection, but got 0.',
            expectedNumberOfMatches: 1,
          });

          await expectWebSocketConnectionToOpen(`${baseURL}/users/other`);

          expect(handler.connections).toHaveLength(0);

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected exactly 1 matching connection, but got 0.',
            expectedNumberOfMatches: 1,
          });
        });
      });

      it('should not consider connections handled by another interceptor unmatched in times checks', async () => {
        await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (olderInterceptor) => {
          const olderHandler = await promiseIfRemote(
            olderInterceptor.connection().respond({ action: 'accept' }),
            olderInterceptor,
          );

          await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
            const handler = await promiseIfRemote(
              interceptor
                .connection()
                .with({ protocols: ['legacy'] })
                .respond({ action: 'reject' })
                .times(1),
              interceptor,
            );

            await expectWebSocketConnectionToOpen(baseURL);

            expect(handler.connections).toHaveLength(0);
            expect(olderHandler.connections).toHaveLength(1);

            await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
              message: 'Expected exactly 1 matching connection, but got 0.',
              expectedNumberOfMatches: 1,
            });
          });
        });
      });
    });

    it('should reset connection counts when cleared', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.connection().respond({ action: 'reject' }).times(1), interceptor);

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 connection, but got 0.',
          expectedNumberOfMatches: 1,
        });

        await interceptor.clear();

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      });
    });
  });
}
