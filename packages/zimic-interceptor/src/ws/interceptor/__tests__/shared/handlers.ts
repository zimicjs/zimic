import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;
type ChatMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;
type TextMessage = WebSocketSchema<string>;
type BinaryMessage = WebSocketSchema<ArrayBuffer>;

export function declareHandlerWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

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

  async function createClient<Schema extends WebSocketSchema = MessageSchema>() {
    const client = new WebSocketClient<Schema>(baseURL);
    closeClients.push(() => client.close());

    await client.open();

    return client;
  }

  async function waitForMessage<Schema extends WebSocketSchema>(client: WebSocketClient<Schema>) {
    const event = await new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
      client.addEventListener('message', resolve, { once: true });
    });

    if (typeof event.data === 'string' && /^[{[]/.test(event.data.trim())) {
      return JSON.parse(event.data);
    }

    return event.data;
  }

  async function readBytes(data: Blob | BufferSource) {
    const arrayBuffer = data instanceof Blob ? await data.arrayBuffer() : data;

    if (arrayBuffer instanceof ArrayBuffer) {
      return Array.from(new Uint8Array(arrayBuffer));
    }

    return Array.from(new Uint8Array(arrayBuffer.buffer, arrayBuffer.byteOffset, arrayBuffer.byteLength));
  }

  function createBinaryMessage(firstByte: number, secondByte: number) {
    const message = new ArrayBuffer(2);
    const messageView = new Uint8Array(message);
    messageView[0] = firstByte;
    messageView[1] = secondByte;
    return message as BinaryMessage;
  }

  if (type === 'remote') {
    it('should track clients when they open and close', async () => {
      await usingWebSocketInterceptor<ChatMessage>(interceptorOptions, async (interceptor) => {
        await interceptor.message().respond({ type: 'server', text: 'connected' });
        expect(interceptor.clients).toHaveLength(0);

        const client = await createClient<ChatMessage>();

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
          expect(interceptor.clients[0].url).toBe(client.url);
        });

        await client.close();

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(0);
        });
      });
    });

    it('should forward client messages to handlers, reply only to the sender, and save messages', async () => {
      await usingWebSocketInterceptor<ChatMessage>(
        { ...interceptorOptions, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor
              .message()
              .with({ type: 'client' })
              .respond((message) => ({ type: 'server', text: `received ${message.text}` }))
              .times(1),
            interceptor,
          );

          const firstClient = await createClient<ChatMessage>();
          const secondClient = await createClient<ChatMessage>();
          const firstMessagePromise = waitForMessage(firstClient);
          const secondMessageListener = vi.fn();
          secondClient.addEventListener('message', secondMessageListener);

          firstClient.send(JSON.stringify({ type: 'client', text: 'one' }));

          await expect(firstMessagePromise).resolves.toEqual({ type: 'server', text: 'received one' });
          await waitForNot(() => {
            expect(secondMessageListener).toHaveBeenCalled();
          });

          expect(handler.messages).toHaveLength(1);
          expect(handler.messages[0].sender.url).toBe(firstClient.url);
          expect(handler.messages[0].receiver).toBe(interceptor.server);
          expect(handler.messages[0].data).toEqual({ type: 'client', text: 'one' });
          expect(interceptor.clients[0].messages).toHaveLength(1);
          expect(interceptor.server.messages).toHaveLength(1);

          await handler.checkTimes();
        },
      );
    });

    it('should forward and save plain string messages', async () => {
      await usingWebSocketInterceptor<TextMessage>(
        { ...interceptorOptions, messageSaving: { enabled: true } },
        async (interceptor) => {
          const handler = await promiseIfRemote(
            interceptor.message().with('ping').respond('pong').times(1),
            interceptor,
          );

          const client = await createClient<TextMessage>();
          const messagePromise = waitForMessage(client);

          client.send('ping');

          await expect(messagePromise).resolves.toBe('pong');
          expect(handler.messages).toHaveLength(1);
          expect(handler.messages[0].data).toBe('ping');
          expect(interceptor.clients[0].messages[0].data).toBe('ping');

          await handler.checkTimes();
        },
      );
    });

    it('should allow effects to broadcast through the receiver', async () => {
      await usingWebSocketInterceptor<ChatMessage>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(
          interceptor.message().effect((message, { receiver }) => {
            receiver.send(JSON.stringify({ type: 'server', text: `broadcast ${message.text}` }));
          }),
          interceptor,
        );

        const firstClient = await createClient<ChatMessage>();
        const secondClient = await createClient<ChatMessage>();
        const firstMessagePromise = waitForMessage(firstClient);
        const secondMessagePromise = waitForMessage(secondClient);

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(2);
        });

        firstClient.send(JSON.stringify({ type: 'client', text: 'one' }));

        await expect(firstMessagePromise).resolves.toEqual({ type: 'server', text: 'broadcast one' });
        await expect(secondMessagePromise).resolves.toEqual({ type: 'server', text: 'broadcast one' });
      });
    });

    it('should allow effects to target clients through public handles', async () => {
      await usingWebSocketInterceptor<ChatMessage>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(
          interceptor.message().effect((message) => {
            const [, secondClient] = interceptor.clients;
            secondClient.send(JSON.stringify({ type: 'server', text: `targeted ${message.text}` }));
          }),
          interceptor,
        );

        const firstClient = await createClient<ChatMessage>();
        const secondClient = await createClient<ChatMessage>();
        const firstMessageListener = vi.fn();
        const secondMessagePromise = waitForMessage(secondClient);
        firstClient.addEventListener('message', firstMessageListener);

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(2);
        });

        firstClient.send(JSON.stringify({ type: 'client', text: 'one' }));

        await expect(secondMessagePromise).resolves.toEqual({ type: 'server', text: 'targeted one' });
        await waitForNot(() => {
          expect(firstMessageListener).toHaveBeenCalled();
        });
      });
    });

    it('should forward and save binary messages', async () => {
      await usingWebSocketInterceptor<BinaryMessage>(
        { ...interceptorOptions, messageSaving: { enabled: true } },
        async (interceptor) => {
          const requestMessage = createBinaryMessage(0xff, 0x00);
          const responseMessage = createBinaryMessage(0x00, 0xff);

          const handler = await promiseIfRemote(
            interceptor.message().with(requestMessage).respond(responseMessage).times(1),
            interceptor,
          );

          const client = await createClient<BinaryMessage>();
          client.binaryType = 'arraybuffer';
          const messagePromise = waitForMessage(client);

          client.send(requestMessage);

          const message = await messagePromise;
          expect(await readBytes(message as Blob | BufferSource)).toEqual([0x00, 0xff]);

          expect(handler.messages).toHaveLength(1);
          expect(await readBytes(handler.messages[0].data)).toEqual([0xff, 0x00]);
          expect(await readBytes(interceptor.clients[0].messages[0].data)).toEqual([0xff, 0x00]);

          await handler.checkTimes();
        },
      );
    });

    it('should allow effects to target clients with binary messages', async () => {
      await usingWebSocketInterceptor<BinaryMessage>(interceptorOptions, async (interceptor) => {
        const responseMessage = createBinaryMessage(0x00, 0xff);

        await promiseIfRemote(
          interceptor.message().effect(() => {
            const [, secondClient] = interceptor.clients;
            secondClient.send(responseMessage);
          }),
          interceptor,
        );

        const firstClient = await createClient<BinaryMessage>();
        const secondClient = await createClient<BinaryMessage>();
        firstClient.binaryType = 'arraybuffer';
        secondClient.binaryType = 'arraybuffer';
        const firstMessageListener = vi.fn();
        const secondMessagePromise = waitForMessage(secondClient);
        firstClient.addEventListener('message', firstMessageListener);

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(2);
        });

        firstClient.send(createBinaryMessage(0xff, 0x00));

        const message = await secondMessagePromise;
        expect(await readBytes(message as Blob | BufferSource)).toEqual([0x00, 0xff]);
        await waitForNot(() => {
          expect(firstMessageListener).toHaveBeenCalled();
        });
      });
    });

    it('should broadcast binary messages from the server handle', async () => {
      await usingWebSocketInterceptor<BinaryMessage>(interceptorOptions, async (interceptor) => {
        await promiseIfRemote(
          interceptor.message().effect(() => undefined),
          interceptor,
        );

        const firstClient = await createClient<BinaryMessage>();
        const secondClient = await createClient<BinaryMessage>();
        firstClient.binaryType = 'arraybuffer';
        secondClient.binaryType = 'arraybuffer';

        const firstMessagePromise = waitForMessage(firstClient);
        const secondMessagePromise = waitForMessage(secondClient);

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(2);
        });

        interceptor.server.send(createBinaryMessage(0x00, 0xff));

        const firstMessage = await firstMessagePromise;
        expect(await readBytes(firstMessage as Blob | BufferSource)).toEqual([0x00, 0xff]);

        const secondMessage = await secondMessagePromise;
        expect(await readBytes(secondMessage as Blob | BufferSource)).toEqual([0x00, 0xff]);
      });
    });
  }

  it('should passively accept, save, and count matching client messages without sending a response', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message().with({ type: 'client' }).times(1), interceptor);

        const client = await createClient();
        const messageListener = vi.fn();
        client.addEventListener('message', messageListener);

        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await waitFor(() => {
          expect(handler.messages).toHaveLength(1);
        });

        await waitForNot(() => {
          expect(messageListener).toHaveBeenCalled();
        });

        expect(handler.messages[0].sender.url).toBe(client.url);
        expect(handler.messages[0].receiver).toBe(interceptor.server);
        expect(handler.messages[0].data).toEqual({ type: 'client', index: 1 });
        expect(interceptor.clients[0].messages).toHaveLength(1);
        expect(interceptor.clients[0].messages[0].data).toEqual({ type: 'client', index: 1 });
        expect(interceptor.server.messages).toHaveLength(1);
        expect(interceptor.server.messages[0].data).toEqual({ type: 'client', index: 1 });

        await handler.checkTimes();
      },
    );
  });

  it('should give declarationless handlers reverse priority and skip exhausted handlers', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const firstHandler = await promiseIfRemote(interceptor.message().times(1), interceptor);
        const secondHandler = await promiseIfRemote(interceptor.message().times(1), interceptor);

        const client = await createClient();
        const messageListener = vi.fn();
        client.addEventListener('message', messageListener);

        client.send(JSON.stringify({ type: 'client', index: 1 }));

        await waitFor(() => {
          expect(secondHandler.messages).toHaveLength(1);
        });

        client.send(JSON.stringify({ type: 'client', index: 2 }));

        await waitFor(() => {
          expect(firstHandler.messages).toHaveLength(1);
        });

        await waitForNot(() => {
          expect(messageListener).toHaveBeenCalled();
        });

        expect(secondHandler.messages[0].data).toEqual({ type: 'client', index: 1 });
        expect(firstHandler.messages[0].data).toEqual({ type: 'client', index: 2 });

        await firstHandler.checkTimes();
        await secondHandler.checkTimes();
      },
    );
  });

  it('should passively match messages from a restricted client without sending a response', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        await promiseIfRemote(interceptor.message().times(0), interceptor);

        const firstClient = await createClient();
        const secondClient = await createClient();
        const firstMessageListener = vi.fn();
        const secondMessageListener = vi.fn();
        firstClient.addEventListener('message', firstMessageListener);
        secondClient.addEventListener('message', secondMessageListener);

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(2);
        });

        const handler = await promiseIfRemote(interceptor.message().from(interceptor.clients[0]).times(1), interceptor);

        secondClient.send(JSON.stringify({ type: 'client', index: 2 }));

        await waitFor(async () => {
          await expect(async () => {
            await handler.checkTimes();
          }).rejects.toThrow('Unmatched messages:');
        });

        firstClient.send(JSON.stringify({ type: 'client', index: 1 }));

        await waitFor(() => {
          expect(handler.messages).toHaveLength(1);
        });

        await waitForNot(() => {
          expect(firstMessageListener).toHaveBeenCalled();
          expect(secondMessageListener).toHaveBeenCalled();
        });

        expect(handler.messages[0].sender.url).toBe(firstClient.url);
        expect(handler.messages[0].data).toEqual({ type: 'client', index: 1 });
        expect(interceptor.clients[0].messages).toHaveLength(1);
        expect(interceptor.clients[0].messages[0].data).toEqual({ type: 'client', index: 1 });
        expect(interceptor.clients[1].messages).toHaveLength(0);
        expect(interceptor.server.messages).toHaveLength(1);

        await handler.checkTimes();
      },
    );
  });
}
