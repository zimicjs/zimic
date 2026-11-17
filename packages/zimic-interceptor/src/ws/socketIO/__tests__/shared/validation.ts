import { waitFor } from '@zimic/utils/time';
import { createInvalidTypeOfCases, ValidationError } from '@zimic/utils/validation';
import { WebSocketClient, type WebSocketSchema } from '@zimic/ws';
import color from 'picocolors';
import * as defaultParser from 'socket.io-parser';
import type { Packet } from 'socket.io-parser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { usingSocket, waitForSocketConnection } from '@tests/utils/socketIO';
import { waitForWebSocketClientClose } from '@tests/utils/webSocket';

import DuplicateSocketIONamespaceError from '../../errors/DuplicateSocketIONamespaceError';
import MismatchedSocketIOProtocolOptionsError from '../../errors/MismatchedSocketIOProtocolOptionsError';
import SharedSocketIOProtocolError from '../../errors/SharedSocketIOProtocolError';
import { createSocketIOProtocol } from '../../factory';
import type { SocketIOParser, SocketIOProtocolOptions } from '../../types/options';
import {
  AnySchema,
  createSocketIOInterceptorOptions,
  createSocketIOPollingInterceptor,
  getSocketIOBaseURL,
  SharedSocketIOProtocolTestsOptions,
  SocketIOPollingInterceptor,
  SocketIOTestSavingOptions,
} from './utils';

type PlainSchema = WebSocketSchema<{ '/': { message: string } }>;

export function declareValidationSocketIOProtocolTests(options: SharedSocketIOProtocolTestsOptions) {
  const { type, getBaseURL: getServerBaseURL, PollingTransport } = options;

  let baseURL: string;
  let polling: SocketIOPollingInterceptor;

  beforeEach(() => {
    baseURL = getSocketIOBaseURL(getServerBaseURL());
    polling = createSocketIOPollingInterceptor(type, baseURL);
  });

  function getSocketIOInterceptorOptions(
    protocolOptions?: SocketIOProtocolOptions,
    savingOptions?: SocketIOTestSavingOptions,
  ) {
    return createSocketIOInterceptorOptions({ type, baseURL, polling }, protocolOptions, savingOptions);
  }

  // Local interceptors serve Socket.IO over polling only.
  if (type === 'remote') {
    describe('Unsupported versions', () => {
      const unsupportedVersionCases = [
        { versionDescription: 'EIO=3', query: 'EIO=3&transport=websocket', version: '3' },
        { versionDescription: 'no Engine.IO version', query: 'transport=websocket', version: 'unknown' },
      ];

      it.each(unsupportedVersionCases)(
        'should close WebSocket connections with an unsupported Engine.IO version ($versionDescription)',
        async ({ query, version }) => {
          await usingIgnoredConsole(['warn'], async () => {
            await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
              const client = new WebSocketClient<PlainSchema>(`${baseURL}/?${query}`);

              try {
                const closeEventPromise = waitForWebSocketClientClose(client);
                await client.open();

                const closeEvent = await closeEventPromise;
                expect(closeEvent.code).toBe(4000);
                expect(closeEvent.reason).toBe(
                  `Engine.IO protocol version ${version} is not supported. Use version 4.`,
                );
              } finally {
                await client.close();
              }
            });
          });
        },
      );

      it.each(unsupportedVersionCases)(
        'should log unsupported Engine.IO versions of WebSocket connections ($versionDescription)',
        async ({ query, version }) => {
          await usingIgnoredConsole(['warn'], async (console) => {
            await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
              const client = new WebSocketClient<PlainSchema>(`${baseURL}/?${query}`);

              try {
                const closeEventPromise = waitForWebSocketClientClose(client);
                await client.open();
                await closeEventPromise;
              } finally {
                await client.close();
              }

              expect(console.warn).toHaveBeenCalledWith(
                color.cyan('[@zimic/interceptor]'),
                `Engine.IO protocol version ${version} is not supported. Use version 4.`,
              );
              expect(console.warn).toHaveBeenCalledTimes(1);
            });
          });
        },
      );
    });
  }

  describe('Outgoing messages', () => {
    const circularMessage: { self?: unknown } = {};
    circularMessage.self = circularMessage;

    it.each(createInvalidTypeOfCases('object'))(
      'should reject sending messages that are not objects ($label)',
      async ({ value, actualType }) => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
            await waitForSocketConnection(socket);

            expect(() => {
              // @ts-expect-error Forcing an invalid message type.
              interceptor.clients[0].send(value);
            }).toThrow(new ValidationError(`Expected message to be object, but got ${actualType}.`));
          });
        });
      },
    );

    it.each(createInvalidTypeOfCases('string'))(
      'should reject sending messages with a type that is not a string ($label)',
      async ({ value, actualType }) => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
          await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
            await waitForSocketConnection(socket);

            expect(() => {
              // @ts-expect-error Forcing an invalid message type field.
              interceptor.clients[0].send({ type: value });
            }).toThrow(new ValidationError(`Expected message.type to be string, but got ${actualType}.`));
          });
        });
      },
    );

    it.each([
      {
        messageDescription: 'an object without a type or ack ID',
        message: { data: 1 },
        expectedError: new ValidationError(
          'Socket.IO messages must be objects with `type` or `ackId`, but received: {"data":1}.',
        ),
      },
      {
        messageDescription: 'an object with a nested bigint',
        message: { data: 1n },
        expectedError: new ValidationError(
          'Socket.IO messages must be objects with `type` or `ackId`, but received: [object Object].',
        ),
      },
      {
        messageDescription: 'a circular object',
        message: circularMessage,
        expectedError: new ValidationError(
          'Socket.IO messages must be objects with `type` or `ackId`, but received: [object Object].',
        ),
      },
      {
        messageDescription: 'an object with an undefined ack ID',
        message: { ackId: undefined },
        expectedError: new ValidationError(
          'Socket.IO messages must be objects with `type` or `ackId`, but received: {}.',
        ),
      },
      {
        messageDescription: 'an event with a reserved name',
        message: { type: 'disconnect' },
        expectedError: new ValidationError(
          'Socket.IO messages must not have a reserved `type` or a non-integer `ackId`, but received: {"type":"disconnect"}.',
        ),
      },
      {
        messageDescription: 'an acknowledgement with a fractional ack ID',
        message: { ackId: 1.5 },
        expectedError: new ValidationError(
          'Socket.IO messages must not have a reserved `type` or a non-integer `ackId`, but received: {"ackId":1.5}.',
        ),
      },
      {
        messageDescription: 'an event with an ack ID',
        message: { type: 'event', data: 1, ackId: 1 },
        expectedError: new ValidationError(
          'Socket.IO events sent by interceptors must not have an `ackId`, but received: {"type":"event","data":1,"ackId":1}.',
        ),
      },
      {
        messageDescription: 'a binary attachment as a blob',
        message: { type: 'file', data: new Blob(['data']) },
        expectedError: new ValidationError(
          'Socket.IO binary attachments sent by interceptors must be ArrayBuffers or views.',
        ),
      },
    ])('should reject sending $messageDescription', async ({ message, expectedError }) => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
          await waitForSocketConnection(socket);

          expect(() => {
            // @ts-expect-error The objects without `type` or `ackId` of the rows are invalid messages.
            interceptor.clients[0].send(message);
          }).toThrow(expectedError);
        });
      });
    });

    it('should keep the connection open after rejecting a message', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
          await waitForSocketConnection(socket);

          expect(() => {
            interceptor.clients[0].send({ type: 'disconnect' });
          }).toThrow(ValidationError);

          const eventPromise = new Promise<unknown>((resolve) => {
            socket.once('event', resolve);
          });
          interceptor.clients[0].send({ type: 'event', data: 'data' });

          expect(await eventPromise).toBe('data');
          expect(socket.connected).toBe(true);
        });
      });
    });

    it('should reject messages that the parser does not encode into arrays of chunks', async () => {
      // Encodes events into a bare chunk, as parsers declaring `encode(): ArrayBuffer` describe their output.
      class BareChunkEventEncoder {
        private encoder = new defaultParser.Encoder();

        encode(packet: Packet): unknown {
          const chunks: unknown[] = this.encoder.encode(packet);
          return packet.type === defaultParser.PacketType.EVENT ? chunks[0] : chunks;
        }
      }

      const parser: SocketIOParser = { Encoder: BareChunkEventEncoder, Decoder: defaultParser.Decoder };

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions({ parser }), async (interceptor) => {
        await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
          await waitForSocketConnection(socket);

          expect(() => {
            interceptor.clients[0].send({ type: 'event', data: 'data' });
          }).toThrow(new ValidationError('Socket.IO parsers must encode packets into arrays of chunks.'));
        });
      });
    });

    it('should log the error of parsers that do not encode namespace connection replies into arrays of chunks', async () => {
      // Encodes connection replies into a bare chunk, as parsers declaring `encode(): ArrayBuffer` describe their output.
      class BareChunkConnectEncoder {
        private encoder = new defaultParser.Encoder();

        encode(packet: Packet): unknown {
          const chunks: unknown[] = this.encoder.encode(packet);
          return packet.type === defaultParser.PacketType.CONNECT ? chunks[0] : chunks;
        }
      }

      const parser: SocketIOParser = { Encoder: BareChunkConnectEncoder, Decoder: defaultParser.Decoder };

      await usingIgnoredConsole(['error'], async (console) => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions({ parser }), async () => {
          await usingSocket(baseURL, { transports: [PollingTransport] }, async () => {
            await waitFor(() => {
              expect(console.error).toHaveBeenCalledWith(
                new ValidationError('Socket.IO parsers must encode packets into arrays of chunks.'),
              );
            });
            expect(console.error).toHaveBeenCalledTimes(1);
          });
        });
      });
    });

    it('should log the error of parsers that do not encode namespace disconnections into arrays of chunks', async () => {
      // Encodes disconnections into a bare chunk, as parsers declaring `encode(): ArrayBuffer` describe their output.
      class BareChunkDisconnectEncoder {
        private encoder = new defaultParser.Encoder();

        encode(packet: Packet): unknown {
          const chunks: unknown[] = this.encoder.encode(packet);
          return packet.type === defaultParser.PacketType.DISCONNECT ? chunks[0] : chunks;
        }
      }

      const parser: SocketIOParser = { Encoder: BareChunkDisconnectEncoder, Decoder: defaultParser.Decoder };

      await usingIgnoredConsole(['error'], async (console) => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions({ parser }), async (interceptor) => {
          await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
            await waitForSocketConnection(socket);

            await interceptor.clear();

            expect(console.error).toHaveBeenCalledWith(
              new ValidationError('Socket.IO parsers must encode packets into arrays of chunks.'),
            );
            expect(console.error).toHaveBeenCalledTimes(1);
          });
        });
      });
    });

    it('should release all clients on clear when the parser does not encode namespace disconnections into arrays of chunks', async () => {
      // Encodes disconnections into a bare chunk, as parsers declaring `encode(): ArrayBuffer` describe their output.
      class BareChunkDisconnectEncoder {
        private encoder = new defaultParser.Encoder();

        encode(packet: Packet): unknown {
          const chunks: unknown[] = this.encoder.encode(packet);
          return packet.type === defaultParser.PacketType.DISCONNECT ? chunks[0] : chunks;
        }
      }

      const parser: SocketIOParser = { Encoder: BareChunkDisconnectEncoder, Decoder: defaultParser.Decoder };

      await usingIgnoredConsole(['error'], async () => {
        await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions({ parser }), async (interceptor) => {
          await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
            await usingSocket(baseURL, { transports: [PollingTransport] }, async (otherSocket) => {
              await Promise.all([waitForSocketConnection(socket), waitForSocketConnection(otherSocket)]);
              expect(interceptor.clients).toHaveLength(2);

              await interceptor.clear();

              expect(interceptor.clients).toHaveLength(0);
            });
          });
        });
      });
    });
  });

  describe('Protocol instances', () => {
    it('should not allow one protocol instance to be used by two running interceptors', async () => {
      const protocol = createSocketIOProtocol({ polling });
      const otherBaseURL = `${baseURL}/other`;

      await usingWebSocketInterceptor<AnySchema>({ type, baseURL, protocol }, async () => {
        await usingIgnoredConsole(['error'], async () => {
          await expect(
            usingWebSocketInterceptor<AnySchema>({ type, baseURL: otherBaseURL, protocol }, vi.fn()),
          ).rejects.toThrow(new SharedSocketIOProtocolError());
        });
      });
    });

    it('should keep the running interceptor serving after rejecting a shared protocol instance', async () => {
      const protocol = createSocketIOProtocol({ polling });
      const otherBaseURL = `${baseURL}/other`;

      await usingWebSocketInterceptor<AnySchema>({ type, baseURL, protocol }, async (interceptor) => {
        await usingIgnoredConsole(['error'], async () => {
          await expect(
            usingWebSocketInterceptor<AnySchema>({ type, baseURL: otherBaseURL, protocol }, vi.fn()),
          ).rejects.toThrow(SharedSocketIOProtocolError);
        });

        await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
          await waitForSocketConnection(socket);
          expect(interceptor.clients).toHaveLength(1);
        });
      });
    });

    it('should not allow two running interceptors on the same namespace of a base URL', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingIgnoredConsole(['error'], async () => {
          await expect(usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), vi.fn())).rejects.toThrow(
            new DuplicateSocketIONamespaceError('/', interceptor.baseURL),
          );
        });
      });
    });

    it('should keep the running interceptor serving after rejecting a duplicate namespace', async () => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingIgnoredConsole(['error'], async () => {
          await expect(usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), vi.fn())).rejects.toThrow(
            DuplicateSocketIONamespaceError,
          );
        });

        await usingSocket(baseURL, { transports: [PollingTransport] }, async (socket) => {
          await waitForSocketConnection(socket);
          expect(interceptor.clients).toHaveLength(1);
        });
      });
    });

    it('should not allow the namespaces of a base URL to use different parsers', async () => {
      const otherParser: SocketIOParser = { Encoder: defaultParser.Encoder, Decoder: defaultParser.Decoder };

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingIgnoredConsole(['error'], async () => {
          await expect(
            usingWebSocketInterceptor<AnySchema>(
              getSocketIOInterceptorOptions({ namespace: '/admin', parser: otherParser }),
              vi.fn(),
            ),
          ).rejects.toThrow(new MismatchedSocketIOProtocolOptionsError('parser', interceptor.baseURL));
        });
      });
    });

    it('should not allow the namespaces of a base URL to use different polling interceptors', async () => {
      const otherPolling = createSocketIOPollingInterceptor(type, baseURL);

      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
        await usingIgnoredConsole(['error'], async () => {
          await expect(
            usingWebSocketInterceptor<AnySchema>(
              getSocketIOInterceptorOptions({ namespace: '/admin', polling: otherPolling }),
              vi.fn(),
            ),
          ).rejects.toThrow(new MismatchedSocketIOProtocolOptionsError('polling', interceptor.baseURL));
        });

        expect(otherPolling.isRunning).toBe(false);
      });
    });

    it.each(createInvalidTypeOfCases('string', { optional: true }))(
      'should throw an error if provided a namespace that is not a string ($label)',
      ({ value, actualType }) => {
        expect(() => {
          // @ts-expect-error Forcing an invalid namespace type.
          createSocketIOProtocol({ namespace: value });
        }).toThrow(new ValidationError(`Expected options.namespace to be string, but got ${actualType}.`));
      },
    );

    it.each(createInvalidTypeOfCases('object', { optional: true }))(
      'should throw an error if provided a polling interceptor that is not an object ($label)',
      ({ value, actualType }) => {
        expect(() => {
          // @ts-expect-error Forcing an invalid polling interceptor type.
          createSocketIOProtocol({ polling: value });
        }).toThrow(new ValidationError(`Expected options.polling to be object, but got ${actualType}.`));
      },
    );

    it.each(createInvalidTypeOfCases('object', { optional: true }))(
      'should throw an error if provided a parser that is not an object ($label)',
      ({ value, actualType }) => {
        expect(() => {
          // @ts-expect-error Forcing an invalid parser type.
          createSocketIOProtocol({ parser: value });
        }).toThrow(new ValidationError(`Expected options.parser to be object, but got ${actualType}.`));
      },
    );

    it.each(createInvalidTypeOfCases('function'))(
      'should throw an error if provided a parser encoder that is not a function ($label)',
      ({ value, actualType }) => {
        expect(() => {
          // @ts-expect-error Forcing an invalid parser encoder type.
          createSocketIOProtocol({ parser: { Encoder: value, Decoder: defaultParser.Decoder } });
        }).toThrow(new ValidationError(`Expected options.parser.Encoder to be function, but got ${actualType}.`));
      },
    );

    it.each(createInvalidTypeOfCases('function'))(
      'should throw an error if provided a parser decoder that is not a function ($label)',
      ({ value, actualType }) => {
        expect(() => {
          // @ts-expect-error Forcing an invalid parser decoder type.
          createSocketIOProtocol({ parser: { Encoder: defaultParser.Encoder, Decoder: value } });
        }).toThrow(new ValidationError(`Expected options.parser.Decoder to be function, but got ${actualType}.`));
      },
    );
  });
}
