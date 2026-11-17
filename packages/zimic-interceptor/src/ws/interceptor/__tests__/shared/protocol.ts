import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { describe, expect, it, vi } from 'vitest';

import InterceptorWebSocketClient from '@/utils/webSocket/WebSocketClient';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  createBinaryMessage,
  usingWebSocketClient,
  waitForWebSocketClientClose,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import type { WebSocketInterceptorClient } from '../../types/messages';
import type { WebSocketInterceptorType } from '../../types/options';
import type {
  WebSocketInterceptorProtocol,
  WebSocketInterceptorProtocolClientOptions,
  WebSocketInterceptorProtocolContext,
  WebSocketInterceptorProtocolFrame,
  WebSocketInterceptorProtocolOpenedClient,
} from '../../types/protocol';

interface ChatMessage {
  text: string;
}

type ChatSchema = WebSocketSchema<{ '/': { message: ChatMessage } }>;
type ChatFrameSchema = WebSocketSchema<{ '/': { message: string } }>;
type BinaryFrameSchema = WebSocketSchema<{ '/': { message: Blob | ArrayBuffer } }>;

const protocol: WebSocketInterceptorProtocol<ChatMessage> = {
  claimConnection: () => undefined,
};

type ChatClientOptions = WebSocketInterceptorProtocolClientOptions<ChatMessage>;

// Keeps the context the interceptor starts the protocol with, so tests open clients through it.
function createServingProtocol() {
  const startPromise = createPromiseWithResolvers<WebSocketInterceptorProtocolContext<ChatMessage>>();

  const servingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
    ...protocol,
    start: (context) => startPromise.resolve(context),
  };

  async function openClient(clientOptions: Pick<ChatClientOptions, 'url'> & Partial<ChatClientOptions>) {
    const context = await startPromise;

    return context.openClient({
      signal: new AbortController().signal,
      send: vi.fn(),
      close: vi.fn(),
      onOpen: vi.fn(),
      ...clientOptions,
    });
  }

  return { servingProtocol, openClient };
}

interface SharedWebSocketInterceptorProtocolTestsOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareProtocolWebSocketInterceptorTests(options: SharedWebSocketInterceptorProtocolTestsOptions) {
  const { type, getBaseURL } = options;

  describe('Life cycle', () => {
    it('should start the protocol with the type and base URL of the interceptor', async () => {
      const baseURL = getBaseURL();
      const startedInterceptors: WebSocketInterceptorProtocolContext<ChatMessage>['interceptor'][] = [];

      const startingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        start: (context) => {
          startedInterceptors.push(context.interceptor);
        },
      };

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: startingProtocol }, () => {
        expect(startedInterceptors).toEqual([{ type, baseURL }]);
      });
    });

    it('should finish starting the protocol before the interceptor is running', async () => {
      const baseURL = getBaseURL();
      const protocolStartStartedPromise = createPromiseWithResolvers<void>();
      const protocolStartReleasedPromise = createPromiseWithResolvers<void>();

      const startingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        async start() {
          protocolStartStartedPromise.resolve();
          await protocolStartReleasedPromise;
        },
      };

      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, protocol: startingProtocol },
        { start: false },
        async (interceptor) => {
          const startPromise = interceptor.start();

          await protocolStartStartedPromise;
          expect(interceptor.isRunning).toBe(false);

          protocolStartReleasedPromise.resolve();
          await startPromise;

          expect(interceptor.isRunning).toBe(true);
        },
      );
    });

    it('should reject starting the interceptor if the protocol fails to start', async () => {
      const baseURL = getBaseURL();
      const startError = new Error('Start failed');

      const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        start: () => {
          throw startError;
        },
      };

      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, protocol: failingProtocol },
        { start: false },
        async (interceptor) => {
          await expect(interceptor.start()).rejects.toBe(startError);
          expect(interceptor.isRunning).toBe(false);
        },
      );
    });

    it('should not stop the protocol if it fails to start', async () => {
      const baseURL = getBaseURL();
      const stop = vi.fn<() => void>();

      const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        start: () => {
          throw new Error('Start failed');
        },
        stop,
      };

      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, protocol: failingProtocol },
        { start: false },
        async (interceptor) => {
          await expect(interceptor.start()).rejects.toThrow('Start failed');
          expect(stop).not.toHaveBeenCalled();
        },
      );
    });

    // Remote-only: only remote interceptors register with the interceptor server after their protocol starts, and that
    // registration can fail. Local registrations cannot fail once the worker is running.
    if (type === 'remote') {
      it('should stop the protocol if the interceptor fails to register after starting it', async () => {
        const baseURL = getBaseURL();
        const stop = vi.fn<() => void>();

        await usingWebSocketInterceptor<ChatSchema>(
          { type, baseURL, protocol: { ...protocol, stop } },
          { start: false },
          async (interceptor) => {
            const registrationError = new Error('Registration failed');

            // No public path makes the server reject a registration, so only the registration request is failed.
            const requestSpy = vi
              .spyOn(InterceptorWebSocketClient.prototype, 'request')
              .mockRejectedValueOnce(registrationError);

            try {
              await expect(interceptor.start()).rejects.toBe(registrationError);

              expect(requestSpy).toHaveBeenNthCalledWith(1, 'interceptors/ws/workers/reset', expect.anything());
            } finally {
              requestSpy.mockRestore();
            }

            expect(stop).toHaveBeenCalledTimes(1);
          },
        );
      });
    }

    it('should stop the protocol when the interceptor stops', async () => {
      const baseURL = getBaseURL();
      const stop = vi.fn<() => void>();

      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, protocol: { ...protocol, stop } },
        async (interceptor) => {
          expect(stop).not.toHaveBeenCalled();

          await interceptor.stop();
          expect(stop).toHaveBeenCalledTimes(1);
        },
      );
    });

    it('should reject stopping the interceptor if the protocol fails to stop', async () => {
      const baseURL = getBaseURL();
      const stopError = new Error('Stop failed');

      const stop = vi.fn<() => void>().mockImplementationOnce(() => {
        throw stopError;
      });

      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, protocol: { ...protocol, stop } },
        async (interceptor) => {
          await expect(interceptor.stop()).rejects.toBe(stopError);
        },
      );
    });

    it('should stop the interceptor if the protocol fails to stop', async () => {
      const baseURL = getBaseURL();

      const stop = vi.fn<() => void>().mockImplementationOnce(() => {
        throw new Error('Stop failed');
      });

      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, protocol: { ...protocol, stop } },
        async (interceptor) => {
          await expect(interceptor.stop()).rejects.toThrow('Stop failed');
          expect(interceptor.isRunning).toBe(false);
        },
      );
    });

    it('should clear the protocol when the interceptor is cleared', async () => {
      const baseURL = getBaseURL();
      const clear = vi.fn<() => void>();

      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, protocol: { ...protocol, clear } },
        async (interceptor) => {
          expect(clear).not.toHaveBeenCalled();

          await interceptor.clear();
          expect(clear).toHaveBeenCalledTimes(1);
        },
      );
    });

    it('should clear the protocol when the interceptor stops', async () => {
      const baseURL = getBaseURL();
      const clear = vi.fn<() => void>();

      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, protocol: { ...protocol, clear } },
        async (interceptor) => {
          await interceptor.stop();
          expect(clear).toHaveBeenCalledTimes(1);
        },
      );
    });

    it('should log errors thrown while clearing the protocol', async () => {
      const baseURL = getBaseURL();
      const clearError = new Error('Clear failed');

      const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        clear: () => {
          throw clearError;
        },
      };

      await usingIgnoredConsole(['error'], async (console) => {
        await usingWebSocketInterceptor<ChatSchema>(
          { type, baseURL, protocol: failingProtocol },
          async (interceptor) => {
            await interceptor.clear();
            expect(console.error).toHaveBeenCalledExactlyOnceWith(clearError);
          },
        );
      });
    });
  });

  describe('Opened clients', () => {
    it('should open clients accepted by connection handlers', async () => {
      const baseURL = getBaseURL();
      const { servingProtocol, openClient } = createServingProtocol();

      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, connectionSaving: { enabled: true }, protocol: servingProtocol },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'accept' }).times(1);

          const result = await openClient({ url: baseURL });

          expect(result).toEqual({ status: 'accepted' });
          expect(handler.connections).toHaveLength(1);
          expect(interceptor.clients.map((client) => client.url)).toEqual([baseURL]);
        },
      );
    });

    it('should not open clients rejected by connection handlers', async () => {
      const baseURL = getBaseURL();
      const { servingProtocol, openClient } = createServingProtocol();

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
        await interceptor.connection().respond({ action: 'reject' });

        const result = await openClient({ url: baseURL });

        expect(result).toEqual({ status: 'rejected' });
        expect(interceptor.clients).toHaveLength(0);
      });
    });

    it('should not open clients whose signal is aborted while connection handlers decide them', async () => {
      const baseURL = getBaseURL();
      const { servingProtocol, openClient } = createServingProtocol();
      const responseStartedPromise = createPromiseWithResolvers<void>();
      const responseReleasedPromise = createPromiseWithResolvers<void>();

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
        await interceptor.connection().respond(async () => {
          responseStartedPromise.resolve();
          await responseReleasedPromise;
          return { action: 'accept' };
        });

        const abortController = new AbortController();
        const onOpen = vi.fn();

        const resultPromise = openClient({ url: baseURL, signal: abortController.signal, onOpen });

        await responseStartedPromise;
        abortController.abort();
        responseReleasedPromise.resolve();

        expect(await resultPromise).toEqual({ status: 'aborted' });
        expect(onOpen).not.toHaveBeenCalled();
        expect(interceptor.clients).toHaveLength(0);
      });
    });

    it('should call the open hook of a client before connection effects', async () => {
      const baseURL = getBaseURL();
      const { servingProtocol, openClient } = createServingProtocol();
      const events: string[] = [];

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
        await interceptor.connection().effect(() => {
          events.push('connection effect');
        });

        await openClient({
          url: baseURL,
          onOpen: () => {
            events.push('open hook');
          },
        });

        expect(events).toEqual(['open hook', 'connection effect']);
      });
    });

    it('should finish opening clients after their connection effects', async () => {
      const baseURL = getBaseURL();
      const { servingProtocol, openClient } = createServingProtocol();
      const effectStartedPromise = createPromiseWithResolvers<void>();
      const effectReleasedPromise = createPromiseWithResolvers<void>();
      const events: string[] = [];

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
        await interceptor.connection().effect(async () => {
          effectStartedPromise.resolve();
          await effectReleasedPromise;
          events.push('connection effect finished');
        });

        const resultPromise = openClient({ url: baseURL });

        void resultPromise.then(() => events.push('client opened'));

        await effectStartedPromise;
        effectReleasedPromise.resolve();

        expect(await resultPromise).toEqual({ status: 'accepted' });
        await waitFor(() => expect(events).toEqual(['connection effect finished', 'client opened']));
      });
    });

    it('should match messages received by opened clients', async () => {
      const baseURL = getBaseURL();
      const { servingProtocol, openClient } = createServingProtocol();
      const openedClientPromise = createPromiseWithResolvers<WebSocketInterceptorProtocolOpenedClient<ChatMessage>>();

      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, messageSaving: { enabled: true }, protocol: servingProtocol },
        async (interceptor) => {
          const handler = await interceptor.message().with({ text: 'ping' }).times(1);

          await openClient({ url: baseURL, onOpen: (client) => openedClientPromise.resolve(client) });

          const openedClient = await openedClientPromise;
          openedClient.receive({ text: 'ping' });

          await waitFor(() => {
            expect(handler.messages.map((message) => message.data)).toEqual([{ text: 'ping' }]);
          });
          expect(handler.messages[0].sender).toBe(interceptor.clients[0]);
        },
      );
    });

    it('should send messages to opened clients through the protocol', async () => {
      const baseURL = getBaseURL();
      const { servingProtocol, openClient } = createServingProtocol();
      const send = vi.fn<(message: ChatMessage) => void>();

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
        await openClient({ url: baseURL, send });

        interceptor.clients[0].send({ text: 'hello' });

        expect(send).toHaveBeenCalledExactlyOnceWith({ text: 'hello' });
      });
    });

    it('should close opened clients through the protocol', async () => {
      const baseURL = getBaseURL();
      const { servingProtocol, openClient } = createServingProtocol();
      const close = vi.fn<(code?: number, reason?: string) => void>();

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
        await openClient({ url: baseURL, close });

        interceptor.clients[0].close(4000, 'Closed by interceptor');

        expect(close).toHaveBeenCalledExactlyOnceWith(4000, 'Closed by interceptor');
      });
    });

    it('should release opened clients when their signal is aborted', async () => {
      const baseURL = getBaseURL();
      const { servingProtocol, openClient } = createServingProtocol();

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
        const abortController = new AbortController();

        await openClient({ url: baseURL, signal: abortController.signal });

        expect(interceptor.clients).toHaveLength(1);

        abortController.abort();
        expect(interceptor.clients).toHaveLength(0);
      });
    });

    it.each([
      {
        method: 'send',
        callReleasedClient: (client: WebSocketInterceptorClient<ChatSchema>) => {
          client.send({ text: 'released' });
        },
      },
      {
        method: 'close',
        callReleasedClient: (client: WebSocketInterceptorClient<ChatSchema>) => {
          client.close();
        },
      },
    ])('should ignore $method calls of opened clients released by their signal', async ({ callReleasedClient }) => {
      const baseURL = getBaseURL();
      const { servingProtocol, openClient } = createServingProtocol();
      const send = vi.fn<(message: ChatMessage) => void>();
      const close = vi.fn<(code?: number, reason?: string) => void>();

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
        const abortController = new AbortController();

        await openClient({ url: baseURL, signal: abortController.signal, send, close });

        const releasedClient = interceptor.clients[0];
        abortController.abort();

        callReleasedClient(releasedClient);

        expect(send).not.toHaveBeenCalled();
        expect(close).not.toHaveBeenCalled();
      });
    });
  });

  describe('Claimed connections', () => {
    it('should give the URL of claimed connections to the protocol', async () => {
      const baseURL = getBaseURL();
      const connectionURL = `${baseURL}/chat?id=1`;
      const claimedURLs: string[] = [];

      const claimingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: (connection) => {
          claimedURLs.push(connection.url);
          return { onFrame: vi.fn(), onClose: vi.fn() };
        },
      };

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: claimingProtocol }, async () => {
        await usingWebSocketClient<ChatFrameSchema>(connectionURL, () => {
          expect(claimedURLs).toEqual([connectionURL]);
        });
      });
    });

    it('should give the frames of claimed connections to the protocol', async () => {
      const baseURL = getBaseURL();
      const onFrame = vi.fn<(frame: WebSocketInterceptorProtocolFrame) => void>();

      const claimingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: () => ({ onFrame, onClose: vi.fn() }),
      };

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: claimingProtocol }, async () => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          client.send('frame');

          await waitFor(() => expect(onFrame).toHaveBeenCalledExactlyOnceWith('frame'));
        });
      });
    });

    it('should give the binary frames of claimed connections to the protocol as array buffers', async () => {
      const baseURL = getBaseURL();
      const onFrame = vi.fn<(frame: WebSocketInterceptorProtocolFrame) => void>();

      const claimingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: () => ({ onFrame, onClose: vi.fn() }),
      };

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: claimingProtocol }, async () => {
        await usingWebSocketClient<BinaryFrameSchema>(baseURL, async (client) => {
          client.send(new Blob([createBinaryMessage(0x00, 0xff)]));

          await waitFor(() => expect(onFrame).toHaveBeenCalledTimes(1));

          expect(onFrame.mock.calls[0][0]).toStrictEqual(createBinaryMessage(0x00, 0xff));
        });
      });
    });

    it('should send frames to claimed connections', async () => {
      const baseURL = getBaseURL();

      const claimingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: (connection) => ({
          onFrame: () => connection.send('pong'),
          onClose: vi.fn(),
        }),
      };

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: claimingProtocol }, async () => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          const messagePromise = waitForWebSocketClientMessage(client);
          client.send('ping');

          expect(await messagePromise).toBe('pong');
        });
      });
    });

    it('should close claimed connections', async () => {
      const baseURL = getBaseURL();

      const claimingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: (connection) => ({
          onFrame: () => connection.close(4000, 'Closed by protocol'),
          onClose: vi.fn(),
        }),
      };

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: claimingProtocol }, async () => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          const closePromise = waitForWebSocketClientClose(client);
          client.send('close');

          const closeEvent = await closePromise;
          expect(closeEvent.code).toBe(4000);
          expect(closeEvent.reason).toBe('Closed by protocol');
        });
      });
    });

    it('should notify the protocol when claimed connections close', async () => {
      const baseURL = getBaseURL();
      const onClose = vi.fn<() => void>();

      const claimingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: () => ({ onFrame: vi.fn(), onClose }),
      };

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: claimingProtocol }, async () => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          expect(onClose).not.toHaveBeenCalled();
          await client.close();
        });

        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      });
    });

    it('should give the frames of claimed connections to the protocol before their close', async () => {
      const baseURL = getBaseURL();
      const events: string[] = [];

      const claimingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: () => ({
          onFrame: () => events.push('frame'),
          onClose: () => events.push('close'),
        }),
      };

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: claimingProtocol }, async () => {
        await usingWebSocketClient<BinaryFrameSchema>(baseURL, async (client) => {
          // Node's native WebSocket drops a Blob sent right before closing, so the frame is an ArrayBuffer.
          client.send(createBinaryMessage(0x00, 0xff));
          await client.close();
        });

        await waitFor(() => expect(events).toEqual(['frame', 'close']));
      });
    });

    it('should not run connection handlers for claimed connections', async () => {
      const baseURL = getBaseURL();
      const onFrame = vi.fn<(frame: WebSocketInterceptorProtocolFrame) => void>();

      const claimingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: () => ({ onFrame, onClose: vi.fn() }),
      };

      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, connectionSaving: { enabled: true }, protocol: claimingProtocol },
        async (interceptor) => {
          const handler = await interceptor.connection().respond({ action: 'reject' });

          await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
            client.send('frame');
            await waitFor(() => expect(onFrame).toHaveBeenCalledTimes(1));

            expect(handler.connections).toHaveLength(0);
          });
        },
      );
    });

    it('should not list claimed connections as clients', async () => {
      const baseURL = getBaseURL();
      const onFrame = vi.fn<(frame: WebSocketInterceptorProtocolFrame) => void>();

      const claimingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: () => ({ onFrame, onClose: vi.fn() }),
      };

      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, protocol: claimingProtocol },
        async (interceptor) => {
          await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
            client.send('frame');
            await waitFor(() => expect(onFrame).toHaveBeenCalledTimes(1));

            expect(interceptor.clients).toHaveLength(0);
          });
        },
      );
    });

    it('should give claimed connections only to the newest interceptor whose protocol claims them', async () => {
      const baseURL = getBaseURL();
      const olderClaimConnection = vi.fn<NonNullable<WebSocketInterceptorProtocol<ChatMessage>['claimConnection']>>(
        () => ({ onFrame: vi.fn(), onClose: vi.fn() }),
      );
      const newerOnFrame = vi.fn<(frame: WebSocketInterceptorProtocolFrame) => void>();

      const olderProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: olderClaimConnection,
      };

      const newerProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: () => ({ onFrame: newerOnFrame, onClose: vi.fn() }),
      };

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: olderProtocol }, async () => {
        await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: newerProtocol }, async () => {
          await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
            client.send('frame');

            await waitFor(() => expect(newerOnFrame).toHaveBeenCalledExactlyOnceWith('frame'));
            expect(olderClaimConnection).not.toHaveBeenCalled();
          });
        });
      });
    });

    it('should give claimed connections to older interceptors if the protocols of newer ones do not claim them', async () => {
      const baseURL = getBaseURL();
      const olderOnFrame = vi.fn<(frame: WebSocketInterceptorProtocolFrame) => void>();

      const olderProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: () => ({ onFrame: olderOnFrame, onClose: vi.fn() }),
      };

      const newerProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: () => undefined,
      };

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: olderProtocol }, async () => {
        await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: newerProtocol }, async () => {
          await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
            client.send('frame');

            await waitFor(() => expect(olderOnFrame).toHaveBeenCalledExactlyOnceWith('frame'));
          });
        });
      });
    });

    it('should not give claimed connections to interceptors without a protocol', async () => {
      const baseURL = getBaseURL();
      const onFrame = vi.fn<(frame: WebSocketInterceptorProtocolFrame) => void>();

      const claimingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: () => ({ onFrame, onClose: vi.fn() }),
      };

      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: claimingProtocol }, async () => {
        // Started last, so it would hold the connection as its newest holder if claims did not take precedence.
        await usingWebSocketInterceptor<ChatFrameSchema>(
          { type, baseURL, messageSaving: { enabled: true } },
          async (plainInterceptor) => {
            const plainHandler = await plainInterceptor.message();

            await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
              client.send('frame');
              await waitFor(() => expect(onFrame).toHaveBeenCalledTimes(1));

              expect(plainInterceptor.clients).toHaveLength(0);
              expect(plainHandler.messages).toHaveLength(0);
            });
          },
        );
      });
    });

    it('should not hold connections that the protocol does not claim', async () => {
      const baseURL = getBaseURL();
      const nonClaimingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: () => undefined,
      };

      await usingWebSocketInterceptor<ChatFrameSchema>({ type, baseURL }, async (plainInterceptor) => {
        await usingWebSocketInterceptor<ChatSchema>(
          { type, baseURL, protocol: nonClaimingProtocol },
          async (protocolInterceptor) => {
            await usingWebSocketClient<ChatFrameSchema>(baseURL, async () => {
              await waitFor(() => expect(plainInterceptor.clients).toHaveLength(1));

              expect(protocolInterceptor.clients).toHaveLength(0);
            });
          },
        );
      });
    });

    it('should give connections to other interceptors if claiming them throws', async () => {
      const baseURL = getBaseURL();

      const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: () => {
          throw new Error('Claim failed');
        },
      };

      await usingIgnoredConsole(['error'], async () => {
        await usingWebSocketInterceptor<ChatFrameSchema>({ type, baseURL }, async (plainInterceptor) => {
          await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: failingProtocol }, async () => {
            await usingWebSocketClient<ChatFrameSchema>(baseURL, async () => {
              await waitFor(() => expect(plainInterceptor.clients).toHaveLength(1));
            });
          });
        });
      });
    });

    it('should log errors thrown while claiming connections', async () => {
      const baseURL = getBaseURL();
      const claimError = new Error('Claim failed');

      const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
        ...protocol,
        claimConnection: () => {
          throw claimError;
        },
      };

      await usingIgnoredConsole(['error'], async (console) => {
        // Holds the connection the failing protocol does not claim.
        await usingWebSocketInterceptor<ChatFrameSchema>({ type, baseURL }, async () => {
          await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: failingProtocol }, async () => {
            await usingWebSocketClient<ChatFrameSchema>(baseURL, async () => {
              await waitFor(() => expect(console.error).toHaveBeenCalledTimes(1));
              expect(console.error).toHaveBeenCalledWith(claimError);
            });
          });
        });
      });
    });

    it.each([
      {
        hookName: 'onFrame',
        triggerHook: (client: WebSocketClient<ChatFrameSchema>) => {
          client.send('frame');
        },
      },
      {
        hookName: 'onClose',
        triggerHook: async (client: WebSocketClient<ChatFrameSchema>) => {
          await client.close();
        },
      },
    ] as const)(
      'should log errors thrown by the $hookName hook of connection claims',
      async ({ hookName, triggerHook }) => {
        const baseURL = getBaseURL();
        const hookError = new Error(`${hookName} failed`);

        const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
          ...protocol,
          claimConnection: () => ({
            onFrame: vi.fn(),
            onClose: vi.fn(),
            [hookName]: () => {
              throw hookError;
            },
          }),
        };

        await usingIgnoredConsole(['error'], async (console) => {
          await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: failingProtocol }, async () => {
            await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
              await triggerHook(client);

              await waitFor(() => expect(console.error).toHaveBeenCalledTimes(1));
              expect(console.error).toHaveBeenCalledWith(hookError);
            });
          });
        });
      },
    );
  });
}
