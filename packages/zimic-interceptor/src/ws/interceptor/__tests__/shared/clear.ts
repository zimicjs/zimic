import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareClearWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
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

  async function waitForMessage(client: WebSocketClient<MessageSchema>) {
    const event = await new Promise<WebSocketClient.MessageEvent<MessageSchema>>((resolve) => {
      client.addEventListener('message', resolve, { once: true });
    });

    if (typeof event.data === 'string') {
      return JSON.parse(event.data);
    }

    return event.data;
  }

  it('should clear handler state', async () => {
    await usingWebSocketInterceptor<{}>(interceptorOptions, async (interceptor) => {
      interceptor.message().respond({}).times(1);

      await expect(async () => {
        await interceptor.checkTimes();
      }).rejects.toThrow('Expected exactly 1 message, but got 0.');

      await interceptor.clear();
      await interceptor.checkTimes();
    });
  });

  it('should clear handlers, saved messages, clients, and server messages', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const firstHandler = await promiseIfRemote(
          interceptor.message().respond({ type: 'server', index: 1 }).times(1),
          interceptor,
        );

        const client = await createClient();
        const firstMessagePromise = waitForMessage(client);

        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await expect(firstMessagePromise).resolves.toEqual({ type: 'server', index: 1 });
        expect(firstHandler.messages).toHaveLength(1);
        expect(interceptor.server.messages).toHaveLength(1);
        expect(interceptor.clients).toHaveLength(1);

        await interceptor.clear();

        expect(firstHandler.messages).toHaveLength(0);
        expect(interceptor.server.messages).toHaveLength(0);
        expect(interceptor.clients).toHaveLength(0);
        await interceptor.checkTimes();

        const secondHandler = await promiseIfRemote(
          interceptor.message().respond({ type: 'server', index: 2 }).times(1),
          interceptor,
        );

        const secondClient = await createClient();
        const secondMessagePromise = waitForMessage(secondClient);

        secondClient.send(JSON.stringify({ type: 'client', index: 2 }));

        await expect(secondMessagePromise).resolves.toEqual({ type: 'server', index: 2 });
        expect(secondHandler.messages).toHaveLength(1);
        await interceptor.checkTimes();
      },
    );
  });
}
