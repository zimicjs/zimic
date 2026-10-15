import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, expectTypeOf, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

import { WebSocketInterceptorOptions } from '../../types/options';
import {
  RuntimeSharedWebSocketInterceptorTestsOptions,
  createBinaryMessage,
  usingWebSocketClient,
  waitForWebSocketMessage,
} from './utils';

type MessageSchema = WebSocketSchema<
  { type: 'create'; body: { text: string; priority?: number } } | { type: 'delete'; id: string }
>;
type BinarySchema = WebSocketSchema<Blob>;

export function declareRestrictionWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should support intercepting messages having static restrictions', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(
        interceptor
          .message()
          .with({ type: 'create', body: { text: 'hello' } })
          .respond({ type: 'delete', id: '1' })
          .times(1),
        interceptor,
      );

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const unmatchedMessageListener = vi.fn();
        client.addEventListener('message', unmatchedMessageListener);

        client.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));

        await waitForNot(() => {
          expect(unmatchedMessageListener).toHaveBeenCalled();
        });

        client.removeEventListener('message', unmatchedMessageListener);

        const messagePromise = waitForWebSocketMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  it('should support intercepting messages having computed restrictions', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      function isCreateMessage(message: MessageSchema): message is Extract<MessageSchema, { type: 'create' }> {
        return message.type === 'create';
      }

      const effect = vi.fn((message: Extract<MessageSchema, { type: 'create' }>) => {
        expectTypeOf(message.body.priority).toEqualTypeOf<number | undefined>();
      });

      await promiseIfRemote(interceptor.message().with(isCreateMessage).effect(effect).times(1), interceptor);

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        client.send(JSON.stringify({ type: 'delete', id: '1' }));

        await waitForNot(() => {
          expect(effect).toHaveBeenCalled();
        });

        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  it('should support intercepting messages from a restricted sender', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const unrestrictedEffect = vi.fn();
        await promiseIfRemote(interceptor.message().effect(unrestrictedEffect), interceptor);

        await usingWebSocketClient<MessageSchema>(baseURL, async (firstClient) => {
          await usingWebSocketClient<MessageSchema>(baseURL, async (secondClient) => {
            await waitFor(() => {
              expect(interceptor.clients).toHaveLength(2);
            });

            const handler = await promiseIfRemote(
              interceptor.message().from(interceptor.clients[0]).respond({ type: 'delete', id: '1' }).times(1),
              interceptor,
            );

            const secondMessageListener = vi.fn();
            secondClient.addEventListener('message', secondMessageListener);

            secondClient.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));

            await waitFor(() => {
              expect(unrestrictedEffect).toHaveBeenCalledTimes(1);
            });
            await waitForNot(() => {
              expect(secondMessageListener).toHaveBeenCalled();
            });

            const firstMessagePromise = waitForWebSocketMessage(firstClient);
            firstClient.send(JSON.stringify({ type: 'create', body: { text: 'restricted' } }));

            await expect(firstMessagePromise).resolves.toEqual({ type: 'delete', id: '1' });
            expect(unrestrictedEffect).toHaveBeenCalledTimes(1);
            expect(handler.messages[0].sender).toBe(interceptor.clients[0]);
            expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'restricted' } });
          });
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      },
    );
  });

  it('should support intercepting messages satisfying multiple restrictions', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const effect = vi.fn();

      await promiseIfRemote(
        interceptor
          .message()
          .with({ type: 'create' })
          .with((message): message is Extract<MessageSchema, { type: 'create' }> =>
            message.body.text.startsWith('hello'),
          )
          .effect(effect)
          .times(1),
        interceptor,
      );

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        client.send(JSON.stringify({ type: 'create', body: { text: 'goodbye' } }));

        await waitForNot(() => {
          expect(effect).toHaveBeenCalled();
        });

        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  it('should support intercepting binary blob messages having static restrictions', async () => {
    await usingWebSocketInterceptor<BinarySchema>(interceptorOptions, async (interceptor) => {
      const effect = vi.fn();

      const binaryBlob = new Blob([createBinaryMessage(1, 2)]);

      await promiseIfRemote(interceptor.message().with(binaryBlob).effect(effect).times(1), interceptor);

      await usingWebSocketClient<BinarySchema>(baseURL, async (client) => {
        client.send(new Blob([createBinaryMessage(3, 4)]));

        await waitForNot(() => {
          expect(effect).toHaveBeenCalled();
        });

        client.send(binaryBlob);

        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  it('should reset restrictions when cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(
        interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: '1' }).times(1),
        interceptor,
      );

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const unmatchedMessageListener = vi.fn();
        client.addEventListener('message', unmatchedMessageListener);

        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        await waitForNot(() => {
          expect(unmatchedMessageListener).toHaveBeenCalled();
        });

        await promiseIfRemote(handler.clear().respond({ type: 'delete', id: '2' }).times(1), interceptor);

        const messagePromise = waitForWebSocketMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '2' });
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });
}
