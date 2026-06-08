import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeEach, expect, it } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import MessageSavingSafeLimitExceededError from '../../errors/MessageSavingSafeLimitExceededError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorMessageSaving, WebSocketInterceptorOptions } from '../../types/options';
import { DEFAULT_MESSAGE_SAVING_SAFE_LIMIT } from '../../WebSocketInterceptorImplementation';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;

export function declareMessageSavingWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { platform, getBaseURL, getInterceptorOptions } = options;

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

  it('should have the correct default message saving configuration if none is provided', () => {
    const interceptor = createWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, messageSaving: undefined });

    expect(interceptor.messageSaving).toEqual<WebSocketInterceptorMessageSaving>({
      enabled: platform === 'node',
      safeLimit: DEFAULT_MESSAGE_SAVING_SAFE_LIMIT,
    });
  });

  it('should not warn if saved messages reach the safe limit without exceeding it', async () => {
    const safeLimit = 2;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);
        const client = await createClient();

        await usingIgnoredConsole(['warn'], async (console) => {
          for (let index = 0; index < safeLimit; index++) {
            client.send(JSON.stringify({ type: 'client', index }));
          }

          await waitFor(() => {
            expect(handler.messages).toHaveLength(safeLimit);
          });

          expect(console.warn).toHaveBeenCalledTimes(0);
        });
      },
    );
  });

  it('should warn if saved messages exceed the safe limit', async () => {
    const safeLimit = 2;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);
        const client = await createClient();

        await usingIgnoredConsole(['warn'], async (console) => {
          const numberOfMessages = safeLimit + 1;

          for (let index = 0; index < numberOfMessages; index++) {
            client.send(JSON.stringify({ type: 'client', index }));
          }

          await waitFor(() => {
            expect(handler.messages).toHaveLength(numberOfMessages);
          });

          expect(console.warn).toHaveBeenCalledTimes(1);
          expect(console.warn).toHaveBeenCalledWith(new MessageSavingSafeLimitExceededError(3, safeLimit));
        });
      },
    );
  });

  it('should reset the saved message count after cleared', async () => {
    const safeLimit = 1;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);
        const client = await createClient();

        await usingIgnoredConsole(['warn'], async (console) => {
          for (let index = 0; index < 2; index++) {
            client.send(JSON.stringify({ type: 'client', index }));
          }

          await waitFor(() => {
            expect(handler.messages).toHaveLength(2);
          });

          expect(console.warn).toHaveBeenCalledTimes(1);

          await interceptor.clear();
          await promiseIfRemote(handler.respond({ type: 'server', index: 2 }), interceptor);
          console.warn.mockClear();

          const nextClient = await createClient();
          nextClient.send(JSON.stringify({ type: 'client', index: 2 }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });

          expect(console.warn).toHaveBeenCalledTimes(0);
        });
      },
    );
  });
}
