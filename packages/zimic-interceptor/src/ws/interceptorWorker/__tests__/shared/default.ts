import { HttpSchema } from '@zimic/http';
import { waitFor } from '@zimic/utils/time';
import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import LocalHttpInterceptorWorker from '@/http/interceptorWorker/LocalHttpInterceptorWorker';
import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import { createWebSocketInterceptorClient } from '@/ws/interceptor/WebSocketInterceptorHandle';
import WebSocketInterceptorImplementation from '@/ws/interceptor/WebSocketInterceptorImplementation';
import { createWebSocketInterceptorWorker } from '@/ws/interceptorWorker/factory';
import LocalWebSocketInterceptorWorker from '@/ws/interceptorWorker/LocalWebSocketInterceptorWorker';
import RemoteWebSocketInterceptorWorker from '@/ws/interceptorWorker/RemoteWebSocketInterceptorWorker';
import WebSocketInterceptorWorker from '@/ws/interceptorWorker/WebSocketInterceptorWorker';
import RemoteWebSocketMessageHandler from '@/ws/messageHandler/RemoteWebSocketMessageHandler';
import { usingIgnoredConsole } from '@tests/utils/console';
import {
  createInternalWebSocketInterceptor,
  usingHttpInterceptor,
  usingHttpInterceptorWorker,
  usingWebSocketInterceptor,
  usingWebSocketInterceptorWorker,
} from '@tests/utils/interceptors';
import {
  usingWebSocketClient,
  waitForWebSocketClientClose,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import NotRunningWebSocketInterceptorError from '../../../interceptor/errors/NotRunningWebSocketInterceptorError';
import { WebSocketInterceptorPlatform, WebSocketInterceptorType } from '../../../interceptor/types/options';
import { RemoteWebSocketInterceptorWorkerOptions, WebSocketInterceptorWorkerOptions } from '../../types/options';

type ChatMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;

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
  type: WebSocketInterceptorType;
  startServer?: () => PossiblePromise<void>;
  getBaseURL: (type: WebSocketInterceptorType) => PossiblePromise<string>;
  stopServer?: () => PossiblePromise<void>;
}

export function declareDefaultWebSocketInterceptorWorkerTests(options: SharedWebSocketInterceptorWorkerTestsOptions) {
  const { platform, type, startServer, getBaseURL, stopServer } = options;

  let baseURL: string;
  let httpBaseURL: string;
  let workerOptions: WebSocketInterceptorWorkerOptions;

  function createDefaultWebSocketInterceptor() {
    return createInternalWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL });
  }

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);
    httpBaseURL = baseURL.replace(/^ws/, 'http');

    workerOptions = type === 'local' ? { type } : { type, serverURL: new URL(new URL(baseURL).origin) };
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  it('should initialize using the correct worker and platform', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      expect(worker.platform).toBe(null);
      expect(worker).toBeInstanceOf(WebSocketInterceptorWorker);
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

  it('should throw an error after failing to start due to an unknown error', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      const error = new Error('Unknown error');

      if (worker instanceof LocalWebSocketInterceptorWorker) {
        vi.spyOn(worker, 'getMSWWorkerOrCreate').mockRejectedValueOnce(error);
      } else {
        vi.spyOn(worker.webSocketClient, 'start').mockRejectedValueOnce(error);
      }

      await usingIgnoredConsole(['error'], async (console) => {
        await expect(worker.start()).rejects.toThrow(error);

        // In the browser, unhandled promise rejections are logged automatically, so the worker does not log them.
        if (platform === 'node') {
          expect(console.error).toHaveBeenCalledTimes(1);
          expect(console.error).toHaveBeenCalledWith(error);
        } else {
          expect(console.error).not.toHaveBeenCalled();
        }
      });

      expect(worker.isRunning).toBe(false);
    });
  });

  it('should support starting again after failing to start at first', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      const error = new Error('Unknown error');

      const startSpy =
        worker instanceof LocalWebSocketInterceptorWorker
          ? vi.spyOn(worker, 'getMSWWorkerOrCreate')
          : vi.spyOn(worker.webSocketClient, 'start');

      startSpy.mockRejectedValueOnce(error);

      try {
        await usingIgnoredConsole(['error'], async () => {
          await expect(worker.start()).rejects.toThrow(error);
        });

        expect(worker.isRunning).toBe(false);

        await worker.start();
        expect(worker.isRunning).toBe(true);
      } finally {
        startSpy.mockRestore();
      }
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
    await usingWebSocketInterceptorWorker(workerOptions, async (worker) => {
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
    await usingWebSocketInterceptorWorker(workerOptions, async (worker) => {
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

  it('should support retrying after failing to stop', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, async (worker) => {
      expect(worker.isRunning).toBe(true);

      const error = new Error('Unknown error');

      // Stopping normally does not fail. To simulate a failure, we need to mock a stop dependency to throw an error.
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

  it('should support being started while stopping', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, async (worker) => {
      await Promise.all([worker.stop(), worker.start()]);

      expect(worker.isRunning).toBe(true);
    });
  });

  it('should throw an error if trying to use an interceptor without a running worker', async () => {
    await usingWebSocketInterceptorWorker(workerOptions, { start: false }, async (worker) => {
      expect(worker.isRunning).toBe(false);

      const interceptor = createDefaultWebSocketInterceptor();

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
      expect(worker.isRunning).toBe(false);

      const interceptor = createDefaultWebSocketInterceptor();

      await expect(async () => {
        await worker.clearHandlers({ interceptor: interceptor.implementation });
      }).rejects.toThrow(new NotRunningWebSocketInterceptorError());
    });
  });

  if (type === 'local') {
    it('should expose local worker internals consistently', () => {
      const worker = createWebSocketInterceptorWorker({ type: 'local' });

      expect(worker).toBeInstanceOf(LocalWebSocketInterceptorWorker);

      const localWorker = worker;
      expect(localWorker.class).toBe(LocalWebSocketInterceptorWorker);
      expect(typeof localWorker.class.isMSWWorkerRunning).toBe('boolean');
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

              await usingWebSocketClient<ChatMessage>(secondBaseURL, async (secondClient) => {
                const messagePromise = waitForWebSocketClientMessage(secondClient);
                secondClient.send(JSON.stringify({ type: 'client', text: 'two' }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', text: 'second' }));
              });
            },
          );
        },
      );
    });

    it('should ignore broadcasts through the local worker without a registered handler', async () => {
      await usingWebSocketInterceptorWorker({ type: 'local' }, (worker) => {
        const interceptor = createDefaultWebSocketInterceptor();

        expect(() => {
          worker.sendToClients(interceptor.implementation, JSON.stringify({ type: 'server', text: 'ignored' }));
        }).not.toThrow();
      });
    });

    // Successful HTTP requests and WebSocket messages cannot show that both protocols use one MSW instance, so the
    // identity is asserted directly. Two instances would let one protocol's start or stop tear down the other's
    // handlers.
    it.each(['http-first', 'webSocket-first'] as const)(
      'should share the MSW worker instance with HTTP interceptors when started %s',
      async (startOrder) => {
        await usingHttpInterceptorWorker({ type: 'local' }, { start: false }, async (rawHttpWorker) => {
          await usingWebSocketInterceptorWorker({ type: 'local' }, { start: false }, async (webSocketWorker) => {
            const httpWorker = rawHttpWorker as LocalHttpInterceptorWorker;

            if (startOrder === 'http-first') {
              await httpWorker.start();
              await webSocketWorker.start();
            } else {
              await webSocketWorker.start();
              await httpWorker.start();
            }

            const httpMSWWorker = await httpWorker.getMSWWorkerOrCreate();
            const webSocketMSWWorker = await webSocketWorker.getMSWWorkerOrCreate();

            expect(webSocketMSWWorker).toBe(httpMSWWorker);
          });
        });
      },
    );

    // The spy calls through and only counts starts of the shared instance. Requests and messages work the same after a
    // duplicate start, so the call count is the only way to detect it when both workers start concurrently.
    it('should start the shared MSW worker only once when HTTP and WebSocket workers start concurrently', async () => {
      await usingHttpInterceptorWorker({ type: 'local' }, { start: false }, async (rawHttpWorker) => {
        await usingWebSocketInterceptorWorker({ type: 'local' }, { start: false }, async (webSocketWorker) => {
          const httpWorker = rawHttpWorker as LocalHttpInterceptorWorker;

          const mswWorker = await httpWorker.getMSWWorkerOrCreate();
          const startSpy = 'start' in mswWorker ? vi.spyOn(mswWorker, 'start') : vi.spyOn(mswWorker, 'listen');
          const wasMSWWorkerRunning = webSocketWorker.class.isMSWWorkerRunning;

          await Promise.all([httpWorker.start(), webSocketWorker.start()]);

          const webSocketMSWWorker = await webSocketWorker.getMSWWorkerOrCreate();

          expect(webSocketMSWWorker).toBe(mswWorker);
          expect(startSpy).toHaveBeenCalledTimes(wasMSWWorkerRunning ? 0 : 1);
        });
      });
    });

    // The spy calls through and only observes releases of the shared instance. The final release has no public signal,
    // and the earlier stop must not release the instance while the other protocol still uses it.
    it('should clean up the shared MSW worker only after the final protocol worker stops', async () => {
      await usingHttpInterceptorWorker({ type: 'local' }, { start: false }, async (rawHttpWorker) => {
        await usingWebSocketInterceptorWorker({ type: 'local' }, { start: false }, async (webSocketWorker) => {
          const httpWorker = rawHttpWorker as LocalHttpInterceptorWorker;

          const mswWorker = await httpWorker.getMSWWorkerOrCreate();
          const cleanupSpy = 'stop' in mswWorker ? vi.spyOn(mswWorker, 'stop') : vi.spyOn(mswWorker, 'close');

          await httpWorker.start();
          await webSocketWorker.start();

          await httpWorker.stop();

          expect(cleanupSpy).not.toHaveBeenCalled();
          expect(webSocketWorker.class.isMSWWorkerRunning).toBe(true);

          await webSocketWorker.stop();

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

          await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
            const messageListener = vi.fn();
            client.addEventListener('message', messageListener);

            client.send(JSON.stringify({ type: 'client', text: 'one' }));

            await waitFor(() => {
              expect(messageListener).toHaveBeenCalledTimes(1);
            });
          });
        },
      );
    });

    it('should keep HTTP handlers running after clearing a WebSocket interceptor', async () => {
      await usingHttpInterceptor<HttpSchemaWithUsers>(
        { type: 'local', baseURL: httpBaseURL },
        async (httpInterceptor) => {
          httpInterceptor.get('/users').respond({ status: 200, body: { users: ['one'] } });

          await usingWebSocketInterceptor<ChatMessage>(
            { type: 'local', baseURL },
            { start: false },
            async (webSocketInterceptor) => {
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
        async (httpInterceptor) => {
          httpInterceptor.get('/users').respond({ status: 200, body: { users: ['one'] } });

          await usingWebSocketInterceptor<ChatMessage>(
            { type: 'local', baseURL },
            { start: false },
            async (webSocketInterceptor) => {
              await webSocketInterceptor.start();
              webSocketInterceptor
                .message()
                .respond((message) => ({ type: 'server', text: `received ${message.text}` }));

              httpInterceptor.clear();

              await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
                const messagePromise = waitForWebSocketClientMessage(client);
                client.send(JSON.stringify({ type: 'client', text: 'one' }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', text: 'received one' }));
              });

              expect(LocalWebSocketInterceptorWorker.isMSWWorkerRunning).toBe(true);
            },
          );
        },
      );
    });

    it('should keep HTTP handlers running after stopping a WebSocket interceptor', async () => {
      await usingHttpInterceptor<HttpSchemaWithUsers>(
        { type: 'local', baseURL: httpBaseURL },
        async (httpInterceptor) => {
          httpInterceptor.get('/users').respond({ status: 200, body: { users: ['one'] } });

          await usingWebSocketInterceptor<ChatMessage>(
            { type: 'local', baseURL },
            { start: false },
            async (webSocketInterceptor) => {
              await webSocketInterceptor.start();
              webSocketInterceptor.message().respond({ type: 'server', text: 'one' });

              await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
                const messagePromise = waitForWebSocketClientMessage(client);
                client.send(JSON.stringify({ type: 'client', text: 'one' }));
                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', text: 'one' }));
              });

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
        async (httpInterceptor) => {
          httpInterceptor.get('/users').respond({ status: 200, body: { users: ['one'] } });

          await usingWebSocketInterceptor<ChatMessage>(
            { type: 'local', baseURL },
            { start: false },
            async (webSocketInterceptor) => {
              await webSocketInterceptor.start();
              webSocketInterceptor
                .message()
                .respond((message) => ({ type: 'server', text: `received ${message.text}` }));

              const response = await fetch(`${httpBaseURL}/users`);
              await expect(response.json()).resolves.toEqual({ users: ['one'] });

              await httpInterceptor.stop();

              await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
                const messagePromise = waitForWebSocketClientMessage(client);
                client.send(JSON.stringify({ type: 'client', text: 'one' }));

                await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', text: 'received one' }));
              });

              expect(LocalWebSocketInterceptorWorker.isMSWWorkerRunning).toBe(true);
            },
          );
        },
      );
    });
  }

  if (type === 'remote') {
    it('should reject remote clients if the referenced handler no longer exists', async () => {
      await usingWebSocketInterceptorWorker(workerOptions, async (rawWorker) => {
        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        const interceptor = createDefaultWebSocketInterceptor();

        await worker.use(interceptor.implementation);

        // Skips the reset RPC, so the server keeps the cleared handler registered while the worker has already forgotten
        // it.
        const resetRequestSpy = vi.spyOn(worker.webSocketClient, 'request').mockResolvedValueOnce({});
        await worker.clearHandlers({ interceptor: interceptor.implementation });
        resetRequestSpy.mockRestore();

        const client = new WebSocketClient<ChatMessage>(baseURL);
        const closeEventPromise = waitForWebSocketClientClose(client);

        try {
          await client.open();

          const closeEvent = await closeEventPromise;
          expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
          expect(closeEvent.reason).toBe('Could not connect to the WebSocket interceptor.');
        } finally {
          await client.close();
        }
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

        await usingWebSocketClient<ChatMessage>(baseURL, async (client) => {
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
    });

    it('should start with authentication options', async () => {
      const remoteWorkerOptions = workerOptions as RemoteWebSocketInterceptorWorkerOptions;

      await usingWebSocketInterceptorWorker(
        { ...remoteWorkerOptions, auth: { token: 'test-token' } },
        { start: false },
        async (worker) => {
          await worker.start();

          expect(worker.isRunning).toBe(true);
        },
      );
    });

    it('should ignore sends without a registered remote client or handler', async () => {
      await usingWebSocketInterceptorWorker(workerOptions, async (rawWorker) => {
        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        const interceptor = createDefaultWebSocketInterceptor();
        const send = vi.fn();
        const client = createWebSocketInterceptorClient(baseURL, send);

        await expect(
          worker.sendToClient(client, JSON.stringify({ type: 'server', text: 'ignored client' })),
        ).resolves.toBeUndefined();

        await expect(
          worker.sendToClients(interceptor.implementation, JSON.stringify({ type: 'server', text: 'ignored handler' })),
        ).resolves.toBeUndefined();
        expect(send).not.toHaveBeenCalled();
      });
    });

    it('should keep responding through the remaining remote handlers after clearing another interceptor', async () => {
      await usingWebSocketInterceptorWorker(workerOptions, async (rawWorker) => {
        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        const firstInterceptor = createInternalWebSocketInterceptor<ChatMessage>({
          type: 'remote',
          baseURL: `${baseURL}/first`,
        });

        // Runs the second interceptor on the same worker as the first one, so clearing the first recommits the second.
        const secondInterceptor = new WebSocketInterceptorImplementation<
          ChatMessage,
          typeof RemoteWebSocketMessageHandler
        >({
          baseURL: new URL(`${baseURL}/second`),
          Handler: RemoteWebSocketMessageHandler,
          createWorker: () => worker,
          deleteWorker: vi.fn(),
        });

        try {
          await worker.use(firstInterceptor.implementation);

          await secondInterceptor.start();
          await secondInterceptor.message().respond({ type: 'server', text: 'second' });

          await worker.clearHandlers({ interceptor: firstInterceptor.implementation });

          await usingWebSocketClient<ChatMessage>(secondInterceptor.baseURLAsString, async (secondClient) => {
            const messagePromise = waitForWebSocketClientMessage(secondClient);
            secondClient.send(JSON.stringify({ type: 'client', text: 'one' }));

            await expect(messagePromise).resolves.toBe(JSON.stringify({ type: 'server', text: 'second' }));
          });
        } finally {
          await secondInterceptor.stop({});
        }
      });
    });

    it('should reject remote clients after clearing the handlers of all interceptors', async () => {
      await usingWebSocketInterceptorWorker(workerOptions, async (rawWorker) => {
        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        const interceptor = createDefaultWebSocketInterceptor();
        await worker.use(interceptor.implementation);

        await worker.clearHandlers();

        const client = new WebSocketClient<ChatMessage>(baseURL);
        const closeEventPromise = waitForWebSocketClientClose(client);

        try {
          await client.open();

          const closeEvent = await closeEventPromise;
          expect(closeEvent.code).toBe(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR);
          expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
        } finally {
          await client.close();
        }
      });
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
  }
}
