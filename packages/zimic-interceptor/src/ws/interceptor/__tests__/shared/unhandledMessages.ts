import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareUnhandledMessageWebSocketInterceptorTests(
  options: RuntimeSharedWebSocketInterceptorTestsOptions,
) {
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

    return JSON.parse(event.data as string);
  }

  it('should include unmatched messages in declarationless times errors when message saving is enabled', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.message().with({ type: 'client', index: 2 }).times(1),
          interceptor,
        );

        const client = await createClient();

        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await waitFor(async () => {
          await expect(async () => {
            await handler.checkTimes();
          }).rejects.toThrow('Unmatched messages:');
        });

        await expect(async () => {
          await handler.checkTimes();
        }).rejects.toThrow(
          [
            'Expected exactly 1 matching message, but got 0.',
            '',
            'Unmatched messages:',
            '',
            '- {"message":{"type":"client","index":1},"diff":{"data":{"expected":{"type":"client","index":2},"received":{"type":"client","index":1}}}}',
            '',
            'Learn more: https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlertimes',
          ].join('\n'),
        );
      },
    );
  });

  it('should leave sockets open after unmatched messages', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(
        interceptor.message().with({ type: 'client', index: 2 }).respond({ type: 'server', index: 2 }),
        interceptor,
      );

      const client = await createClient();
      const messageListener = vi.fn();
      client.addEventListener('message', messageListener);

      await usingIgnoredConsole(['error'], async (console) => {
        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await waitForNot(() => {
          expect(messageListener).toHaveBeenCalled();
        });

        expect(client.readyState).toBe(WebSocketClient.OPEN);
        expect(console.error).not.toHaveBeenCalled();

        const messagePromise = waitForMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 2 }));

        await expect(messagePromise).resolves.toEqual({ type: 'server', index: 2 });
        expect(client.readyState).toBe(WebSocketClient.OPEN);
        expect(console.error).not.toHaveBeenCalled();
      });
    });
  });

  it('should log callback errors and leave sockets usable', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const error = new Error('Message effect failed.');

      await promiseIfRemote(
        interceptor
          .message()
          .with({ type: 'client', index: 1 })
          .effect(() => {
            throw error;
          }),
        interceptor,
      );

      await promiseIfRemote(
        interceptor.message().with({ type: 'client', index: 2 }).respond({ type: 'server', index: 2 }),
        interceptor,
      );

      const client = await createClient();

      await usingIgnoredConsole(['error'], async (console) => {
        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await waitFor(() => {
          expect(console.error).toHaveBeenCalledWith(error);
        });

        expect(client.readyState).toBe(WebSocketClient.OPEN);

        const messagePromise = waitForMessage(client);
        client.send(JSON.stringify({ type: 'client', index: 2 }));

        await expect(messagePromise).resolves.toEqual({ type: 'server', index: 2 });
        expect(client.readyState).toBe(WebSocketClient.OPEN);
      });
    });
  });
}
