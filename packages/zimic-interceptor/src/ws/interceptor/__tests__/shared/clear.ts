import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { WEB_SOCKET_NORMAL_CLOSE_CODE } from '@/utils/webSocket/constants';
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

  async function createClient(url = baseURL) {
    const client = new WebSocketClient<MessageSchema>(url);
    closeClients.push(() => client.close());

    await client.open();

    return client;
  }

  async function waitForMessage(client: WebSocketClient<MessageSchema>) {
    const event = await new Promise<WebSocketClient.MessageEvent<MessageSchema>>((resolve) => {
      client.addEventListener('message', resolve, { once: true });
    });

    return JSON.parse(event.data as string);
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

  it('should support reusing previous handlers after cleared', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message(), interceptor);

        await promiseIfRemote(handler.respond({ type: 'server', index: 1 }), interceptor);
        await interceptor.clear();

        const reusedHandler = await promiseIfRemote(
          handler.respond({ type: 'server', index: 2 }).times(1),
          interceptor,
        );

        const client = await createClient();
        const messagePromise = waitForMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 2 }));

        await expect(messagePromise).resolves.toEqual({ type: 'server', index: 2 });
        expect(reusedHandler.messages).toHaveLength(1);
        await interceptor.checkTimes();
      },
    );
  });

  it('should clear handlers, saved messages, clients, and server messages', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const firstHandler = await promiseIfRemote(
          interceptor.message().respond({ type: 'server', index: 1 }).times(1),
          interceptor,
        );
        const interceptorClients = interceptor.clients;
        const firstHandlerMessages = firstHandler.messages;
        const serverMessages = interceptor.server.messages;

        const client = await createClient();
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const firstMessagePromise = waitForMessage(client);

        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await expect(firstMessagePromise).resolves.toEqual({ type: 'server', index: 1 });
        expect(firstHandler.messages).toHaveLength(1);
        expect(interceptor.server.messages).toHaveLength(1);
        expect(interceptor.clients).toHaveLength(1);

        const firstInterceptorClient = interceptor.clients[0];
        const firstClientMessages = firstInterceptorClient.messages;
        let closeEvent: WebSocketClient.CloseEvent<MessageSchema> | undefined;
        client.addEventListener('close', (event) => {
          closeEvent = event;
        });

        await interceptor.clear();

        await waitFor(() => {
          expect(closeEvent?.code).toBe(WEB_SOCKET_NORMAL_CLOSE_CODE);
        });
        expect(interceptor.clients).toBe(interceptorClients);
        expect(firstHandler.messages).toHaveLength(0);
        expect(firstHandler.messages).toBe(firstHandlerMessages);
        expect(firstInterceptorClient.messages).toBe(firstClientMessages);
        expect(firstInterceptorClient.messages).toHaveLength(0);
        expect(interceptor.server.messages).toHaveLength(0);
        expect(interceptor.server.messages).toBe(serverMessages);
        expect(interceptor.clients).toHaveLength(0);
        await interceptor.checkTimes();

        const staleMessageListener = vi.fn();
        client.addEventListener('message', staleMessageListener);
        firstInterceptorClient.send(JSON.stringify({ type: 'server', index: 1 }));
        interceptor.server.send(JSON.stringify({ type: 'server', index: 1 }));

        await waitForNot(() => {
          expect(staleMessageListener).toHaveBeenCalled();
        });

        const secondHandler = await promiseIfRemote(
          interceptor.message().respond({ type: 'server', index: 2 }).times(1),
          interceptor,
        );

        const secondClient = await createClient();
        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });
        expect(interceptor.clients).toBe(interceptorClients);
        expect(interceptor.server.messages).toBe(serverMessages);

        const secondMessagePromise = waitForMessage(secondClient);

        secondClient.send(JSON.stringify({ type: 'client', index: 2 }));

        await expect(secondMessagePromise).resolves.toEqual({ type: 'server', index: 2 });
        expect(secondHandler.messages).toHaveLength(1);
        await interceptor.checkTimes();
      },
    );
  });

  it('should clear only clients owned by the selected interceptor', async () => {
    const firstBaseURL = `${baseURL}/first`;
    const secondBaseURL = `${baseURL}/second`;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, baseURL: firstBaseURL },
      async (firstInterceptor) => {
        await usingWebSocketInterceptor<MessageSchema>(
          { ...interceptorOptions, baseURL: secondBaseURL },
          async (secondInterceptor) => {
            await promiseIfRemote(firstInterceptor.message().respond({ type: 'server', index: 1 }), firstInterceptor);
            await promiseIfRemote(secondInterceptor.message().respond({ type: 'server', index: 2 }), secondInterceptor);

            const firstClient = await createClient(firstBaseURL);
            const secondClient = await createClient(secondBaseURL);

            await waitFor(() => {
              expect(firstInterceptor.clients).toHaveLength(1);
              expect(secondInterceptor.clients).toHaveLength(1);
            });

            const firstCloseEventPromise = new Promise<WebSocketClient.CloseEvent<MessageSchema>>((resolve) => {
              firstClient.addEventListener('close', resolve, { once: true });
            });

            await firstInterceptor.clear();

            const firstCloseEvent = await firstCloseEventPromise;
            expect(firstCloseEvent.code).toBe(WEB_SOCKET_NORMAL_CLOSE_CODE);
            expect(firstInterceptor.clients).toHaveLength(0);
            expect(secondInterceptor.clients).toHaveLength(1);
            expect(secondClient.readyState).toBe(WebSocketClient.OPEN);

            const secondMessagePromise = waitForMessage(secondClient);
            secondClient.send(JSON.stringify({ type: 'client', index: 2 }));
            await expect(secondMessagePromise).resolves.toEqual({ type: 'server', index: 2 });
          },
        );
      },
    );
  });
}
