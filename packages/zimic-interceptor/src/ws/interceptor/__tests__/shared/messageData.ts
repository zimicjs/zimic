import { waitFor } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, it, vi } from 'vitest';

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

type ChatMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;
type BinaryLikeJSONMessage = WebSocketSchema<{ type: 'binary'; data: string }>;
type TextMessage = WebSocketSchema<string>;
type BinaryMessage = WebSocketSchema<ArrayBuffer>;
type BinarySchema = WebSocketSchema<ArrayBuffer | Blob>;

export function declareMessageDataWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { getBaseURL, getInterceptorOptions } = options;

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  beforeEach(() => {
    baseURL = getBaseURL();
    interceptorOptions = getInterceptorOptions();
  });

  it('should forward and save plain string messages', async () => {
    await usingWebSocketInterceptor<TextMessage>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().with('ping').respond('pong').times(1), interceptor);

        await usingWebSocketClient<TextMessage>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);

          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          client.send('ping');

          await expect(messagePromise).resolves.toBe('pong');
          expect(handler.messages).toHaveLength(1);
          expect(handler.messages[0].data).toBe('ping');
          expect(interceptor.clients[0].messages[0].data).toBe('ping');
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      },
    );
  });

  it('should preserve JSON messages shaped like binary envelopes', async () => {
    await usingWebSocketInterceptor<BinaryLikeJSONMessage>(interceptorOptions, async (interceptor) => {
      const responseMessage: BinaryLikeJSONMessage = { type: 'binary', data: 'response' };

      await promiseIfRemote(
        interceptor.message().with({ type: 'binary', data: 'request' }).respond(responseMessage).times(1),
        interceptor,
      );

      await usingWebSocketClient<BinaryLikeJSONMessage>(baseURL, async (firstClient) => {
        await usingWebSocketClient<BinaryLikeJSONMessage>(baseURL, async (secondClient) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(2);
          });

          const firstMessagePromise = waitForWebSocketClientMessage(firstClient);
          firstClient.send(JSON.stringify({ type: 'binary', data: 'request' }));
          await expect(firstMessagePromise).resolves.toBe(JSON.stringify(responseMessage));

          const secondMessagePromise = waitForWebSocketClientMessage(secondClient);
          interceptor.server.send(JSON.stringify({ type: 'binary', data: 'broadcast' }));
          await expect(secondMessagePromise).resolves.toBe(JSON.stringify({ type: 'binary', data: 'broadcast' }));
        });
      });
    });
  });

  it('should parse JSON text before unrestricted handler callbacks', async () => {
    await usingWebSocketInterceptor<ChatMessage>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const requestMessage: ChatMessage = { type: 'client', text: 'hello' };
        const effect = vi.fn();
        const handler = await promiseIfRemote(interceptor.message().effect(effect).times(1), interceptor);

        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          client.send(JSON.stringify(requestMessage));

          await waitFor(() => {
            expect(effect).toHaveBeenCalledWith(requestMessage, expect.any(Object));
          });

          expect(handler.messages).toHaveLength(1);
          expect(handler.messages[0].data).toEqual(requestMessage);
          expect(handler.messages[0].data).toBe(effect.mock.calls[0][0]);
          expect(interceptor.clients[0].messages[0].data).toEqual(requestMessage);
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      },
    );
  });

  it('should preserve non-JSON text before unrestricted handler callbacks', async () => {
    await usingWebSocketInterceptor<TextMessage>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const requestMessage = 'plain text';
        const effect = vi.fn();
        const handler = await promiseIfRemote(interceptor.message().effect(effect).times(1), interceptor);

        await usingWebSocketClient<TextMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          client.send(requestMessage);

          await waitFor(() => {
            expect(effect).toHaveBeenCalledWith(requestMessage, expect.any(Object));
          });

          expect(handler.messages).toHaveLength(1);
          expect(handler.messages[0].data).toBe(requestMessage);
          expect(interceptor.clients[0].messages[0].data).toBe(requestMessage);
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      },
    );
  });

  it('should preserve binary data before unrestricted handler callbacks', async () => {
    await usingWebSocketInterceptor<BinaryMessage>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const requestMessage = createBinaryMessage(0xff, 0x00);
        const effect = vi.fn();
        const handler = await promiseIfRemote(interceptor.message().effect(effect).times(1), interceptor);

        await usingWebSocketClient<BinaryMessage>(baseURL, async (client) => {
          await waitFor(() => {
            expect(interceptor.clients).toHaveLength(1);
          });

          client.send(requestMessage);

          await waitFor(() => {
            expect(effect).toHaveBeenCalledOnce();
          });

          const receivedMessage = effect.mock.calls[0][0] as Blob | ArrayBuffer;
          expect(await readBytes(receivedMessage)).toEqual([0xff, 0x00]);
          expect(handler.messages).toHaveLength(1);
          expect(await readBytes(handler.messages[0].data)).toEqual([0xff, 0x00]);
          expect(await readBytes(interceptor.clients[0].messages[0].data)).toEqual([0xff, 0x00]);
        });

        await promiseIfRemote(interceptor.checkTimes(), interceptor);
      },
    );
  });

  it.each([
    ['ArrayBuffer', () => createBinaryMessage(0xff, 0x00)],
    ['Blob', () => new Blob([createBinaryMessage(0xff, 0x00)])],
  ])('should support %s binary messages', async (_name, createRequestMessage) => {
    await usingWebSocketInterceptor<BinarySchema>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(
        interceptor.message().with(createBinaryMessage(0xff, 0x00)).respond(createBinaryMessage(0x00, 0xff)).times(1),
        interceptor,
      );

      await usingWebSocketClient<BinarySchema>(baseURL, async (client) => {
        client.binaryType = 'arraybuffer';

        const response = waitForWebSocketClientMessage(client);

        client.send(createRequestMessage());

        expect(await readBytes((await response) as Blob | ArrayBuffer)).toEqual([0x00, 0xff]);
      });

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });
}
