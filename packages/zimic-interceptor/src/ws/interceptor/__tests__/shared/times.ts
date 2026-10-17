import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import { usingWebSocketClient, waitForWebSocketClientMessage } from '@tests/utils/webSocket';

import { createBinaryMessage, expectWebSocketTimesCheckError } from '../../../messageHandler/__tests__/shared/utils';
import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'create'; body: { text: string } } | { type: 'delete'; id: string }>;
type BinarySchema = WebSocketSchema<ArrayBuffer | Blob>;

export function declareTimesWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  async function sendMatchingMessage(client: WebSocketClient<MessageSchema>, text = 'hello') {
    const messagePromise = waitForWebSocketClientMessage(client);

    client.send(JSON.stringify({ type: 'create', body: { text } }));

    await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));
  }

  describe('Exact number of messages', () => {
    it('should limit effects under concurrency while counting all matching messages', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        const restrictionStarted: MessageSchema[] = [];
        const finishRestrictions: (() => void)[] = [];
        const effect = vi.fn();

        await promiseIfRemote(
          interceptor
            .message()
            .with(async (message) => {
              restrictionStarted.push(message);
              await new Promise<void>((resolve) => {
                finishRestrictions.push(resolve);
              });
              return true;
            })
            .effect(effect)
            .times(1),
          interceptor,
        );

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'create', body: { text: 'first' } }));
          client.send(JSON.stringify({ type: 'create', body: { text: 'second' } }));

          await waitFor(() => {
            expect(restrictionStarted).toHaveLength(2);
          });

          for (const finish of finishRestrictions) {
            finish();
          }

          await waitFor(() => {
            expect(effect).toHaveBeenCalledTimes(1);
          });
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 matching message, but got 2.',
          expectedNumberOfMessages: 1,
        });
      });
    });

    it('should match an exact number of limited messages', async () => {
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

    it('should match less than an exact number of limited messages', async () => {
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

    it('should not match more than an exact number of limited messages', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(1), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await sendMatchingMessage(client);
          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          const messageListener = vi.fn();
          client.addEventListener('message', messageListener);

          client.send(JSON.stringify({ type: 'create', body: { text: 'again' } }));

          await waitForNot(() => {
            expect(messageListener).toHaveBeenCalled();
          });
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 1 message, but got 2.',
          expectedNumberOfMessages: 1,
        });
      });
    });

    it('should match exactly zero messages', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(0), interceptor);

        await promiseIfRemote(interceptor.checkTimes(), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          const messageListener = vi.fn();
          client.addEventListener('message', messageListener);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitForNot(() => {
            expect(messageListener).toHaveBeenCalled();
          });
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected exactly 0 messages, but got 1.',
          expectedNumberOfMessages: 0,
        });
      });
    });
  });

  describe('Range number of messages', () => {
    it('should match the minimum number of messages limited in a range', async () => {
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

    it('should match less than the minimum number of messages limited in a range', async () => {
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

    it('should match the maximum number of messages limited in a range', async () => {
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

    it('should not match more than the maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(2, 3), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await sendMatchingMessage(client, 'one');
          await sendMatchingMessage(client, 'two');
          await sendMatchingMessage(client, 'three');
          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          const messageListener = vi.fn();
          client.addEventListener('message', messageListener);

          client.send(JSON.stringify({ type: 'create', body: { text: 'four' } }));

          await waitForNot(() => {
            expect(messageListener).toHaveBeenCalled();
          });
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected at least 2 and at most 3 messages, but got 4.',
          expectedNumberOfMessages: { min: 2, max: 3 },
        });
      });
    });

    it('should not match more than a singular maximum number of messages limited in a range', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }).times(0, 1), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
          await sendMatchingMessage(client, 'one');
          await promiseIfRemote(interceptor.checkTimes(), interceptor);

          const messageListener = vi.fn();
          client.addEventListener('message', messageListener);

          client.send(JSON.stringify({ type: 'create', body: { text: 'two' } }));

          await waitForNot(() => {
            expect(messageListener).toHaveBeenCalled();
          });
        });

        await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
          message: 'Expected at least 0 and at most 1 message, but got 2.',
          expectedNumberOfMessages: { min: 0, max: 1 },
        });
      });
    });

    it('should match the exact number of messages limited in a unitary range', async () => {
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
  });

  describe('Unmatched messages', () => {
    it('should report messages unmatched due to restrictions in times checks when message saving is enabled', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true } },
        async (interceptor) => {
          await promiseIfRemote(
            interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: '1' }).times(1),
            interceptor,
          );

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            const messageListener = vi.fn();
            client.addEventListener('message', messageListener);

            client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

            await waitForNot(() => {
              expect(messageListener).toHaveBeenCalled();
            });
          });

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
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

    it('should report binary messages unmatched due to restrictions in times checks when message saving is enabled', async () => {
      await usingWebSocketInterceptor<BinarySchema>(
        { ...interceptorOptions, messageSaving: { enabled: true } },
        async (interceptor) => {
          await promiseIfRemote(
            interceptor.message().with(createBinaryMessage(1, 2)).respond(createBinaryMessage(5, 6)).times(1),
            interceptor,
          );

          await usingWebSocketClient<BinarySchema>(baseURL, async (client) => {
            const messageListener = vi.fn();
            client.addEventListener('message', messageListener);

            client.send(createBinaryMessage(3, 4));
            client.send(new Blob([createBinaryMessage(7, 8)]));

            await waitForNot(() => {
              expect(messageListener).toHaveBeenCalled();
            });
          });

          await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
            message: 'Expected exactly 1 matching message, but got 0.',
            expectedNumberOfMessages: 1,
            unmatchedMessages: [
              '- { "message": ArrayBuffer { byteLength: 2 }, "diff": { "data": { ' +
                '"expected": ArrayBuffer { byteLength: 2 }, ' +
                '"received": ArrayBuffer { byteLength: 2 } } } }',

              // Remote interceptors receive Blobs from the interceptor server as ArrayBuffers.
              type === 'remote'
                ? '- { "message": ArrayBuffer { byteLength: 2 }, "diff": { "data": { ' +
                  '"expected": ArrayBuffer { byteLength: 2 }, ' +
                  '"received": ArrayBuffer { byteLength: 2 } } } }'
                : '- { "message": Blob { type: \'\', size: 2 }, "diff": { "data": { ' +
                  '"expected": ArrayBuffer { byteLength: 2 }, ' +
                  '"received": Blob { type: \'\', size: 2 } } } }',
            ].join('\n'),
          });
        },
      );
    });

    it('should count messages matching handlers without actions in times checks', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true } },
        async (interceptor) => {
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
        },
      );
    });

    it('should count messages matching handlers with restrictions and without actions in times checks', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await promiseIfRemote(interceptor.message().with({ type: 'delete' }).times(1), interceptor);

          expect(handler.messages).toHaveLength(0);

          await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
            client.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));

            await waitFor(async () => {
              await expect(async () => {
                await promiseIfRemote(interceptor.checkTimes(), interceptor);
              }).rejects.toThrow('Unmatched messages:');
            });

            await expectWebSocketTimesCheckError(() => promiseIfRemote(interceptor.checkTimes(), interceptor), {
              message: 'Expected exactly 1 matching message, but got 0.',
              expectedNumberOfMessages: 1,
              unmatchedMessages:
                '- { "message": { "type": "create", "body": { "text": "other" } }, ' +
                '"diff": { "data": { "expected": { "type": "delete" }, ' +
                '"received": { "type": "create", "body": { "text": "other" } } } } }',
            });

            expect(handler.messages).toHaveLength(0);

            client.send(JSON.stringify({ type: 'delete', id: '1' }));

            await waitFor(() => {
              expect(handler.messages).toHaveLength(1);
            });

            await promiseIfRemote(interceptor.checkTimes(), interceptor);
          });
        },
      );
    });

    it('should count messages matching handlers without actions when no messages are expected in times checks', async () => {
      await usingWebSocketInterceptor<MessageSchema>(
        { ...interceptorOptions, messageSaving: { enabled: true } },
        async (interceptor) => {
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
        },
      );
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
