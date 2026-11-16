import { createPromiseWithResolvers } from '@zimic/utils/data';
import { waitFor } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  collectWebSocketClientMessages,
  createBinaryMessage,
  usingWebSocketClient,
  waitForWebSocketClientClose,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import type { WebSocketInterceptorType } from '../../types/options';
import type {
  WebSocketInterceptorProtocol,
  WebSocketInterceptorProtocolContext,
  WebSocketInterceptorProtocolFrame,
  WebSocketInterceptorProtocolOpenedClient,
} from '../../types/protocol';

interface ChatMessage {
  text: string;
}

type ChatSchema = WebSocketSchema<{ '/': { message: ChatMessage } }>;
type ChatFrameSchema = WebSocketSchema<{ '/': { message: string } }>;
type BinaryFrameSchema = WebSocketSchema<{ '/': { message: Blob } }>;

const CONTROL_FRAME = 'control';
const FRAME_PREFIX = 'chat:';

function encodeFrame(message: ChatMessage) {
  return `${FRAME_PREFIX}${JSON.stringify(message)}`;
}

// A frame holds one message per line, or is a control frame consumed by the protocol.
function decodeFrame(frame: WebSocketInterceptorProtocolFrame) {
  if (typeof frame !== 'string' || frame === CONTROL_FRAME) {
    return [];
  }

  return frame.split('\n').map((line) => JSON.parse(line.slice(FRAME_PREFIX.length)) as ChatMessage);
}

const protocol: WebSocketInterceptorProtocol<ChatMessage> = {
  decode: decodeFrame,
  encode: (message) => [encodeFrame(message)],
};

type TextSchema = WebSocketSchema<{ '/': { message: string } }>;

const TEXT_FRAME_PREFIX = 'text:';
const JSON_LIKE_TEXT = '{"text":"raw"}';

// A frame holds one text message, which may look like JSON.
const textProtocol: WebSocketInterceptorProtocol<string> = {
  decode: (frame) =>
    [frame]
      .filter((textFrame) => typeof textFrame === 'string')
      .map((textFrame) => textFrame.slice(TEXT_FRAME_PREFIX.length)),
};

interface SharedWebSocketInterceptorProtocolTestsOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareProtocolWebSocketInterceptorTests(options: SharedWebSocketInterceptorProtocolTestsOptions) {
  const { type, getBaseURL } = options;

  it('should match decoded messages', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol },
      async (interceptor) => {
        const handler = await interceptor.message().with({ text: 'ping' }).times(1);

        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          client.send(encodeFrame({ text: 'ping' }));

          await waitFor(() => {
            expect(handler.messages.map((message) => message.data)).toEqual([{ text: 'ping' }]);
          });
        });
      },
    );
  });

  it('should respond with encoded frames', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol }, async (interceptor) => {
      await interceptor.message().respond({ text: 'pong' });

      await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
        const responsePromise = waitForWebSocketClientMessage(client);
        client.send(encodeFrame({ text: 'ping' }));

        expect(await responsePromise).toBe(encodeFrame({ text: 'pong' }));
      });
    });
  });

  it('should handle each message decoded from a frame', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol },
      async (interceptor) => {
        const handler = await interceptor.message().times(2);

        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          client.send(`${encodeFrame({ text: 'first' })}\n${encodeFrame({ text: 'second' })}`);

          await waitFor(() => {
            expect(handler.messages.map((message) => message.data)).toEqual([{ text: 'first' }, { text: 'second' }]);
          });
        });
      },
    );
  });

  it('should decode binary frames as array buffers', async () => {
    const baseURL = getBaseURL();
    const decodedFrames: WebSocketInterceptorProtocolFrame[] = [];

    const recordingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      decode(frame) {
        decodedFrames.push(frame);
        return [];
      },
    };

    await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: recordingProtocol }, async () => {
      await usingWebSocketClient<BinaryFrameSchema>(baseURL, async (client) => {
        client.send(new Blob([createBinaryMessage(0x00, 0xff)]));

        await waitFor(() => expect(decodedFrames).toStrictEqual([createBinaryMessage(0x00, 0xff)]));
      });
    });
  });

  it('should handle frames as plain messages if the protocol does not decode them', async () => {
    const baseURL = getBaseURL();
    const encodingProtocol: WebSocketInterceptorProtocol<ChatMessage> = { encode: protocol.encode };

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol: encodingProtocol },
      async (interceptor) => {
        const handler = await interceptor.message().times(1);

        await usingWebSocketClient<ChatSchema>(baseURL, async (client) => {
          client.send(JSON.stringify({ text: 'plain' }));

          await waitFor(() => {
            expect(handler.messages.map((message) => message.data)).toEqual([{ text: 'plain' }]);
          });
        });
      },
    );
  });

  it('should match each view of a frame in interceptors with and without a protocol on the same base URL', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatFrameSchema>(
      { type, baseURL, messageSaving: { enabled: true } },
      async (plainInterceptor) => {
        await usingWebSocketInterceptor<ChatSchema>(
          { type, baseURL, messageSaving: { enabled: true }, protocol },
          async (protocolInterceptor) => {
            const plainHandler = await plainInterceptor.message().times(1);
            const protocolHandler = await protocolInterceptor.message().times(1);

            await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
              client.send(encodeFrame({ text: 'shared' }));

              await waitFor(() => {
                expect(plainHandler.messages.map((message) => message.data)).toEqual([encodeFrame({ text: 'shared' })]);
                expect(protocolHandler.messages.map((message) => message.data)).toEqual([{ text: 'shared' }]);
              });
            });
          },
        );
      },
    );
  });

  it('should encode messages sent to a client', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol },
      async (interceptor) => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          await waitFor(() => expect(interceptor.clients).toHaveLength(1));

          const messagePromise = waitForWebSocketClientMessage(client);
          interceptor.clients[0].send({ text: 'hello' });

          expect(await messagePromise).toBe(encodeFrame({ text: 'hello' }));
        });
      },
    );
  });

  it('should encode messages broadcast by the server to each client', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol },
      async (interceptor) => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (firstClient) => {
          await usingWebSocketClient<ChatFrameSchema>(baseURL, async (secondClient) => {
            await waitFor(() => expect(interceptor.clients).toHaveLength(2));

            const messages = [
              collectWebSocketClientMessages(firstClient),
              collectWebSocketClientMessages(secondClient),
            ];
            interceptor.server.send({ text: 'broadcast' });

            await waitFor(() => {
              expect(messages).toEqual([[encodeFrame({ text: 'broadcast' })], [encodeFrame({ text: 'broadcast' })]]);
            });
          });
        });
      },
    );
  });

  it('should encode messages sent by the server only to selected clients', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol },
      async (interceptor) => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (firstClient) => {
          await usingWebSocketClient<ChatFrameSchema>(baseURL, async (secondClient) => {
            await waitFor(() => expect(interceptor.clients).toHaveLength(2));

            const firstMessages = collectWebSocketClientMessages(firstClient);
            const secondMessages = collectWebSocketClientMessages(secondClient);

            interceptor.server.send({ text: 'selected' }, { to: interceptor.clients[0] });

            await waitFor(() => expect(firstMessages).toEqual([encodeFrame({ text: 'selected' })]));
            expect(secondMessages).toHaveLength(0);
          });
        });
      },
    );
  });

  it('should send messages as without a protocol if the protocol does not encode them', async () => {
    const baseURL = getBaseURL();
    const decodingProtocol: WebSocketInterceptorProtocol<ChatMessage> = { decode: decodeFrame };

    await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: decodingProtocol }, async (interceptor) => {
      await usingWebSocketClient<ChatSchema>(baseURL, async (client) => {
        await waitFor(() => expect(interceptor.clients).toHaveLength(1));

        const messagePromise = waitForWebSocketClientMessage(client);
        interceptor.clients[0].send({ text: 'hello' });

        expect(await messagePromise).toBe(JSON.stringify({ text: 'hello' }));
      });
    });
  });

  it('should not report consumed control frames as unhandled', async () => {
    const baseURL = getBaseURL();
    const onUnhandledMessage = vi.fn<() => { log: boolean }>();

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol, onUnhandledMessage },
      async (interceptor) => {
        const handler = await interceptor.message().with({ text: 'marker' }).times(1);

        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          client.send(CONTROL_FRAME);
          client.send(encodeFrame({ text: 'marker' }));

          await waitFor(() => expect(handler.messages).toHaveLength(1));
          expect(onUnhandledMessage).not.toHaveBeenCalled();
        });
      },
    );
  });

  it('should report decoded messages no handler matches as unhandled', async () => {
    const baseURL = getBaseURL();
    const onUnhandledMessage = vi.fn(() => ({ log: false }));

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol, onUnhandledMessage },
      async () => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          client.send(encodeFrame({ text: 'unhandled' }));

          await waitFor(() => expect(onUnhandledMessage).toHaveBeenCalledExactlyOnceWith({ text: 'unhandled' }));
        });
      },
    );
  });

  it('should match decoded messages that look like JSON without parsing them', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<TextSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol: textProtocol },
      async (interceptor) => {
        const handler = await interceptor.message().times(1);

        await usingWebSocketClient<TextSchema>(baseURL, async (client) => {
          client.send(`${TEXT_FRAME_PREFIX}${JSON_LIKE_TEXT}`);

          await waitFor(() => {
            expect(handler.messages.map((message) => message.data)).toEqual([JSON_LIKE_TEXT]);
          });
        });
      },
    );
  });

  it('should report decoded messages that look like JSON as unhandled without parsing them', async () => {
    const baseURL = getBaseURL();
    const onUnhandledMessage = vi.fn(() => ({ log: false }));

    await usingWebSocketInterceptor<TextSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol: textProtocol, onUnhandledMessage },
      async () => {
        await usingWebSocketClient<TextSchema>(baseURL, async (client) => {
          client.send(`${TEXT_FRAME_PREFIX}${JSON_LIKE_TEXT}`);

          await waitFor(() => expect(onUnhandledMessage).toHaveBeenCalledExactlyOnceWith(JSON_LIKE_TEXT));
        });
      },
    );
  });

  it('should call the connection hook with a client able to send raw frames', async () => {
    const baseURL = getBaseURL();

    const connectionProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      onConnection: (client) => client.sendFrame('welcome'),
    };

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol: connectionProtocol },
      async () => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          expect(await waitForWebSocketClientMessage(client)).toBe('welcome');
        });
      },
    );
  });

  it('should call the connection hook before connection effects', async () => {
    const baseURL = getBaseURL();
    const events: string[] = [];

    const connectionProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      onConnection: () => {
        events.push('connection hook');
      },
    };

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, protocol: connectionProtocol },
      async (interceptor) => {
        await interceptor.connection().effect(() => {
          events.push('connection effect');
        });

        await usingWebSocketClient<ChatFrameSchema>(baseURL, async () => {
          await waitFor(() => expect(events).toEqual(['connection hook', 'connection effect']));
        });
      },
    );
  });

  it('should log errors thrown while decoding a frame', async () => {
    const baseURL = getBaseURL();
    const decodingError = new Error('Invalid frame');

    const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      decode: () => {
        throw decodingError;
      },
    };

    await usingIgnoredConsole(['error'], async (console) => {
      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: failingProtocol }, async () => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          client.send('invalid');

          await waitFor(() => expect(console.error).toHaveBeenCalledTimes(1));
          expect(console.error).toHaveBeenCalledWith(decodingError);
        });
      });
    });
  });

  it('should keep handling frames after decoding a frame fails', async () => {
    const baseURL = getBaseURL();

    const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      decode(frame) {
        if (frame === 'invalid') {
          throw new Error('Invalid frame');
        }
        return decodeFrame(frame);
      },
    };

    await usingIgnoredConsole(['error'], async () => {
      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, messageSaving: { enabled: true }, protocol: failingProtocol },
        async (interceptor) => {
          const handler = await interceptor.message().times(1);

          await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
            client.send('invalid');
            client.send(encodeFrame({ text: 'after' }));

            await waitFor(() => {
              expect(handler.messages.map((message) => message.data)).toEqual([{ text: 'after' }]);
            });
          });
        },
      );
    });
  });

  it('should not report frames that fail to decode as unhandled', async () => {
    const baseURL = getBaseURL();
    const onUnhandledMessage = vi.fn<() => { log: boolean }>();

    const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      decode(frame) {
        if (frame === 'invalid') {
          throw new Error('Invalid frame');
        }
        return decodeFrame(frame);
      },
    };

    await usingIgnoredConsole(['error'], async () => {
      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, messageSaving: { enabled: true }, protocol: failingProtocol, onUnhandledMessage },
        async (interceptor) => {
          const handler = await interceptor.message().with({ text: 'marker' }).times(1);

          await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
            client.send('invalid');
            client.send(encodeFrame({ text: 'marker' }));

            await waitFor(() => expect(handler.messages).toHaveLength(1));
            expect(onUnhandledMessage).not.toHaveBeenCalled();
          });
        },
      );
    });
  });

  it('should log errors thrown by the connection hook', async () => {
    const baseURL = getBaseURL();
    const connectionError = new Error('Connection failed');

    const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      onConnection: () => {
        throw connectionError;
      },
    };

    await usingIgnoredConsole(['error'], async (console) => {
      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: failingProtocol }, async () => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async () => {
          await waitFor(() => expect(console.error).toHaveBeenCalledTimes(1));
          expect(console.error).toHaveBeenCalledWith(connectionError);
        });
      });
    });
  });

  it('should keep the connection open if the connection hook throws', async () => {
    const baseURL = getBaseURL();

    const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      onConnection: () => {
        throw new Error('Connection failed');
      },
    };

    await usingIgnoredConsole(['error'], async () => {
      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: failingProtocol }, async (interceptor) => {
        await interceptor.message().respond({ text: 'pong' });

        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          const responsePromise = waitForWebSocketClientMessage(client);
          client.send(encodeFrame({ text: 'ping' }));

          expect(await responsePromise).toBe(encodeFrame({ text: 'pong' }));
        });
      });
    });
  });

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

  it('should stop the protocol after it fails to start', async () => {
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
        expect(stop).toHaveBeenCalledTimes(1);
      },
    );
  });

  it('should reject starting the interceptor with the start error if the protocol also fails to stop', async () => {
    const baseURL = getBaseURL();
    const startError = new Error('Start failed');
    const stopError = new Error('Stop failed');

    const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      start: () => {
        throw startError;
      },
      stop: () => {
        throw stopError;
      },
    };

    await usingIgnoredConsole(['error'], async (console) => {
      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, protocol: failingProtocol },
        { start: false },
        async (interceptor) => {
          await expect(interceptor.start()).rejects.toBe(startError);
          expect(console.error).toHaveBeenCalledWith(stopError);
        },
      );
    });
  });

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
      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: failingProtocol }, async (interceptor) => {
        await interceptor.clear();
        expect(console.error).toHaveBeenCalledExactlyOnceWith(clearError);
      });
    });
  });

  it('should open clients accepted by connection handlers', async () => {
    const baseURL = getBaseURL();
    const contextPromise = createPromiseWithResolvers<WebSocketInterceptorProtocolContext<ChatMessage>>();

    const servingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      start: (context) => contextPromise.resolve(context),
    };

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, connectionSaving: { enabled: true }, protocol: servingProtocol },
      async (interceptor) => {
        const handler = await interceptor.connection().respond({ action: 'accept' }).times(1);
        const context = await contextPromise;

        const result = await context.openClient({
          url: baseURL,
          signal: new AbortController().signal,
          sendFrame: vi.fn(),
          close: vi.fn(),
          onOpen: vi.fn(),
        });

        expect(result).toEqual({ status: 'accepted' });
        expect(handler.connections).toHaveLength(1);
        expect(interceptor.clients.map((client) => client.url)).toEqual([baseURL]);
      },
    );
  });

  it('should not open clients rejected by connection handlers', async () => {
    const baseURL = getBaseURL();
    const contextPromise = createPromiseWithResolvers<WebSocketInterceptorProtocolContext<ChatMessage>>();

    const servingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      start: (context) => contextPromise.resolve(context),
    };

    await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
      await interceptor.connection().respond({ action: 'reject' });
      const context = await contextPromise;

      const result = await context.openClient({
        url: baseURL,
        signal: new AbortController().signal,
        sendFrame: vi.fn(),
        close: vi.fn(),
        onOpen: vi.fn(),
      });

      expect(result).toEqual({ status: 'rejected' });
      expect(interceptor.clients).toHaveLength(0);
    });
  });

  it('should not open clients whose signal is aborted while connection handlers decide them', async () => {
    const baseURL = getBaseURL();
    const contextPromise = createPromiseWithResolvers<WebSocketInterceptorProtocolContext<ChatMessage>>();
    const responseStartedPromise = createPromiseWithResolvers<void>();
    const responseReleasedPromise = createPromiseWithResolvers<void>();

    const servingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      start: (context) => contextPromise.resolve(context),
    };

    await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
      await interceptor.connection().respond(async () => {
        responseStartedPromise.resolve();
        await responseReleasedPromise;
        return { action: 'accept' };
      });

      const context = await contextPromise;
      const abortController = new AbortController();
      const onOpen = vi.fn();

      const resultPromise = context.openClient({
        url: baseURL,
        signal: abortController.signal,
        sendFrame: vi.fn(),
        close: vi.fn(),
        onOpen,
      });

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
    const contextPromise = createPromiseWithResolvers<WebSocketInterceptorProtocolContext<ChatMessage>>();
    const events: string[] = [];

    const servingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      start: (context) => contextPromise.resolve(context),
    };

    await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
      await interceptor.connection().effect(() => {
        events.push('connection effect');
      });

      const context = await contextPromise;

      await context.openClient({
        url: baseURL,
        signal: new AbortController().signal,
        sendFrame: vi.fn(),
        close: vi.fn(),
        onOpen: () => {
          events.push('open hook');
        },
      });

      expect(events).toEqual(['open hook', 'connection effect']);
    });
  });

  it('should finish opening clients after their connection effects', async () => {
    const baseURL = getBaseURL();
    const contextPromise = createPromiseWithResolvers<WebSocketInterceptorProtocolContext<ChatMessage>>();
    const effectStartedPromise = createPromiseWithResolvers<void>();
    const effectReleasedPromise = createPromiseWithResolvers<void>();
    const events: string[] = [];

    const servingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      start: (context) => contextPromise.resolve(context),
    };

    await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
      await interceptor.connection().effect(async () => {
        effectStartedPromise.resolve();
        await effectReleasedPromise;
        events.push('connection effect finished');
      });

      const context = await contextPromise;

      const resultPromise = context.openClient({
        url: baseURL,
        signal: new AbortController().signal,
        sendFrame: vi.fn(),
        close: vi.fn(),
        onOpen: vi.fn(),
      });

      void resultPromise.then(() => events.push('client opened'));

      await effectStartedPromise;
      effectReleasedPromise.resolve();

      expect(await resultPromise).toEqual({ status: 'accepted' });
      await waitFor(() => expect(events).toEqual(['connection effect finished', 'client opened']));
    });
  });

  it('should match messages received by opened clients', async () => {
    const baseURL = getBaseURL();
    const contextPromise = createPromiseWithResolvers<WebSocketInterceptorProtocolContext<ChatMessage>>();
    const openedClientPromise = createPromiseWithResolvers<WebSocketInterceptorProtocolOpenedClient<ChatMessage>>();

    const servingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      start: (context) => contextPromise.resolve(context),
    };

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol: servingProtocol },
      async (interceptor) => {
        const handler = await interceptor.message().with({ text: 'ping' }).times(1);
        const context = await contextPromise;

        await context.openClient({
          url: baseURL,
          signal: new AbortController().signal,
          sendFrame: vi.fn(),
          close: vi.fn(),
          onOpen: (client) => openedClientPromise.resolve(client),
        });

        const openedClient = await openedClientPromise;
        openedClient.receive({ text: 'ping' });

        await waitFor(() => {
          expect(handler.messages.map((message) => message.data)).toEqual([{ text: 'ping' }]);
        });
        expect(handler.messages[0].sender).toBe(interceptor.clients[0]);
      },
    );
  });

  it('should send encoded frames to opened clients', async () => {
    const baseURL = getBaseURL();
    const contextPromise = createPromiseWithResolvers<WebSocketInterceptorProtocolContext<ChatMessage>>();
    const sendFrame = vi.fn<(frame: WebSocketInterceptorProtocolFrame) => void>();

    const servingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      start: (context) => contextPromise.resolve(context),
    };

    await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
      const context = await contextPromise;

      await context.openClient({
        url: baseURL,
        signal: new AbortController().signal,
        sendFrame,
        close: vi.fn(),
        onOpen: vi.fn(),
      });

      interceptor.clients[0].send({ text: 'hello' });

      expect(sendFrame).toHaveBeenCalledExactlyOnceWith(encodeFrame({ text: 'hello' }));
    });
  });

  it('should close opened clients through the protocol', async () => {
    const baseURL = getBaseURL();
    const contextPromise = createPromiseWithResolvers<WebSocketInterceptorProtocolContext<ChatMessage>>();
    const close = vi.fn<(code?: number, reason?: string) => void>();

    const servingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      start: (context) => contextPromise.resolve(context),
    };

    await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
      const context = await contextPromise;

      await context.openClient({
        url: baseURL,
        signal: new AbortController().signal,
        sendFrame: vi.fn(),
        close,
        onOpen: vi.fn(),
      });

      interceptor.clients[0].close(4000, 'Closed by interceptor');

      expect(close).toHaveBeenCalledExactlyOnceWith(4000, 'Closed by interceptor');
    });
  });

  it('should release opened clients when their signal is aborted', async () => {
    const baseURL = getBaseURL();
    const contextPromise = createPromiseWithResolvers<WebSocketInterceptorProtocolContext<ChatMessage>>();

    const servingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      start: (context) => contextPromise.resolve(context),
    };

    await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: servingProtocol }, async (interceptor) => {
      const context = await contextPromise;
      const abortController = new AbortController();

      await context.openClient({
        url: baseURL,
        signal: abortController.signal,
        sendFrame: vi.fn(),
        close: vi.fn(),
        onOpen: vi.fn(),
      });

      expect(interceptor.clients).toHaveLength(1);

      abortController.abort();
      expect(interceptor.clients).toHaveLength(0);
    });
  });

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
        client.send(new Blob([createBinaryMessage(0x00, 0xff)]));
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

    await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: claimingProtocol }, async (interceptor) => {
      await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
        client.send('frame');
        await waitFor(() => expect(onFrame).toHaveBeenCalledTimes(1));

        expect(interceptor.clients).toHaveLength(0);
      });
    });
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

    const newerProtocol: WebSocketInterceptorProtocol<ChatMessage> = { ...protocol, claimConnection: () => undefined };

    await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: olderProtocol }, async () => {
      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: newerProtocol }, async () => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          client.send('frame');

          await waitFor(() => expect(olderOnFrame).toHaveBeenCalledExactlyOnceWith('frame'));
        });
      });
    });
  });

  it('should not give claimed connections to interceptors without a claiming protocol', async () => {
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

  it('should log errors thrown by the claims of connections', async () => {
    const baseURL = getBaseURL();
    const frameError = new Error('Frame failed');

    const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      claimConnection: () => ({
        onFrame: () => {
          throw frameError;
        },
        onClose: vi.fn(),
      }),
    };

    await usingIgnoredConsole(['error'], async (console) => {
      await usingWebSocketInterceptor<ChatSchema>({ type, baseURL, protocol: failingProtocol }, async () => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          client.send('frame');

          await waitFor(() => expect(console.error).toHaveBeenCalledTimes(1));
          expect(console.error).toHaveBeenCalledWith(frameError);
        });
      });
    });
  });
}
