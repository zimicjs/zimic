import { waitFor } from '@zimic/utils/time';
import type { WebSocketSchemaMessage } from '@zimic/ws';
import type { Socket } from 'socket.io-client';
import msgpackParser from 'socket.io-msgpack-parser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHeldInterceptorWorkerMessages, usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { usingSocket, waitForSocketConnection } from '@tests/utils/socketIO';

import { verifyUnhandledMessageWarning } from '../../../interceptor/__tests__/shared/utils';
import type { UnhandledMessageStrategy, WebSocketInterceptorPlatform } from '../../../interceptor/types/options';
import type { LocalWebSocketInterceptor, RemoteWebSocketInterceptor } from '../../../interceptor/types/public';
import type { SocketIOMessage } from '../../types/messages';
import type { SocketIOProtocolOptions } from '../../types/options';
import type { SocketIOSchema } from '../../types/schema';
import {
  createSocketIOInterceptorOptions,
  createSocketIOPollingInterceptor,
  getSocketIOBaseURL,
  getSocketIOTransportCases,
  SharedSocketIOProtocolTestsOptions,
  SocketIOPollingInterceptor,
  SocketIOTestSavingOptions,
} from './utils';

/* eslint-disable @typescript-eslint/naming-convention -- Socket.IO event names commonly use colons. */
interface ServerToClientEvents {
  'user:created': (user: { id: string }, source: string) => void;
}

interface ClientToServerEvents {
  'user:join': (input: { name: string }) => void;
  'user:notify': (input: { name: string }, priority: number, channel: string) => void;
  'user:create': (input: { name: string }, ack: (user: { id: string }, source: string) => void) => void;
  'user:ping': (ack: () => void) => void;
}

interface BinaryServerToClientEvents {
  'file:copy': (file: ArrayBuffer) => void;
}

interface BinaryClientToServerEvents {
  file: (file: ArrayBuffer) => void;
}
/* eslint-enable @typescript-eslint/naming-convention */

type ChatSchema = SocketIOSchema<ServerToClientEvents, ClientToServerEvents>;

type ChatInterceptor = LocalWebSocketInterceptor<ChatSchema> | RemoteWebSocketInterceptor<ChatSchema>;

type BinarySchema = SocketIOSchema<BinaryServerToClientEvents, BinaryClientToServerEvents>;

interface EventsSocketIOProtocolTestsOptions extends SharedSocketIOProtocolTestsOptions {
  platform: WebSocketInterceptorPlatform;
}

export function declareEventsSocketIOProtocolTests(options: EventsSocketIOProtocolTestsOptions) {
  const { platform, type, getBaseURL: getServerBaseURL, WebSocketTransport } = options;

  let baseURL: string;
  let polling: SocketIOPollingInterceptor;

  beforeEach(() => {
    baseURL = getSocketIOBaseURL(getServerBaseURL());
    polling = createSocketIOPollingInterceptor(type, baseURL);
  });

  function getSocketIOInterceptorOptions<Message extends SocketIOMessage = SocketIOMessage>(
    protocolOptions?: SocketIOProtocolOptions,
    savingOptions?: SocketIOTestSavingOptions,
  ) {
    return createSocketIOInterceptorOptions<Message>({ type, baseURL, polling }, protocolOptions, savingOptions);
  }

  // Local interceptors receive events in the same process, so an event sent before a clear cannot arrive after it. Only
  // events sent over WebSocket are checked, because polling requests reach the server through another worker connection.
  if (type === 'remote') {
    it('should not intercept events sent before their handler is cleared and redeclared', async () => {
      await usingHeldInterceptorWorkerMessages(async (messages) => {
        await usingWebSocketInterceptor<ChatSchema>(
          getSocketIOInterceptorOptions({}, { messageSaving: { enabled: true } }),
          async (interceptor) => {
            const olderHandler = await interceptor.message().with({ type: 'user:join' });
            const handler = await interceptor.message().with({ type: 'user:join' });

            await usingSocket(baseURL, { transports: [WebSocketTransport] }, async (socket) => {
              await waitForSocketConnection(socket);

              const heldMessagePromise = messages.hold((message) => {
                return message.channel === 'interceptors/ws/messages/handle';
              });

              socket.emit('user:join', { name: 'Name' });
              await heldMessagePromise;

              await handler.clear().with({ type: 'user:join' });

              messages.release();

              await waitFor(() => expect(olderHandler.messages).toHaveLength(1));
              expect(handler.messages).toHaveLength(0);
            });
          },
        );
      });
    });
  }

  describe.each(getSocketIOTransportCases(options))('Transport: $transportName', ({ transports }) => {
    it.each<{
      eventDescription: string;
      emit: (socket: Socket) => void;
      expectedMessage: Extract<WebSocketSchemaMessage<ChatSchema>, { type: string }>;
    }>([
      {
        eventDescription: 'one argument',
        emit: (socket) => socket.emit('user:join', { name: 'Name' }),
        expectedMessage: { type: 'user:join', data: { name: 'Name' } },
      },
      {
        eventDescription: 'several arguments',
        emit: (socket) => socket.emit('user:notify', { name: 'Name' }, 2, 'email'),
        expectedMessage: { type: 'user:notify', data: { name: 'Name' }, args: [2, 'email'] },
      },
      {
        eventDescription: 'an ack callback',
        emit: (socket) => socket.emit('user:create', { name: 'Name' }, vi.fn()),
        expectedMessage: { type: 'user:create', data: { name: 'Name' }, ackId: expect.any(Number) as number },
      },
    ])('should intercept events with $eventDescription as messages', async ({ emit, expectedMessage }) => {
      await usingWebSocketInterceptor<ChatSchema>(
        getSocketIOInterceptorOptions({}, { messageSaving: { enabled: true } }),
        async (interceptor) => {
          const handler = await interceptor.message().with({ type: expectedMessage.type }).times(1);

          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            emit(socket);

            await waitFor(() => expect(handler.messages).toHaveLength(1));
            expect(handler.messages[0].data).toStrictEqual(expectedMessage);
          });
        },
      );
    });

    it('should report unhandled events as messages from their session', async () => {
      const onUnhandledMessage = vi.fn<UnhandledMessageStrategy.DeclarationFactory>(() => ({ log: true }));

      await usingWebSocketInterceptor<ChatSchema>(
        { ...getSocketIOInterceptorOptions(), onUnhandledMessage },
        async (interceptor) => {
          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            const sessionURL = interceptor.clients[0].url;
            expect(sessionURL.startsWith(`${baseURL}/?EIO=4&transport=`)).toBe(true);

            await usingIgnoredConsole(['warn', 'error'], async (console) => {
              socket.emit('user:join', { name: 'Name' });

              await waitFor(() => {
                expect(console.warn).toHaveBeenCalledTimes(1);
              });
              expect(console.error).toHaveBeenCalledTimes(0);

              const expectedMessage = { type: 'user:join', data: { name: 'Name' } };
              expect(onUnhandledMessage.mock.calls).toEqual([[expectedMessage]]);

              await verifyUnhandledMessageWarning(console.warn.mock.calls[0], {
                data: expectedMessage,
                url: sessionURL,
                platform,
              });
            });
          });
        },
      );
    });

    it('should send event responses with their first argument and args', async () => {
      await usingWebSocketInterceptor<ChatSchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await interceptor
          .message()
          .with({ type: 'user:notify' })
          .respond({ type: 'user:created', data: { id: '1' }, args: ['server'] })
          .times(1);

        await usingSocket(baseURL, { transports }, async (socket) => {
          await waitForSocketConnection(socket);

          const responsePromise = new Promise<unknown[]>((resolve) => {
            socket.once('user:created', (...args: unknown[]) => resolve(args));
          });
          socket.emit('user:notify', { name: 'Name' }, 2, 'email');

          expect(await responsePromise).toEqual([{ id: '1' }, 'server']);
        });
      });
    });

    it.each<{
      ackDescription: string;
      declareHandler: (interceptor: ChatInterceptor) => PromiseLike<unknown> | object;
      emitWithAck: (socket: Socket, ack: (...args: unknown[]) => void) => void;
      expectedAckArguments: unknown[];
    }>([
      {
        ackDescription: 'arguments',
        declareHandler: (interceptor) =>
          interceptor
            .message()
            .with({ type: 'user:create' })
            .respond((message) => ({ ackId: message.ackId, data: { id: '1' }, args: ['server'] }))
            .times(1),
        emitWithAck: (socket, ack) => socket.emit('user:create', { name: 'Name' }, ack),
        expectedAckArguments: [{ id: '1' }, 'server'],
      },
      {
        ackDescription: 'no arguments',
        declareHandler: (interceptor) =>
          interceptor
            .message()
            .with({ type: 'user:ping' })
            .respond((message) => ({ ackId: message.ackId }))
            .times(1),
        emitWithAck: (socket, ack) => socket.emit('user:ping', ack),
        expectedAckArguments: [],
      },
    ])(
      'should acknowledge events with $ackDescription by responding with their ack ID',
      async ({ declareHandler, emitWithAck, expectedAckArguments }) => {
        await usingWebSocketInterceptor<ChatSchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          await declareHandler(interceptor);

          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            const ackPromise = new Promise<unknown[]>((resolve) => {
              emitWithAck(socket, (...args) => resolve(args));
            });

            expect(await ackPromise).toEqual(expectedAckArguments);
          });
        });
      },
    );

    it('should intercept binary attachments as array buffers', async () => {
      await usingWebSocketInterceptor<BinarySchema>(
        getSocketIOInterceptorOptions({}, { messageSaving: { enabled: true } }),
        async (interceptor) => {
          const handler = await interceptor.message().with({ type: 'file' }).times(1);

          await usingSocket(baseURL, { transports }, async (socket) => {
            await waitForSocketConnection(socket);

            socket.emit('file', new Uint8Array([0x00, 0xff]).buffer);

            await waitFor(() => expect(handler.messages).toHaveLength(1));

            const { data } = handler.messages[0].data;
            expect(data).toBeInstanceOf(ArrayBuffer);
            expect(Array.from(new Uint8Array(data))).toEqual([0x00, 0xff]);
          });
        },
      );
    });

    it('should send binary attachments', async () => {
      await usingWebSocketInterceptor<BinarySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await interceptor
          .message()
          .with({ type: 'file' })
          .respond({ type: 'file:copy', data: new Uint8Array([0xff, 0x00]).buffer })
          .times(1);

        await usingSocket(baseURL, { transports }, async (socket) => {
          await waitForSocketConnection(socket);

          const responsePromise = new Promise<ArrayBuffer>((resolve) => {
            socket.once('file:copy', resolve);
          });
          socket.emit('file', new Uint8Array([0x00, 0xff]).buffer);

          const response = await responsePromise;
          expect(Array.from(new Uint8Array(response))).toEqual([0xff, 0x00]);
        });
      });
    });

    it('should encode and decode events with a custom parser', async () => {
      await usingWebSocketInterceptor<ChatSchema>(
        getSocketIOInterceptorOptions({ parser: msgpackParser }),
        async (interceptor) => {
          await interceptor
            .message()
            .with({ type: 'user:notify', data: { name: 'Name' } })
            .respond({ type: 'user:created', data: { id: '1' }, args: ['server'] })
            .times(1);

          await usingSocket(baseURL, { transports, parser: msgpackParser }, async (socket) => {
            await waitForSocketConnection(socket);

            const responsePromise = new Promise<unknown[]>((resolve) => {
              socket.once('user:created', (...args: unknown[]) => resolve(args));
            });
            socket.emit('user:notify', { name: 'Name' }, 2, 'email');

            expect(await responsePromise).toEqual([{ id: '1' }, 'server']);
          });
        },
      );
    });
  });
}
