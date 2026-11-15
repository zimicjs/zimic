import { waitFor } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  collectWebSocketClientMessages,
  createBinaryMessage,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import type { WebSocketInterceptorType } from '../../types/options';
import type { WebSocketInterceptorProtocol, WebSocketInterceptorProtocolFrame } from '../../types/protocol';

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
}
