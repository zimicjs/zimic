import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeEach, expect, expectTypeOf, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions, usingWebSocketClient, waitForWebSocketMessage } from './utils';

type MessageSchema = WebSocketSchema<
  { type: 'create'; body: { text: string; priority?: number } } | { type: 'delete'; id: string }
>;

export function declareRestrictionWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;
  let closeClients: (() => Promise<void>)[];

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
    closeClients = [];
  });

  afterEach(async () => {
    await Promise.all(closeClients.map((closeClient) => closeClient()));
  });

  async function createClient() {
    const client = new WebSocketClient<MessageSchema>(baseURL);
    closeClients.push(() => client.close());

    await client.open();

    return client;
  }

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
        await promiseIfRemote(interceptor.message(), interceptor);

        const firstClient = await createClient();
        const secondClient = await createClient();

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

        await waitForNot(() => {
          expect(secondMessageListener).toHaveBeenCalled();
        });

        const firstMessagePromise = waitForWebSocketMessage(firstClient);
        firstClient.send(JSON.stringify({ type: 'create', body: { text: 'restricted' } }));

        await expect(firstMessagePromise).resolves.toEqual({ type: 'delete', id: '1' });
        expect(handler.messages[0].sender).toBe(interceptor.clients[0]);
        expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'restricted' } });

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

  it('should clear restrictions after cleared', async () => {
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
