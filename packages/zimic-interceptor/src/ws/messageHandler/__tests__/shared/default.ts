import { waitFor } from '@zimic/utils/time';
import { beforeAll, beforeEach, afterAll, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import DisabledMessageSavingError from '../../errors/DisabledMessageSavingError';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './types';
import { usingWebSocketClient, waitForWebSocketMessage } from './utils';

export function declareDefaultWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
) {
  const { platform, type, startServer, stopServer, getBaseURL } = options;

  let baseURL: string;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  it('should match any message if contains no declared response, effect, or restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        expect(interceptor.platform).toBe(platform);

        const handler = interceptor.message().times(0);

        await handler.checkTimes();
      },
    );
  });

  it('should match any message if contains a declared response and no restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const handler = interceptor.message().respond({ type: 'delete', id: '1' }).times(0);

        await handler.checkTimes();
      },
    );
  });

  it('should match and save any message if contains no declarations or restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
        messageSaving: { enabled: true },
      },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().times(1), interceptor);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });
        });

        expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });

        await handler.checkTimes();
      },
    );
  });

  it('should match and save any message if contains a declared response and no restrictions', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
        messageSaving: { enabled: true },
      },
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.message().respond({ type: 'delete', id: '1' }).times(1),
          interceptor,
        );
        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });
        });

        expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });

        await handler.checkTimes();
      },
    );
  });

  it('should reset a message handler if cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const handler = interceptor.message().respond({ type: 'delete', id: '1' }).times(1);

        await expect(async () => {
          await handler.checkTimes();
        }).rejects.toThrow('Expected exactly 1 message, but got 0.');

        handler.clear();

        await handler.checkTimes();
      },
    );
  });

  it('should create response with declared message', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const handler = interceptor.message().respond({ type: 'delete', id: '1' }).times(0);

        await handler.checkTimes();
      },
    );
  });

  it('should create response with declared message factory', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const responseFactory = vi.fn((message: Schema) => ({ type: 'delete' as const, id: message.type }));
        const handler = interceptor.message().respond(responseFactory).times(1);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: 'create' });
        });

        expect(responseFactory).toHaveBeenCalledTimes(1);

        handler.clear();
        await handler.checkTimes();
      },
    );
  });

  it('should not throw an error if trying to create a response without a declared response', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const handler = interceptor.message();

        await handler.checkTimes();
      },
    );
  });

  it('should support clearing a message handler without a declared response or effect', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const handler = interceptor
          .message()
          .with({ type: 'create', body: { text: 'hello' } })
          .times(1);

        await expect(async () => {
          await handler.checkTimes();
        }).rejects.toThrow('Expected exactly 1 matching message, but got 0.');

        handler.clear();

        await handler.checkTimes();
      },
    );
  });

  it('should keep track of the intercepted messages', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
        messageSaving: { enabled: true },
      },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }), interceptor);

        expect(handler.messages).toEqual([]);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });
        });

        expect(handler.messages[0].sender.url).toBe(new URL(baseURL).href);
        expect(handler.messages[0].receiver).toBe(interceptor.server);
        expect(handler.messages[0].data).toEqual({ type: 'create', body: { text: 'hello' } });
      },
    );
  });

  it('should clear intercepted messages after cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
        messageSaving: { enabled: true },
      },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'delete', id: '1' }), interceptor);

        await usingWebSocketClient<Schema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketMessage(client);

          client.send(JSON.stringify({ type: 'create', body: { text: 'hello' } }));

          await expect(messagePromise).resolves.toEqual({ type: 'delete', id: '1' });

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });
        });

        await promiseIfRemote(handler.clear(), interceptor);

        expect(handler.messages).toEqual([]);
      },
    );
  });

  it('should clear restrictions after cleared', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      async (interceptor) => {
        const handler = interceptor
          .message()
          .with({ type: 'create', body: { text: 'hello' } })
          .delay(1)
          .delay(1, 2)
          .respond({ type: 'delete', id: '1' })
          .times(1);

        await expect(async () => {
          await handler.checkTimes();
        }).rejects.toThrow('Expected exactly 1 matching message, but got 0.');

        handler.clear();

        await handler.checkTimes();
      },
    );
  });

  it('should throw an error if trying to access messages and message saving is disabled', async () => {
    await usingWebSocketInterceptor<Schema>(
      {
        type,
        baseURL,
      },
      (interceptor) => {
        const handler = interceptor.message();

        expect(() => handler.messages).toThrow(DisabledMessageSavingError);
      },
    );
  });
}
