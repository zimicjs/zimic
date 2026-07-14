import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorOptions } from '../../types/options';
import {
  RuntimeSharedWebSocketInterceptorTestsOptions,
  expectWebSocketTimesCheckError,
  usingWebSocketClient,
  waitForWebSocketMessage,
} from './utils';

type MessageSchema = WebSocketSchema<{ type: 'create'; body: { text: string } } | { type: 'delete'; id: string }>;

export function declareTimesWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  async function sendMatchingMessage(client: WebSocketClient<MessageSchema>, text = 'hello') {
    const messagePromise = waitForWebSocketMessage(client);

    client.send(JSON.stringify({ type: 'create', body: { text } }));

    await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
  }

  describe('Exact number of messages', () => {
    it('should keep maximum matching best-effort under concurrency', async () => {
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
            expect(effect).toHaveBeenCalledTimes(2);
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

  it('should report unmatched messages when message saving is enabled', async () => {
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
            '- {"message":{"type":"create","body":{"text":"hello"}},"diff":{"data":{"expected":{"type":"delete"},"received":{"type":"create","body":{"text":"hello"}}}}}',
        });
      },
    );
  });

  it('should reset message counts after cleared', async () => {
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
}
