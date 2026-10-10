import { HttpSchema } from '@zimic/http';
import { waitFor, waitForNot } from '@zimic/utils/time';
import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import LocalHttpInterceptorWorker from '@/http/interceptorWorker/LocalHttpInterceptorWorker';
import LocalMSWWorkerStore from '@/interceptor/LocalMSWWorkerStore';
import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import LocalWebSocketInterceptorWorker from '@/ws/interceptorWorker/LocalWebSocketInterceptorWorker';
import RemoteWebSocketInterceptorWorker from '@/ws/interceptorWorker/RemoteWebSocketInterceptorWorker';
import { usingIgnoredConsole } from '@tests/utils/console';
import {
  createInternalWebSocketInterceptor,
  usingHttpInterceptor,
  usingHttpInterceptorWorker,
  usingWebSocketInterceptor,
  usingWebSocketInterceptorWorker,
} from '@tests/utils/interceptors';

import NotRunningWebSocketInterceptorError from '../../../interceptor/errors/NotRunningWebSocketInterceptorError';
import { WebSocketInterceptorPlatform, WebSocketInterceptorType } from '../../../interceptor/types/options';
import { RemoteWebSocketInterceptorWorkerOptions, WebSocketInterceptorWorkerOptions } from '../../types/options';

type ChatMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;
type BinaryMessage = WebSocketSchema<ArrayBuffer>;
type HttpSchemaWithUsers = HttpSchema<{
  '/users': {
    GET: HttpSchema.Method<{
      response: {
        200: {
          body: { users: string[] };
        };
      };
    }>;
  };
}>;

interface SharedWebSocketInterceptorWorkerTestsOptions {
  platform: WebSocketInterceptorPlatform;
  defaultWorkerOptions: WebSocketInterceptorWorkerOptions;
  startServer?: () => PossiblePromise<void>;
  getBaseURL: (type: WebSocketInterceptorType) => PossiblePromise<string>;
  stopServer?: () => PossiblePromise<void>;
}

async function waitForMessage<Schema extends WebSocketSchema>(client: WebSocketClient<Schema>) {
  const event = await new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
    client.addEventListener('message', resolve, { once: true });
  });

  if (typeof event.data === 'string' && /^[{[]/.test(event.data.trim())) {
    return JSON.parse(event.data) as Schema;
  }

  return event.data;
}

async function readBytes(data: Blob | ArrayBuffer) {
  const arrayBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
  return Array.from(new Uint8Array(arrayBuffer));
}

function createBinaryMessage(firstByte: number, secondByte: number) {
  const message = new ArrayBuffer(2);
  const messageView = new Uint8Array(message);
  messageView[0] = firstByte;
  messageView[1] = secondByte;
  return message;
}

export function declareDefaultWebSocketInterceptorWorkerTests(options: SharedWebSocketInterceptorWorkerTestsOptions) {
  const { platform, defaultWorkerOptions, startServer, getBaseURL, stopServer } = options;

  let baseURL: string;
  let httpBaseURL: string;
  let workerOptions: WebSocketInterceptorWorkerOptions;
  let clients: { close: () => Promise<void> }[] = [];

  function createDefaultWebSocketInterceptor() {
    return createInternalWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL });
  }

  beforeAll(async () => {
    if (defaultWorkerOptions.type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(defaultWorkerOptions.type);
    httpBaseURL = baseURL.replace(/^ws/, 'http');
    clients = [];

    workerOptions =
      defaultWorkerOptions.type === 'local'
        ? defaultWorkerOptions
        : { ...defaultWorkerOptions, serverURL: new URL(new URL(baseURL).origin) };
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.close()));
  });

  afterAll(async () => {
    if (defaultWorkerOptions.type === 'remote') {
      await stopServer?.();
    }
  });

  async function createClient<Schema extends WebSocketSchema = ChatMessage>() {
    const client = new WebSocketClient<Schema>(baseURL);
    clients.push(client);

    await client.open();

    return client;
  }

  it('should initialize using the correct worker and platform', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      expect(worker.platform).toBe(null);
      expect(worker).toBeInstanceOf(
        workerOptions.type === 'remote' ? RemoteWebSocketInterceptorWorker : LocalWebSocketInterceptorWorker,
      );

      await worker.start();

      expect(worker.platform).toBe(platform);

      if (worker instanceof LocalWebSocketInterceptorWorker) {
        expect(worker.hasInternalBrowserWorker()).toBe(platform === 'browser');
        expect(worker.hasInternalNodeWorker()).toBe(platform === 'node');
      }
    });
  });

  it('should not throw an error when started multiple times', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      expect(worker.isRunning).toBe(false);
      await worker.start();
      expect(worker.isRunning).toBe(true);
      await worker.start();
      expect(worker.isRunning).toBe(true);
      await worker.start();
      expect(worker.isRunning).toBe(true);
    });
  });

  it('should not throw an error when started multiple times concurrently', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      expect(worker.isRunning).toBe(false);

      await Promise.all(
        Array.from({ length: 5 }).map(async () => {
          await worker.start();
          expect(worker.isRunning).toBe(true);
        }),
      );

      expect(worker.isRunning).toBe(true);
    });
  });

  it('should not throw an error when stopped while not running', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      expect(worker.isRunning).toBe(false);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
    });
  });

  it('should not throw an error when stopped multiple times while running', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      await worker.start();
      expect(worker.isRunning).toBe(true);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
    });
  });

  it('should not throw an error when stopped multiple times concurrently', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      await worker.start();
      expect(worker.isRunning).toBe(true);

      await Promise.all(
        Array.from({ length: 5 }).map(async () => {
          await worker.stop();
          expect(worker.isRunning).toBe(false);
        }),
      );

      expect(worker.isRunning).toBe(false);
    });
  });

  it('should recover after failing to stop', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, async (worker) => {
      const error = new Error('Unknown error');

      // Reject a shutdown dependency because normal worker shutdown does not fail.
      if (worker instanceof LocalWebSocketInterceptorWorker) {
        vi.spyOn(worker, 'getMSWWorkerOrCreate').mockRejectedValueOnce(error);
      } else {
        vi.spyOn(worker.webSocketClient, 'stop').mockRejectedValueOnce(error);
      }

      await expect(worker.stop()).rejects.toThrow(error);
      expect(worker.isRunning).toBe(true);

      await worker.stop();
      expect(worker.isRunning).toBe(false);

      await worker.start();
      expect(worker.isRunning).toBe(true);
    });
  });

  it('should throw an error if trying to use an interceptor without a running worker', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      const interceptor = createDefaultWebSocketInterceptor();

      expect(worker.isRunning).toBe(false);

      await expect(async () => {
        await worker.use(interceptor.implementation);
      }).rejects.toThrow(new NotRunningWebSocketInterceptorError());
    });
  });

  it('should throw an error if trying to clear handlers without a running worker', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      expect(worker.isRunning).toBe(false);

      await expect(async () => {
        await worker.clearHandlers();
      }).rejects.toThrow(new NotRunningWebSocketInterceptorError());
    });
  });

  it('should throw an error if trying to clear interceptor handlers without a running worker', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      const interceptor = createDefaultWebSocketInterceptor();

      expect(worker.isRunning).toBe(false);

      await expect(async () => {
        await worker.clearHandlers({ interceptor: interceptor.implementation });
      }).rejects.toThrow(new NotRunningWebSocketInterceptorError());
    });
  });

  it('should pass client messages through handler matching and replies', async () => {
    await usingWebSocketInterceptor<ChatMessage>(
      { type: workerOptions.type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor
          .message()
          .with({ type: 'client' })
          .respond((message) => ({ type: 'server', text: `received ${message.text}` }))
          .times(1);

        const client = await createClient();
        const messagePromise = waitForMessage(client);

        client.send(JSON.stringify({ type: 'client', text: 'one' }));

        await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'received one' });
        expect(handler.messages).toHaveLength(1);
        expect(handler.messages[0].data).toEqual({ type: 'client', text: 'one' });

        await handler.checkTimes();
      },
    );
  });

  it('should broadcast server messages to connected clients', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'server', text: 'unused' });

      const firstClient = await createClient();
      const secondClient = await createClient();

      const firstMessagePromise = waitForMessage(firstClient);
      const secondMessagePromise = waitForMessage(secondClient);

      await waitFor(() => {
        expect(interceptor.clients).toHaveLength(2);
      });

      interceptor.server.send(JSON.stringify({ type: 'server', text: 'hello clients' }));

      await expect(firstMessagePromise).resolves.toEqual({ type: 'server', text: 'hello clients' });
      await expect(secondMessagePromise).resolves.toEqual({ type: 'server', text: 'hello clients' });
    });
  });

  it('should target server messages to a connected client', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL }, async (interceptor) => {
      await interceptor.message().effect((message) => {
        const [, secondClient] = interceptor.clients;
        secondClient.send(JSON.stringify({ type: 'server', text: `targeted ${message.text}` }));
      });

      const firstClient = await createClient();
      const secondClient = await createClient();
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

  it('should route binary messages between clients and handlers', async () => {
    await usingWebSocketInterceptor<BinaryMessage>(
      { type: workerOptions.type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const requestMessage = createBinaryMessage(0xff, 0x00);
        const responseMessage = createBinaryMessage(0x00, 0xff);

        const handler = await interceptor.message().with(requestMessage).respond(responseMessage).times(1);

        const client = await createClient<BinaryMessage>();
        client.binaryType = 'arraybuffer';
        const messagePromise = waitForMessage(client);

        client.send(requestMessage);

        const message = await messagePromise;
        expect(await readBytes(message as Blob | ArrayBuffer)).toEqual([0x00, 0xff]);

        expect(handler.messages).toHaveLength(1);
        expect(await readBytes(handler.messages[0].data)).toEqual([0xff, 0x00]);

        await handler.checkTimes();
      },
    );
  });

  it('should track clients when they open and close', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'server', text: 'unused' });
      expect(interceptor.clients).toHaveLength(0);

      const client = await createClient();

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

  it('should reset registered handlers after clear', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'server', text: 'one' });

      let client = await createClient();
      const messagePromise = waitForMessage(client);
      client.send(JSON.stringify({ type: 'client', text: 'one' }));
      await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'one' });
      await client.close();

      await interceptor.clear();

      client = await createClient();
      const messageListener = vi.fn();
      client.addEventListener('message', messageListener);

      client.send(JSON.stringify({ type: 'client', text: 'two' }));

      await waitForNot(() => {
        expect(messageListener).toHaveBeenCalled();
      });
    });
  });

  it('should reset registered handlers after stop', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'server', text: 'one' });

      const client = await createClient();
      const messagePromise = waitForMessage(client);
      client.send(JSON.stringify({ type: 'client', text: 'one' }));
      await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'one' });

      await interceptor.stop();
      await interceptor.start();
      await interceptor.message().with({ type: 'server' });

      const nextClient = await createClient();
      const messageListener = vi.fn();
      nextClient.addEventListener('message', messageListener);

      nextClient.send(JSON.stringify({ type: 'client', text: 'two' }));

      await waitForNot(() => {
        expect(messageListener).toHaveBeenCalled();
      });
    });
  });

  it('should not handle messages from existing clients after stopped', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'server', text: 'one' });

      const client = await createClient();

      await waitFor(() => {
        expect(interceptor.clients).toHaveLength(1);
      });

      await interceptor.stop();
      expect(interceptor.clients).toHaveLength(0);

      const messageListener = vi.fn();
      client.addEventListener('message', messageListener);

      client.send(JSON.stringify({ type: 'client', text: 'two' }));

      await waitForNot(() => {
        expect(messageListener).toHaveBeenCalled();
      });

      expect(interceptor.clients).toHaveLength(0);
    });
  });

  it('should route messages using path discriminators', async () => {
    const firstBaseURL = `${baseURL}/first`;
    const secondBaseURL = `${baseURL}/second`;
    await usingWebSocketInterceptor<ChatMessage>(
      { type: workerOptions.type, baseURL: firstBaseURL },
      { start: false },
      async (firstInterceptor) => {
        await usingWebSocketInterceptor<ChatMessage>(
          { type: workerOptions.type, baseURL: secondBaseURL },
          { start: false },
          async (secondInterceptor) => {
            await Promise.all([firstInterceptor.start(), secondInterceptor.start()]);
            await firstInterceptor.message().respond({ type: 'server', text: 'first' });
            await secondInterceptor.message().respond({ type: 'server', text: 'second' });

            const firstClient = new WebSocketClient<ChatMessage>(firstBaseURL);
            const secondClient = new WebSocketClient<ChatMessage>(secondBaseURL);
            clients.push(firstClient, secondClient);

            await Promise.all([firstClient.open(), secondClient.open()]);

            const firstMessagePromise = waitForMessage(firstClient);
            const secondMessagePromise = waitForMessage(secondClient);

            firstClient.send(JSON.stringify({ type: 'client', text: 'one' }));
            secondClient.send(JSON.stringify({ type: 'client', text: 'two' }));

            await expect(firstMessagePromise).resolves.toEqual({ type: 'server', text: 'first' });
            await expect(secondMessagePromise).resolves.toEqual({ type: 'server', text: 'second' });
          },
        );
      },
    );
  });

  if (defaultWorkerOptions.type === 'local') {
    it('should stop and rethrow after a shared startup failure', async () => {
      const error = new Error('Shared startup failed.');

      await usingWebSocketInterceptorWorker({ type: 'local' }, { start: false }, async (worker) => {
        expect(worker).toBeInstanceOf(LocalWebSocketInterceptorWorker);

        if (!(worker instanceof LocalWebSocketInterceptorWorker)) {
          throw new Error('Expected a local WebSocket interceptor worker.');
        }

        // This concrete store boundary runs for both fresh and already-running browser workers.
        const startMSWWorkerSpy = vi
          .spyOn(LocalMSWWorkerStore.prototype, 'startMSWWorker')
          .mockRejectedValueOnce(error);
        const stopSpy = vi.spyOn(worker, 'stop');

        try {
          await usingIgnoredConsole(['error'], async (console) => {
            await expect(worker.start()).rejects.toThrow(error);

            if (platform === 'node') {
              expect(console.error).toHaveBeenCalledWith(error);
            } else {
              expect(console.error).not.toHaveBeenCalled();
            }
          });

          expect(startMSWWorkerSpy).toHaveBeenCalledTimes(1);
          expect(stopSpy).toHaveBeenCalledTimes(1);
          expect(worker.platform).toBe(platform);
          expect(worker.isRunning).toBe(false);
        } finally {
          startMSWWorkerSpy.mockRestore();
          stopSpy.mockRestore();
        }
      });
    });

    it('should expose local worker internals consistently', async () => {
      await usingWebSocketInterceptorWorker({ type: 'local' }, { start: false }, (worker) => {
        expect(worker).toBeInstanceOf(LocalWebSocketInterceptorWorker);

        if (!(worker instanceof LocalWebSocketInterceptorWorker)) {
          throw new Error('Expected a local WebSocket interceptor worker.');
        }

        expect(worker.class).toBe(LocalWebSocketInterceptorWorker);
        expect(typeof worker.class.isMSWWorkerRunning).toBe('boolean');
      });
    });

    it('should keep the shared worker running while another WebSocket interceptor is active', async () => {
      const firstBaseURL = `${baseURL}/first`;
      const secondBaseURL = `${baseURL}/second`;
      await usingWebSocketInterceptor<ChatMessage>(
        { type: 'local', baseURL: firstBaseURL },
        { start: false },
        async (firstInterceptor) => {
          await usingWebSocketInterceptor<ChatMessage>(
            { type: 'local', baseURL: secondBaseURL },
            { start: false },
            async (secondInterceptor) => {
              await Promise.all([firstInterceptor.start(), secondInterceptor.start()]);
              firstInterceptor.message().respond({ type: 'server', text: 'first' });
              secondInterceptor.message().respond({ type: 'server', text: 'second' });

              await firstInterceptor.stop();

              const secondClient = new WebSocketClient<ChatMessage>(secondBaseURL);
              clients.push(secondClient);

              await secondClient.open();
              const messagePromise = waitForMessage(secondClient);
              secondClient.send(JSON.stringify({ type: 'client', text: 'two' }));

              await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'second' });
            },
          );
        },
      );
    });

    it('should send messages to a targeted client through the local worker', async () => {
      await usingWebSocketInterceptorWorker({ type: 'local' }, async (worker) => {
        const interceptor = createDefaultWebSocketInterceptor();
        await worker.use(interceptor.implementation);

        const client = await createClient();

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const messagePromise = waitForMessage(client);
        await worker.sendToClient(
          interceptor.implementation.clients[0],
          JSON.stringify({ type: 'server', text: 'targeted' }),
        );

        await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'targeted' });
      });
    });

    it('should ignore broadcasts through the local worker without a registered handler', async () => {
      await usingWebSocketInterceptorWorker({ type: 'local' }, (worker) => {
        expect(worker).toBeInstanceOf(LocalWebSocketInterceptorWorker);

        if (!(worker instanceof LocalWebSocketInterceptorWorker)) {
          throw new Error('Expected a local WebSocket interceptor worker.');
        }

        const interceptor = createDefaultWebSocketInterceptor();

        expect(() => {
          worker.sendToClients(interceptor.implementation, JSON.stringify({ type: 'server', text: 'ignored' }));
        }).not.toThrow();
      });
    });

    it.each(['http-first', 'webSocket-first'] as const)(
      'should share the MSW worker instance with HTTP interceptors when started %s',
      async (startOrder) => {
        await usingHttpInterceptorWorker({ type: 'local' }, { start: false }, async (httpWorker) => {
          expect(httpWorker).toBeInstanceOf(LocalHttpInterceptorWorker);
          if (!(httpWorker instanceof LocalHttpInterceptorWorker)) {
            throw new Error('Expected a local HTTP interceptor worker.');
          }

          await usingWebSocketInterceptorWorker({ type: 'local' }, { start: false }, async (webSocketWorker) => {
            expect(webSocketWorker).toBeInstanceOf(LocalWebSocketInterceptorWorker);
            if (!(webSocketWorker instanceof LocalWebSocketInterceptorWorker)) {
              throw new Error('Expected a local WebSocket interceptor worker.');
            }

            if (startOrder === 'http-first') {
              await httpWorker.start();
              await webSocketWorker.start();
            } else {
              await webSocketWorker.start();
              await httpWorker.start();
            }

            const httpMSWWorker = await httpWorker.getMSWWorkerOrCreate();
            const webSocketMSWWorker = await webSocketWorker.getMSWWorkerOrCreate();

            // Both protocol workers must share one MSW instance so either can keep the other active.
            expect(webSocketMSWWorker).toBe(httpMSWWorker);
          });
        });
      },
    );

    it('should start the shared MSW worker only once when HTTP and WebSocket workers start concurrently', async () => {
      await usingHttpInterceptorWorker({ type: 'local' }, { start: false }, async (httpWorker) => {
        expect(httpWorker).toBeInstanceOf(LocalHttpInterceptorWorker);
        if (!(httpWorker instanceof LocalHttpInterceptorWorker)) {
          throw new Error('Expected a local HTTP interceptor worker.');
        }

        await usingWebSocketInterceptorWorker({ type: 'local' }, { start: false }, async (webSocketWorker) => {
          expect(webSocketWorker).toBeInstanceOf(LocalWebSocketInterceptorWorker);
          if (!(webSocketWorker instanceof LocalWebSocketInterceptorWorker)) {
            throw new Error('Expected a local WebSocket interceptor worker.');
          }

          const mswWorker = await httpWorker.getMSWWorkerOrCreate();
          // Keep the real startup call while counting it to catch duplicate starts.
          const startSpy = 'start' in mswWorker ? vi.spyOn(mswWorker, 'start') : vi.spyOn(mswWorker, 'listen');
          const wasMSWWorkerRunning = webSocketWorker.class.isMSWWorkerRunning;

          await Promise.all([httpWorker.start(), webSocketWorker.start()]);

          const webSocketMSWWorker = await webSocketWorker.getMSWWorkerOrCreate();

          expect(webSocketMSWWorker).toBe(mswWorker);
          expect(startSpy).toHaveBeenCalledTimes(wasMSWWorkerRunning ? 0 : 1);
        });
      });
    });

    it('should clean up the shared MSW worker only after the final protocol worker stops', async () => {
      await usingHttpInterceptorWorker({ type: 'local' }, { start: false }, async (httpWorker) => {
        expect(httpWorker).toBeInstanceOf(LocalHttpInterceptorWorker);
        if (!(httpWorker instanceof LocalHttpInterceptorWorker)) {
          throw new Error('Expected a local HTTP interceptor worker.');
        }

        await usingWebSocketInterceptorWorker({ type: 'local' }, { start: false }, async (webSocketWorker) => {
          expect(webSocketWorker).toBeInstanceOf(LocalWebSocketInterceptorWorker);
          if (!(webSocketWorker instanceof LocalWebSocketInterceptorWorker)) {
            throw new Error('Expected a local WebSocket interceptor worker.');
          }

          const mswWorker = await httpWorker.getMSWWorkerOrCreate();
          // Keep the real cleanup call while checking that the shared worker stops only with its last owner.
          const cleanupSpy = 'stop' in mswWorker ? vi.spyOn(mswWorker, 'stop') : vi.spyOn(mswWorker, 'close');

          await httpWorker.start();
          await webSocketWorker.start();

          await httpWorker.stop();

          expect(cleanupSpy).not.toHaveBeenCalled();
          expect(webSocketWorker.class.isMSWWorkerRunning).toBe(true);

          await webSocketWorker.stop();

          // Browser service workers stay registered after the protocol workers release them.
          expect(cleanupSpy).toHaveBeenCalledTimes(platform === 'node' ? 1 : 0);
          expect(webSocketWorker.class.isMSWWorkerRunning).toBe(platform === 'browser');
        });
      });
    });

    it('should not duplicate handlers when an interceptor is started concurrently', async () => {
      await usingWebSocketInterceptor<ChatMessage>(
        { type: 'local', baseURL },
        { start: false },
        async (interceptor) => {
          await Promise.all([interceptor.start(), interceptor.start(), interceptor.start()]);

          interceptor.message().respond({ type: 'server', text: 'one' });

          const client = await createClient();
          const messageListener = vi.fn();
          client.addEventListener('message', messageListener);

          client.send(JSON.stringify({ type: 'client', text: 'one' }));

          await waitFor(() => {
            expect(messageListener).toHaveBeenCalledTimes(1);
          });
        },
      );
    });

    it('should not reply to unmatched client messages', async () => {
      await usingWebSocketInterceptor<ChatMessage>({ type: 'local', baseURL }, async (interceptor) => {
        interceptor.message().with({ type: 'server' }).respond({ type: 'server', text: 'unmatched' });

        const client = await createClient();
        const messageListener = vi.fn();
        client.addEventListener('message', messageListener);

        client.send(JSON.stringify({ type: 'client', text: 'one' }));

        await waitForNot(() => {
          expect(messageListener).toHaveBeenCalled();
        });
      });
    });

    it('should keep HTTP handlers running after clearing a WebSocket interceptor', async () => {
      await usingHttpInterceptor<HttpSchemaWithUsers>(
        { type: 'local', baseURL: httpBaseURL },
        { start: false },
        async (httpInterceptor) => {
          await usingWebSocketInterceptor<ChatMessage>(
            { type: 'local', baseURL },
            { start: false },
            async (webSocketInterceptor) => {
              await httpInterceptor.start();
              httpInterceptor.get('/users').respond({ status: 200, body: { users: ['one'] } });

              await webSocketInterceptor.start();
              webSocketInterceptor.message().respond({ type: 'server', text: 'one' });

              webSocketInterceptor.clear();

              const response = await fetch(`${httpBaseURL}/users`);
              await expect(response.json()).resolves.toEqual({ users: ['one'] });
              expect(LocalWebSocketInterceptorWorker.isMSWWorkerRunning).toBe(true);
            },
          );
        },
      );
    });

    it('should keep WebSocket handlers running after clearing an HTTP interceptor', async () => {
      await usingHttpInterceptor<HttpSchemaWithUsers>(
        { type: 'local', baseURL: httpBaseURL },
        { start: false },
        async (httpInterceptor) => {
          await usingWebSocketInterceptor<ChatMessage>(
            { type: 'local', baseURL },
            { start: false },
            async (webSocketInterceptor) => {
              await httpInterceptor.start();
              httpInterceptor.get('/users').respond({ status: 200, body: { users: ['one'] } });

              await webSocketInterceptor.start();
              webSocketInterceptor
                .message()
                .respond((message) => ({ type: 'server', text: `received ${message.text}` }));

              httpInterceptor.clear();

              const client = await createClient();
              const messagePromise = waitForMessage(client);
              client.send(JSON.stringify({ type: 'client', text: 'one' }));

              await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'received one' });
              expect(LocalWebSocketInterceptorWorker.isMSWWorkerRunning).toBe(true);
            },
          );
        },
      );
    });

    it('should keep HTTP handlers running after stopping a WebSocket interceptor', async () => {
      await usingHttpInterceptor<HttpSchemaWithUsers>(
        { type: 'local', baseURL: httpBaseURL },
        { start: false },
        async (httpInterceptor) => {
          await usingWebSocketInterceptor<ChatMessage>(
            { type: 'local', baseURL },
            { start: false },
            async (webSocketInterceptor) => {
              await httpInterceptor.start();
              httpInterceptor.get('/users').respond({ status: 200, body: { users: ['one'] } });

              await webSocketInterceptor.start();
              webSocketInterceptor.message().respond({ type: 'server', text: 'one' });

              const client = await createClient();
              const messagePromise = waitForMessage(client);
              client.send(JSON.stringify({ type: 'client', text: 'one' }));
              await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'one' });

              await webSocketInterceptor.stop();

              const response = await fetch(`${httpBaseURL}/users`);
              await expect(response.json()).resolves.toEqual({ users: ['one'] });
              expect(LocalWebSocketInterceptorWorker.isMSWWorkerRunning).toBe(true);
            },
          );
        },
      );
    });

    it('should keep WebSocket handlers running after stopping an HTTP interceptor', async () => {
      await usingHttpInterceptor<HttpSchemaWithUsers>(
        { type: 'local', baseURL: httpBaseURL },
        { start: false },
        async (httpInterceptor) => {
          await usingWebSocketInterceptor<ChatMessage>(
            { type: 'local', baseURL },
            { start: false },
            async (webSocketInterceptor) => {
              await httpInterceptor.start();
              httpInterceptor.get('/users').respond({ status: 200, body: { users: ['one'] } });

              await webSocketInterceptor.start();
              webSocketInterceptor
                .message()
                .respond((message) => ({ type: 'server', text: `received ${message.text}` }));

              const response = await fetch(`${httpBaseURL}/users`);
              await expect(response.json()).resolves.toEqual({ users: ['one'] });

              await httpInterceptor.stop();

              const client = await createClient();
              const messagePromise = waitForMessage(client);
              client.send(JSON.stringify({ type: 'client', text: 'one' }));

              await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'received one' });
              expect(LocalWebSocketInterceptorWorker.isMSWWorkerRunning).toBe(true);
            },
          );
        },
      );
    });
  }

  if (defaultWorkerOptions.type === 'remote') {
    it('should reject remote clients if the referenced handler no longer exists', async () => {
      await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (rawWorker) => {
        expect(rawWorker).toBeInstanceOf(RemoteWebSocketInterceptorWorker);
        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        await worker.start();
        const interceptor = createDefaultWebSocketInterceptor();
        await worker.use(interceptor.implementation);

        // Suppress this reset RPC because the interceptor was not registered; the test covers the later rejected handshake.
        const resetRequestSpy = vi.spyOn(worker.webSocketClient, 'request').mockResolvedValueOnce({});
        await worker.clearHandlers({ interceptor: interceptor.implementation });
        resetRequestSpy.mockRestore();

        const client = new WebSocketClient<ChatMessage>(baseURL);
        clients.push(client);
        const closeEventPromise = new Promise<WebSocketClient.CloseEvent<ChatMessage>>((resolve) => {
          client.addEventListener('close', resolve, { once: true });
        });

        await client.open();

        const closeEvent = await closeEventPromise;
        expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
        expect(closeEvent.reason).toBe('Could not connect to the WebSocket interceptor.');
      });
    });

    it('should handle messages sent immediately after a remote client opens', async () => {
      await usingWebSocketInterceptor<ChatMessage>({ type: 'remote', baseURL }, async (interceptor) => {
        const handledMessages: ChatMessage[] = [];
        const handler = interceptor
          .message()
          .effect((message) => {
            handledMessages.push(message);
          })
          .times(2);
        await handler;

        const client = new WebSocketClient<ChatMessage>(baseURL);
        clients.push(client);

        await client.open();
        client.send(JSON.stringify({ type: 'client', text: 'first' }));
        client.send(JSON.stringify({ type: 'client', text: 'second' }));

        await waitFor(() => {
          expect(handledMessages).toEqual([
            { type: 'client', text: 'first' },
            { type: 'client', text: 'second' },
          ]);
        });
      });
    });

    it('should start with authentication options', async () => {
      const remoteWorkerOptions = workerOptions as RemoteWebSocketInterceptorWorkerOptions;
      await usingWebSocketInterceptorWorker(
        { ...remoteWorkerOptions, auth: { token: 'test-token' } },
        { start: false },
        async (rawWorker) => {
          expect(rawWorker).toBeInstanceOf(RemoteWebSocketInterceptorWorker);
          const worker = rawWorker as RemoteWebSocketInterceptorWorker;
          await worker.start();

          expect(worker.isRunning).toBe(true);
        },
      );
    });

    it('should ignore sends without a registered remote client or handler', async () => {
      await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (rawWorker) => {
        expect(rawWorker).toBeInstanceOf(RemoteWebSocketInterceptorWorker);
        await rawWorker.start();
        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        const interceptor = createDefaultWebSocketInterceptor();
        const client = interceptor.implementation.createClient(baseURL, { send: () => undefined });

        await expect(
          worker.sendToClient(client, JSON.stringify({ type: 'server', text: 'ignored client' })),
        ).resolves.toBeUndefined();
        await expect(
          worker.sendToClients(interceptor.implementation, JSON.stringify({ type: 'server', text: 'ignored handler' })),
        ).resolves.toBeUndefined();
      });
    });

    it('should preserve functioning remote handlers after clearing another interceptor', async () => {
      await usingWebSocketInterceptor<ChatMessage>(
        { type: 'remote', baseURL: `${baseURL}/first` },
        { start: false },
        async (firstInterceptor) => {
          await usingWebSocketInterceptor<ChatMessage>(
            { type: 'remote', baseURL: `${baseURL}/second` },
            { start: false },
            async (secondInterceptor) => {
              await Promise.all([firstInterceptor.start(), secondInterceptor.start()]);
              await firstInterceptor.message().respond({ type: 'server', text: 'first' });
              await secondInterceptor.message().respond({ type: 'server', text: 'second' });

              const firstClient = new WebSocketClient<ChatMessage>(firstInterceptor.baseURL);
              const secondClient = new WebSocketClient<ChatMessage>(secondInterceptor.baseURL);
              const firstClientClosed = new Promise<void>((resolve) => {
                firstClient.addEventListener('close', () => resolve(), { once: true });
              });
              clients.push(firstClient, secondClient);

              await Promise.all([firstClient.open(), secondClient.open()]);
              await waitFor(() => expect(firstInterceptor.clients).toHaveLength(1));
              await waitFor(() => expect(secondInterceptor.clients).toHaveLength(1));

              await firstInterceptor.clear();

              await firstClientClosed;
              expect(firstClient.readyState).toBe(WebSocketClient.CLOSED);
              expect(secondClient.readyState).toBe(WebSocketClient.OPEN);
              expect(secondInterceptor.clients).toHaveLength(1);

              const responsePromise = waitForMessage(secondClient);
              secondClient.send(JSON.stringify({ type: 'client', text: 'still active' }));
              await expect(responsePromise).resolves.toEqual({ type: 'server', text: 'second' });
            },
          );
        },
      );
    });

    it('should not throw an error if trying to clear handlers without a running web socket client', async () => {
      await usingWebSocketInterceptorWorker(workerOptions, async (rawWorker) => {
        expect(rawWorker).toBeInstanceOf(RemoteWebSocketInterceptorWorker);

        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        expect(worker.isRunning).toBe(true);
        expect(worker.webSocketClient.isRunning).toBe(true);

        await worker.webSocketClient.stop();

        expect(worker.isRunning).toBe(true);
        expect(worker.webSocketClient.isRunning).toBe(false);

        await expect(worker.clearHandlers()).resolves.not.toThrow();
      });
    });

    it('should not throw an error if trying to clear interceptor handlers without a running web socket client', async () => {
      await usingWebSocketInterceptorWorker(workerOptions, async (rawWorker) => {
        expect(rawWorker).toBeInstanceOf(RemoteWebSocketInterceptorWorker);

        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        expect(worker.isRunning).toBe(true);
        expect(worker.webSocketClient.isRunning).toBe(true);

        await worker.webSocketClient.stop();

        expect(worker.isRunning).toBe(true);
        expect(worker.webSocketClient.isRunning).toBe(false);

        const interceptor = createDefaultWebSocketInterceptor();

        await expect(worker.clearHandlers({ interceptor: interceptor.implementation })).resolves.not.toThrow();
      });
    });

    it('should keep a pending public handler unsynced until the server acknowledges its commit', async () => {
      await usingWebSocketInterceptor<ChatMessage>({ type: 'remote', baseURL }, async (interceptor) => {
        const worker = (
          interceptor as typeof interceptor & { implementation: { worker: RemoteWebSocketInterceptorWorker } }
        ).implementation.worker;
        let acknowledgeCommit: ((acknowledgment: {}) => void) | undefined;
        const commitAcknowledgment = new Promise<{}>((resolve) => {
          acknowledgeCommit = resolve;
        });

        // Hold the commit acknowledgment to keep the public handler pending.
        vi.spyOn(worker.webSocketClient, 'request').mockReturnValueOnce(commitAcknowledgment);

        const pendingHandler = interceptor.message().respond({ type: 'server', text: 'acknowledged' });
        let isHandlerSettled = false;
        const handlerResult = Promise.resolve(pendingHandler).then(
          () => {
            isHandlerSettled = true;
          },
          () => {
            isHandlerSettled = true;
          },
        );

        try {
          await Promise.resolve();
          expect(isHandlerSettled).toBe(false);
        } finally {
          acknowledgeCommit?.({});
        }

        await handlerResult;
        expect(isHandlerSettled).toBe(true);
      });
    });

    it('should reject a failed public handler and recover with a responding handler', async () => {
      await usingWebSocketInterceptor<ChatMessage>({ type: 'remote', baseURL }, async (interceptor) => {
        const worker = (
          interceptor as typeof interceptor & { implementation: { worker: RemoteWebSocketInterceptorWorker } }
        ).implementation.worker;
        const commitError = new Error('Commit failed');

        // Reject the next commit acknowledgment to exercise recovery through a new public handler.
        vi.spyOn(worker.webSocketClient, 'request').mockRejectedValueOnce(commitError);

        await expect(interceptor.message().respond({ type: 'server', text: 'failed' })).rejects.toThrow(commitError);
        await interceptor.message().respond({ type: 'server', text: 'recovered' });

        const client = await createClient();
        const responsePromise = waitForMessage(client);
        client.send(JSON.stringify({ type: 'client', text: 'recovery' }));

        await expect(responsePromise).resolves.toEqual({ type: 'server', text: 'recovered' });
      });
    });
  }
}
