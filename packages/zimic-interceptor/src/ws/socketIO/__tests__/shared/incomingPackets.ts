import { waitFor } from '@zimic/utils/time';
import type { ManagerOptions } from 'socket.io-client';
import * as defaultParser from 'socket.io-parser';
import type { Packet } from 'socket.io-parser';
import { beforeEach, expect, it } from 'vitest';

import { usingIgnoredConsole } from '@tests/utils/console';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { usingSocket, waitForSocketConnection } from '@tests/utils/socketIO';

import type { SocketIOParser, SocketIOProtocolOptions } from '../../types/options';
import {
  AnySchema,
  createSocketIOInterceptorOptions,
  createSocketIOPollingInterceptor,
  getSocketIOBaseURL,
  MESSAGE_SAVING,
  SharedSocketIOProtocolTestsOptions,
  SocketIOPollingInterceptor,
  SocketIOTestSavingOptions,
} from './utils';

const POLLING_PACKET_SEPARATOR = '\x1e';

export function declareIncomingPacketsSocketIOProtocolTests(options: SharedSocketIOProtocolTestsOptions) {
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

  const pollingTransports: ManagerOptions['transports'] = [PollingTransport];

  it('should keep one client when a socket sends a second connect packet for its namespace', async () => {
    await usingWebSocketInterceptor<AnySchema>(
      getSocketIOInterceptorOptions({}, MESSAGE_SAVING),
      async (interceptor) => {
        const handler = await interceptor.message().with({ type: 'event' }).times(1);

        await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
          await waitForSocketConnection(socket);

          await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling&sid=${socket.io.engine.id}`, {
            method: 'POST',
            body: '40',
          });

          socket.emit('event', 'after second connect');
          await waitFor(() => expect(handler.messages).toHaveLength(1));

          expect(interceptor.clients).toHaveLength(1);
          expect(socket.connected).toBe(true);
        });
      },
    );
  });

  it('should handle the packets after a malformed one in a polling payload', async () => {
    await usingIgnoredConsole(['error'], async () => {
      await usingWebSocketInterceptor<AnySchema>(
        getSocketIOInterceptorOptions({}, MESSAGE_SAVING),
        async (interceptor) => {
          const handler = await interceptor.message().with({ type: 'event' }).times(1);

          await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
            await waitForSocketConnection(socket);

            await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling&sid=${socket.io.engine.id}`, {
              method: 'POST',
              body: ['42[malformed', '42["event","valid"]'].join(POLLING_PACKET_SEPARATOR),
            });

            await waitFor(() => expect(handler.messages).toHaveLength(1));
            expect(handler.messages[0].data).toStrictEqual({ type: 'event', data: 'valid' });
          });
        },
      );
    });
  });

  it('should log malformed packets in a polling payload', async () => {
    await usingIgnoredConsole(['error'], async (console) => {
      await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async () => {
        await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
          await waitForSocketConnection(socket);

          await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling&sid=${socket.io.engine.id}`, {
            method: 'POST',
            body: '42[malformed',
          });

          await waitFor(() => expect(console.error).toHaveBeenCalledTimes(1));
          expect(console.error).toHaveBeenCalledWith(new Error('invalid payload'));
        });
      });
    });
  });

  it('should ignore the packets after a close packet in a polling payload', async () => {
    const pollingURL = `${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`;

    await usingWebSocketInterceptor<AnySchema>(getSocketIOInterceptorOptions(), async (interceptor) => {
      const openPacket = await (await fetch(pollingURL)).text();
      const { sid } = JSON.parse(openPacket.slice(1)) as { sid: string };

      await fetch(`${pollingURL}&sid=${sid}`, {
        method: 'POST',
        body: ['1', '40'].join(POLLING_PACKET_SEPARATOR),
      });

      // Connections are decided in order, so the next socket connects after a connection from the payload would.
      await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
        await waitForSocketConnection(socket);
        expect(interceptor.clients).toHaveLength(1);
      });
    });
  });

  it('should not intercept events whose name is not a string', async () => {
    await usingWebSocketInterceptor<AnySchema>(
      getSocketIOInterceptorOptions({}, MESSAGE_SAVING),
      async (interceptor) => {
        const handler = await interceptor.message();

        await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
          await waitForSocketConnection(socket);

          await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling&sid=${socket.io.engine.id}`, {
            method: 'POST',
            body: ['42[1,"numeric"]', '42["event","valid"]'].join(POLLING_PACKET_SEPARATOR),
          });

          await waitFor(() => expect(handler.messages).toHaveLength(1));
          expect(handler.messages[0].data).toStrictEqual({ type: 'event', data: 'valid' });
        });
      },
    );
  });

  // Decodes `bare` events without arguments, which the default parser never does.
  class BareEventDecoder {
    private decoder = new defaultParser.Decoder();

    add(chunk: unknown) {
      this.decoder.add(chunk);
    }

    on(event: 'decoded', listener: (packet: Packet) => void) {
      return this.decoder.on(event, (packet) => {
        const isBareEvent = Array.isArray(packet.data) && packet.data[0] === 'bare';
        listener(isBareEvent ? { ...packet, data: null } : packet);
      });
    }
  }

  const bareEventParser: SocketIOParser = { Encoder: defaultParser.Encoder, Decoder: BareEventDecoder };

  it('should not intercept events that the parser decodes without an array of arguments', async () => {
    await usingWebSocketInterceptor<AnySchema>(
      getSocketIOInterceptorOptions({ parser: bareEventParser }, MESSAGE_SAVING),
      async (interceptor) => {
        const handler = await interceptor.message();

        await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
          await waitForSocketConnection(socket);

          socket.emit('bare');
          socket.emit('event', 'valid');

          await waitFor(() => expect(handler.messages).toHaveLength(1));
          expect(handler.messages[0].data).toStrictEqual({ type: 'event', data: 'valid' });
        });
      },
    );
  });

  it('should not log events that the parser decodes without an array of arguments', async () => {
    await usingIgnoredConsole(['error'], async (console) => {
      await usingWebSocketInterceptor<AnySchema>(
        getSocketIOInterceptorOptions({ parser: bareEventParser }, MESSAGE_SAVING),
        async (interceptor) => {
          const handler = await interceptor.message();

          await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
            await waitForSocketConnection(socket);

            socket.emit('bare');
            socket.emit('event', 'valid');

            // Packets are handled in order, so the bare event was handled once the valid one is.
            await waitFor(() => expect(handler.messages).toHaveLength(1));
            expect(console.error).not.toHaveBeenCalled();
          });
        },
      );
    });
  });

  it('should not intercept acks sent by clients', async () => {
    await usingWebSocketInterceptor<AnySchema>(
      getSocketIOInterceptorOptions({}, MESSAGE_SAVING),
      async (interceptor) => {
        const handler = await interceptor.message();

        await usingSocket(baseURL, { transports: pollingTransports }, async (socket) => {
          await waitForSocketConnection(socket);

          await fetch(`${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling&sid=${socket.io.engine.id}`, {
            method: 'POST',
            body: ['431["ack"]', '42["event","valid"]'].join(POLLING_PACKET_SEPARATOR),
          });

          await waitFor(() => expect(handler.messages).toHaveLength(1));
          expect(handler.messages[0].data).toStrictEqual({ type: 'event', data: 'valid' });
        });
      },
    );
  });

  it('should not intercept events of sessions that did not connect to the namespace', async () => {
    const pollingURL = `${baseURL.replace(/^ws/, 'http')}/?EIO=4&transport=polling`;

    await usingWebSocketInterceptor<AnySchema>(
      getSocketIOInterceptorOptions({}, MESSAGE_SAVING),
      async (interceptor) => {
        const handler = await interceptor.message();

        const openPacket = await (await fetch(pollingURL)).text();
        const { sid } = JSON.parse(openPacket.slice(1)) as { sid: string };
        const sessionURL = `${pollingURL}&sid=${sid}`;

        await fetch(sessionURL, { method: 'POST', body: '42["event","before connect"]' });
        await fetch(sessionURL, { method: 'POST', body: '40' });

        const connectReply = await (await fetch(sessionURL)).text();
        expect(connectReply).toMatch(/^40\{"sid":/);

        await fetch(sessionURL, { method: 'POST', body: '42["event","after connect"]' });

        await waitFor(() => expect(handler.messages).toHaveLength(1));
        expect(handler.messages[0].data).toStrictEqual({ type: 'event', data: 'after connect' });
      },
    );
  });
}
