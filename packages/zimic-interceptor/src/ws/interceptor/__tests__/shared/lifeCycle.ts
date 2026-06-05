import { waitFor, waitForNot } from '@zimic/utils/time';
import { UnsupportedURLProtocolError, joinURL } from '@zimic/utils/url';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeEach, expect, expectTypeOf, it, vi } from 'vitest';

import { promiseIfRemote } from '@/http/interceptorWorker/__tests__/utils/promises';
import { WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE } from '@/utils/webSocket/constants';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import MessageSavingSafeLimitExceededError from '../../errors/MessageSavingSafeLimitExceededError';
import NotRunningWebSocketInterceptorError from '../../errors/NotRunningWebSocketInterceptorError';
import RunningWebSocketInterceptorError from '../../errors/RunningWebSocketInterceptorError';
import { createWebSocketInterceptor } from '../../factory';
import { WebSocketInterceptorMessageSaving, WebSocketInterceptorOptions } from '../../types/options';
import {
  SUPPORTED_BASE_URL_PROTOCOLS,
  DEFAULT_MESSAGE_SAVING_SAFE_LIMIT,
} from '../../WebSocketInterceptorImplementation';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

type MessageSchema = WebSocketSchema<{ type: 'client'; index: number } | { type: 'server'; index: number }>;
type ChatMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;
type TextMessage = WebSocketSchema<string>;
type BinaryMessage = WebSocketSchema<ArrayBuffer>;

export function declareLifeCycleWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { platform, type, getBaseURL, getInterceptorOptions } = options;

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

  it('should initialize with the correct platform', async () => {
    const interceptor = createWebSocketInterceptor<{}>(interceptorOptions);

    expect(interceptor.platform).toBe(null);

    await interceptor.start();
    expect(interceptor.platform).toBe(platform);

    await interceptor.stop();
    expect(interceptor.platform).toBe(null);
  });

  it('should not throw if started or stopped multiple times', async () => {
    const interceptor = createWebSocketInterceptor<{}>(interceptorOptions);

    expect(interceptor.isRunning).toBe(false);

    await interceptor.start();
    await interceptor.start();

    expect(interceptor.isRunning).toBe(true);

    await interceptor.stop();
    await interceptor.stop();

    expect(interceptor.isRunning).toBe(false);
  });

  async function createClient<Schema extends WebSocketSchema = MessageSchema>(options: { timeout?: number } = {}) {
    const client = new WebSocketClient<Schema>(baseURL);
    closeClients.push(() => client.close());

    await client.open({ timeout: options.timeout });

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

  async function expectClientToCloseAsUnhandled() {
    const client = new WebSocketClient<MessageSchema>(baseURL);
    closeClients.push(() => client.close());

    const closeEventPromise = new Promise<WebSocketClient.CloseEvent<MessageSchema>>((resolve) => {
      client.addEventListener('close', resolve, { once: true });
    });

    await client.open({ timeout: 500 });

    const closeEvent = await closeEventPromise;
    expect(closeEvent.code).toBe(WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE);
    expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
  }

  if (type === 'local') {
    it('should create a typed local interceptor by default', () => {
      const interceptor = createWebSocketInterceptor<MessageSchema>({ baseURL });

      expect(interceptor.type).toBe('local');

      expectTypeOf(interceptor.message).parameters.toEqualTypeOf<[]>();
      expectTypeOf(interceptor.checkTimes).returns.toEqualTypeOf<void>();
      expectTypeOf(interceptor.clear).returns.toEqualTypeOf<void>();
    });
  }

  it('should support changing the base URL after created and stopped', async () => {
    const interceptor = createWebSocketInterceptor<MessageSchema>(interceptorOptions);

    try {
      expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));

      const newBaseURL = joinURL(baseURL, 'new').replace(/\/$/, '');
      interceptor.baseURL = newBaseURL;
      expect(interceptor.baseURL).toBe(newBaseURL);

      await interceptor.start();

      expect(() => {
        interceptor.baseURL = baseURL;
      }).toThrow(
        new RunningWebSocketInterceptorError(
          'Did you forget to call `await interceptor.stop()` before changing the base URL?',
        ),
      );

      expect(interceptor.baseURL).toBe(newBaseURL);

      await interceptor.stop();

      interceptor.baseURL = baseURL;
      expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));
    } finally {
      await interceptor.stop();
    }
  });

  it.each(SUPPORTED_BASE_URL_PROTOCOLS)(
    'should not throw an error if provided a supported base URL protocol (%s)',
    (supportedProtocol) => {
      const supportedBaseURL = baseURL.replace(/^ws/, supportedProtocol);

      const interceptor = createWebSocketInterceptor<MessageSchema>({
        ...interceptorOptions,
        baseURL: supportedBaseURL,
      });

      expect(interceptor.baseURL).toBe(supportedBaseURL.replace(/\/$/, ''));
    },
  );

  const exampleUnsupportedProtocols = ['http', 'https', 'ftp'];

  it.each(exampleUnsupportedProtocols)(
    'should throw an error if provided an unsupported base URL protocol (%s)',
    (unsupportedProtocol) => {
      expect(SUPPORTED_BASE_URL_PROTOCOLS).not.toContain(unsupportedProtocol);

      const unsupportedBaseURL = baseURL.replace(/^ws/, unsupportedProtocol);

      expect(() => {
        createWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, baseURL: unsupportedBaseURL });
      }).toThrow(new UnsupportedURLProtocolError(unsupportedProtocol, SUPPORTED_BASE_URL_PROTOCOLS));
    },
  );

  it('should exclude non-path base URL parameters', () => {
    const baseURLWithNonPathParameters = `${baseURL}?search=value#hash`;

    const interceptor = createWebSocketInterceptor<MessageSchema>({
      ...interceptorOptions,
      baseURL: baseURLWithNonPathParameters,
    });

    expect(interceptor.baseURL).toBe(baseURL.replace(/\/$/, ''));
  });

  it('should throw an error when trying to create a message handler if not running', () => {
    const interceptor = createWebSocketInterceptor<{}>(interceptorOptions);

    expect(interceptor.isRunning).toBe(false);
    expect(() => interceptor.message()).toThrow(new NotRunningWebSocketInterceptorError());
  });

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

  if (type === 'remote') {
    it('should register handler base URLs and resolve pending handlers after the registration completes', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await expectClientToCloseAsUnhandled();

        const handler = interceptor.message().respond({ type: 'server', index: 1 });
        await handler;

        const client = await createClient();
        expect(client.readyState).toBe(WebSocketClient.OPEN);
      });
    });

    it('should reset server registrations after cleared', async () => {
      await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
        await interceptor.message().respond({ type: 'server', index: 1 });

        let client = await createClient();
        expect(client.readyState).toBe(WebSocketClient.OPEN);
        await client.close();

        await interceptor.clear();
        await expectClientToCloseAsUnhandled();

        await interceptor.message().respond({ type: 'server', index: 2 });
        client = await createClient();
        expect(client.readyState).toBe(WebSocketClient.OPEN);
      });
    });

    it('should reset server registrations after stopped', async () => {
      const interceptor = createWebSocketInterceptor<MessageSchema>(interceptorOptions);

      try {
        await interceptor.start();
        await interceptor.message().respond({ type: 'server', index: 1 });

        const client = await createClient();
        expect(client.readyState).toBe(WebSocketClient.OPEN);
        await client.close();

        await interceptor.stop();
        await expectClientToCloseAsUnhandled();
      } finally {
        await interceptor.stop();
      }
    });

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
            'Learn more: https://zimic.dev/docs/interceptor/api/http-message-handler#handlertimes',
          ].join('\n'),
        );
      },
    );
  });

  it('should have the correct default message saving configuration if none is provided', () => {
    const interceptor = createWebSocketInterceptor<MessageSchema>({ ...interceptorOptions, messageSaving: undefined });

    expect(interceptor.messageSaving).toEqual<WebSocketInterceptorMessageSaving>({
      enabled: platform === 'node',
      safeLimit: DEFAULT_MESSAGE_SAVING_SAFE_LIMIT,
    });
  });

  if (type === 'local') {
    it('should warn if saved messages exceed the safe limit', async () => {
      const safeLimit = 2;

      await usingWebSocketInterceptor<MessageSchema>(
        { type: 'local', baseURL, messageSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          const handler = interceptor.message().respond({ type: 'server', index: 1 });
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
        { type: 'local', baseURL, messageSaving: { enabled: true, safeLimit } },
        async (interceptor) => {
          const handler = interceptor.message().respond({ type: 'server', index: 1 });
          const client = await createClient();

          await usingIgnoredConsole(['warn'], async (console) => {
            for (let index = 0; index < 2; index++) {
              client.send(JSON.stringify({ type: 'client', index }));
            }

            await waitFor(() => {
              expect(handler.messages).toHaveLength(2);
            });

            expect(console.warn).toHaveBeenCalledTimes(1);

            interceptor.clear();
            handler.respond({ type: 'server', index: 2 });
            console.warn.mockClear();

            client.send(JSON.stringify({ type: 'client', index: 2 }));

            await waitFor(() => {
              expect(handler.messages).toHaveLength(1);
            });

            expect(console.warn).toHaveBeenCalledTimes(0);
          });
        },
      );
    });
  }
}
