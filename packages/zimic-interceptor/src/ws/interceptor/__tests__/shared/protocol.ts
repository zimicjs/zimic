import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketSchema } from '@zimic/ws';
import { expect, it, vi } from 'vitest';

import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import {
  collectWebSocketClientMessages,
  usingWebSocketClient,
  waitForWebSocketClientMessage,
} from '@tests/utils/webSocket';

import type { WebSocketInterceptorType } from '../../types/options';
import type { WebSocketInterceptorProtocol, WebSocketInterceptorProtocolClient } from '../../types/protocol';

interface ChatMessage {
  text: string;
}

type ChatSchema = WebSocketSchema<{ '/': { message: ChatMessage } }>;
type ChatFrameSchema = WebSocketSchema<{ '/': { message: string } }>;

const CONTROL_FRAME = 'control';
const FRAME_PREFIX = 'chat:';

function encodeFrame(message: ChatMessage) {
  return `${FRAME_PREFIX}${JSON.stringify(message)}`;
}

// A frame holds one message per comma-free chat payload, or is a control frame consumed by the protocol.
const protocol: WebSocketInterceptorProtocol<ChatMessage> = {
  decode(frame) {
    if (frame === CONTROL_FRAME) {
      return [];
    }

    return (frame as string).split('\n').map((line) => JSON.parse(line.slice(FRAME_PREFIX.length)) as ChatMessage);
  },

  encode(message) {
    return [encodeFrame(message)];
  },
};

type TextSchema = WebSocketSchema<{ '/': { message: string } }>;

const TEXT_FRAME_PREFIX = 'text:';
const JSON_LIKE_TEXT = '{"text":"raw"}';

// A frame holds one text message, which may look like JSON.
const textProtocol: WebSocketInterceptorProtocol<string> = {
  decode(frame) {
    return [(frame as string).slice(TEXT_FRAME_PREFIX.length)];
  },

  encode(message) {
    return [`${TEXT_FRAME_PREFIX}${message}`];
  },
};

interface SharedWebSocketInterceptorProtocolTestsOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
}

export function declareProtocolWebSocketInterceptorTests(options: SharedWebSocketInterceptorProtocolTestsOptions) {
  const { type, getBaseURL } = options;

  it('should match decoded messages and respond with encoded frames', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol },
      async (interceptor) => {
        const handler = await interceptor.message().with({ text: 'ping' }).respond({ text: 'pong' }).times(1);

        await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
          const responsePromise = waitForWebSocketClientMessage(client);
          client.send(encodeFrame({ text: 'ping' }));

          expect(await responsePromise).toBe(encodeFrame({ text: 'pong' }));
          expect(handler.messages.map((message) => message.data)).toEqual([{ text: 'ping' }]);
        });
      },
    );
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

            await waitFor(() => expect(firstMessages).toHaveLength(1));
            await waitForNot(() => expect(secondMessages).not.toHaveLength(0));
          });
        });
      },
    );
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

  it('should encode messages that look like JSON sent to a client without parsing them', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<TextSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol: textProtocol },
      async (interceptor) => {
        await usingWebSocketClient<TextSchema>(baseURL, async (client) => {
          await waitFor(() => expect(interceptor.clients).toHaveLength(1));

          const messagePromise = waitForWebSocketClientMessage(client);
          interceptor.clients[0].send(JSON_LIKE_TEXT);

          expect(await messagePromise).toBe(`${TEXT_FRAME_PREFIX}${JSON_LIKE_TEXT}`);
        });
      },
    );
  });

  it('should encode messages that look like JSON sent by the server without parsing them', async () => {
    const baseURL = getBaseURL();

    await usingWebSocketInterceptor<TextSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol: textProtocol },
      async (interceptor) => {
        await usingWebSocketClient<TextSchema>(baseURL, async (client) => {
          await waitFor(() => expect(interceptor.clients).toHaveLength(1));

          const messagePromise = waitForWebSocketClientMessage(client);
          interceptor.server.send(JSON_LIKE_TEXT);

          expect(await messagePromise).toBe(`${TEXT_FRAME_PREFIX}${JSON_LIKE_TEXT}`);
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

  it('should call the disconnection callback returned by the connection hook when a client disconnects', async () => {
    const baseURL = getBaseURL();
    const onDisconnect = vi.fn();
    const connectedClients: WebSocketInterceptorProtocolClient[] = [];

    const connectionProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      onConnection: (client) => {
        connectedClients.push(client);
        return onDisconnect;
      },
    };

    await usingWebSocketInterceptor<ChatSchema>(
      { type, baseURL, messageSaving: { enabled: true }, protocol: connectionProtocol },
      async (interceptor) => {
        await usingWebSocketClient<ChatFrameSchema>(baseURL, async () => {
          await waitFor(() => expect(interceptor.clients).toHaveLength(1));
          expect(connectedClients).toEqual([interceptor.clients[0]]);
          expect(onDisconnect).not.toHaveBeenCalled();
        });

        await waitFor(() => expect(onDisconnect).toHaveBeenCalledTimes(1));
      },
    );
  });

  it('should keep the connection open if decoding a frame fails', async () => {
    const baseURL = getBaseURL();
    const decodingError = new Error('Invalid frame');
    const onUnhandledMessage = vi.fn<() => { log: boolean }>();

    const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      decode(frame, client) {
        if (frame === 'invalid') {
          throw decodingError;
        }
        return protocol.decode(frame, client);
      },
    };

    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    try {
      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, messageSaving: { enabled: true }, protocol: failingProtocol, onUnhandledMessage },
        async (interceptor) => {
          const handler = await interceptor.message().with({ text: 'after' }).times(1);

          await usingWebSocketClient<ChatFrameSchema>(baseURL, async (client) => {
            client.send('invalid');
            client.send(encodeFrame({ text: 'after' }));

            await waitFor(() => expect(handler.messages).toHaveLength(1));
            expect(consoleError).toHaveBeenCalledExactlyOnceWith(decodingError);
            expect(onUnhandledMessage).not.toHaveBeenCalled();
          });
        },
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('should log errors thrown by the connection hook and keep the connection open', async () => {
    const baseURL = getBaseURL();
    const connectionError = new Error('Connection failed');

    const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      onConnection: () => {
        throw connectionError;
      },
    };

    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    try {
      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, messageSaving: { enabled: true }, protocol: failingProtocol },
        async (interceptor) => {
          await usingWebSocketClient<ChatFrameSchema>(baseURL, async () => {
            await waitFor(() => expect(interceptor.clients).toHaveLength(1));
            expect(consoleError).toHaveBeenCalledExactlyOnceWith(connectionError);
          });
        },
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('should log errors thrown by the disconnection callback', async () => {
    const baseURL = getBaseURL();
    const disconnectionError = new Error('Disconnection failed');

    const failingProtocol: WebSocketInterceptorProtocol<ChatMessage> = {
      ...protocol,
      onConnection: () => () => {
        throw disconnectionError;
      },
    };

    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn());

    try {
      await usingWebSocketInterceptor<ChatSchema>(
        { type, baseURL, messageSaving: { enabled: true }, protocol: failingProtocol },
        async (interceptor) => {
          await usingWebSocketClient<ChatFrameSchema>(baseURL, async () => {
            await waitFor(() => expect(interceptor.clients).toHaveLength(1));
          });

          await waitFor(() => expect(consoleError).toHaveBeenCalledExactlyOnceWith(disconnectionError));
        },
      );
    } finally {
      consoleError.mockRestore();
    }
  });
}
