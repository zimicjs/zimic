import { waitFor } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, expectTypeOf, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  createBinaryMessage,
  readBytes,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

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

      await promiseIfRemote(
        interceptor.message().with({ type: 'delete' }).respond({ type: 'delete', id: 'probe' }),
        interceptor,
      );

      await usingWebSocketClient<MessageSchema>(baseURL, async (client) => {
        const probeResponse = waitForWebSocketClientMessage(client);

        client.send(JSON.stringify({ type: 'create', body: { text: 'other' } }));

        // Messages on a socket are delivered in order, so the probe response arriving first means that the unmatched
        // message got no response.
        client.send(JSON.stringify({ type: 'delete', id: '1' }));

        await expect(probeResponse).resolves.toBe(JSON.stringify({ type: 'delete', id: 'probe' }));

        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));
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
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        // Messages on a socket are handled in order, so the effect running only for the matching message means that the
        // unmatched message did not run it.
        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });
        expect(effect).toHaveBeenCalledWith({ type: 'create', body: { text: 'hello' } }, expect.any(Object));
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

            // The restricted handler has precedence, so the unrestricted effect running means that it did not match.
            await waitFor(() => {
              expect(unrestrictedEffect).toHaveBeenCalledTimes(1);
            });
            expect(secondMessageListener).not.toHaveBeenCalled();

            const firstMessagePromise = waitForWebSocketClientMessage(firstClient);
            firstClient.send(JSON.stringify({ type: 'create', body: { text: 'restricted' } }));

            await expect(firstMessagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '1' }));
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
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        // Messages on a socket are handled in order, so the effect running only for the matching message means that the
        // unmatched message did not run it.
        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });
        expect(effect).toHaveBeenCalledWith({ type: 'create', body: { text: 'hello' } }, expect.any(Object));
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
        client.send(binaryBlob);

        // Messages on a socket are handled in order, so the effect running only for the matching message means that the
        // unmatched message did not run it.
        await waitFor(() => {
          expect(effect).toHaveBeenCalledTimes(1);
        });
        expect(await readBytes(effect.mock.calls[0][0] as Blob | ArrayBuffer)).toEqual([1, 2]);
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

        await promiseIfRemote(handler.clear().respond({ type: 'delete', id: '2' }).times(1), interceptor);

        const messagePromise = waitForWebSocketClientMessage(client);
        client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

        await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'delete', id: '2' }));
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });
}
