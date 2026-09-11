import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import DisabledMessageSavingError from '@/ws/messageHandler/errors/DisabledMessageSavingError';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import MessageSavingSafeLimitExceededError from '../../errors/MessageSavingSafeLimitExceededError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorMessageSaving, WebSocketInterceptorOptions } from '../../types/options';
import { DEFAULT_MESSAGE_SAVING_SAFE_LIMIT } from '../../WebSocketInterceptorImplementation';
import { RuntimeSharedWebSocketInterceptorTestsOptions, waitForWebSocketMessage } from './utils';

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

  it.each([{ NODE_ENV: 'development' }, { NODE_ENV: 'test' }, { NODE_ENV: 'production' }])(
    'should have the correct default message saving configuration if none is provided (NODE_ENV: $NODE_ENV)',
    (environment) => {
      const processEnvSpy = vi.spyOn(process, 'env', 'get').mockReturnValue(environment);

      try {
        const interceptor = createWebSocketInterceptor<MessageSchema>({
          ...interceptorOptions,
          messageSaving: undefined,
        });

        expect(interceptor.messageSaving).toEqual<WebSocketInterceptorMessageSaving>({
          enabled: platform === 'node' && environment.NODE_ENV === 'test',
          safeLimit: DEFAULT_MESSAGE_SAVING_SAFE_LIMIT,
        });
      } finally {
        processEnvSpy.mockRestore();
      }
    },
  );

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

  it('should not save or warn if message saving is disabled', async () => {
    const safeLimit = 2;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: false, safeLimit } },
      async (interceptor) => {
        expect(interceptor.messageSaving.enabled).toBe(false);
        expect(interceptor.messageSaving.safeLimit).toBe(safeLimit);

        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);
        const client = await createClient();

        await usingIgnoredConsole(['warn'], async (console) => {
          const numberOfMessages = safeLimit + 1;

          for (let index = 0; index < numberOfMessages; index++) {
            const messagePromise = waitForWebSocketMessage(client);

            client.send(JSON.stringify({ type: 'client', index }));

            await expect(messagePromise).resolves.toEqual({ type: 'server', index: 1 });
          }

          expect(() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            handler.messages;
          }).toThrow(new DisabledMessageSavingError());

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

  it('should warn if saved messages exceed the safe limit considering the sum of all handlers', async () => {
    const safeLimit = 3;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
      async (interceptor) => {
        const firstHandler = await promiseIfRemote(
          interceptor.message().with({ type: 'client', index: 1 }).respond({ type: 'server', index: 1 }),
          interceptor,
        );
        const secondHandler = await promiseIfRemote(
          interceptor.message().with({ type: 'client', index: 2 }).respond({ type: 'server', index: 2 }),
          interceptor,
        );
        const client = await createClient();

        await usingIgnoredConsole(['warn'], async (console) => {
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          client.send(JSON.stringify({ type: 'client', index: 2 }));
          client.send(JSON.stringify({ type: 'client', index: 1 }));
          client.send(JSON.stringify({ type: 'client', index: 2 }));

          await waitFor(() => {
            expect(firstHandler.messages).toHaveLength(2);
            expect(secondHandler.messages).toHaveLength(2);
          });

          expect(console.warn).toHaveBeenCalledTimes(1);
          expect(console.warn).toHaveBeenCalledWith(new MessageSavingSafeLimitExceededError(4, safeLimit));
        });
      },
    );
  });

  it('should reset retained messages after handler reconfiguration and warn when the safe limit is exceeded again', async () => {
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

          const handlerMessages = handler.messages;
          const interceptorClient = interceptor.clients[0];
          const clientMessages = interceptorClient.messages;
          const serverMessages = interceptor.server.messages;

          await promiseIfRemote(handler.respond({ type: 'server', index: 2 }), interceptor);

          expect(handler.messages).toBe(handlerMessages);
          expect(handler.messages).toHaveLength(0);
          expect(interceptorClient.messages).toBe(clientMessages);
          expect(interceptorClient.messages).toHaveLength(0);
          expect(interceptor.server.messages).toBe(serverMessages);
          expect(interceptor.server.messages).toHaveLength(0);

          console.warn.mockClear();

          for (let index = 0; index < 2; index++) {
            client.send(JSON.stringify({ type: 'client', index }));
          }

          await waitFor(() => {
            expect(handler.messages).toHaveLength(2);
          });

          expect(console.warn).toHaveBeenCalledTimes(1);
          expect(console.warn).toHaveBeenCalledWith(new MessageSavingSafeLimitExceededError(2, safeLimit));
        });
      },
    );
  });

  it('should retain disconnected client messages in safe-limit accounting', async () => {
    const safeLimit = 1;

    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true, safeLimit } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().respond({ type: 'server', index: 1 }), interceptor);
        const firstClient = await createClient();

        firstClient.send(JSON.stringify({ type: 'client', index: 1 }));

        await waitFor(() => {
          expect(handler.messages).toHaveLength(1);
          expect(interceptor.clients).toHaveLength(1);
        });

        const firstInterceptorClient = interceptor.clients[0];
        const firstClientMessages = firstInterceptorClient.messages;

        await firstClient.close();

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(0);
        });

        expect(firstInterceptorClient.messages).toBe(firstClientMessages);
        expect(firstInterceptorClient.messages).toHaveLength(1);
        expect(interceptor.server.messages).toHaveLength(1);

        await usingIgnoredConsole(['warn'], async (console) => {
          const secondClient = await createClient();
          secondClient.send(JSON.stringify({ type: 'client', index: 2 }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(2);
          });

          expect(console.warn).toHaveBeenCalledTimes(1);
          expect(console.warn).toHaveBeenCalledWith(new MessageSavingSafeLimitExceededError(2, safeLimit));
        });
      },
    );
  });
}
