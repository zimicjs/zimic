import { ValidationError } from '@zimic/utils/validation';
import * as defaultParser from 'socket.io-parser';

import type {
  WebSocketInterceptorProtocol,
  WebSocketInterceptorProtocolFrame,
  WebSocketInterceptorProtocolRawConnection,
} from '../interceptor/types/protocol';
import type { InternalWebSocketInterceptorClient } from '../interceptor/WebSocketInterceptorHandle';
import type { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';
import { INTERNAL_PROTOCOL_BRAND, type InternalWebSocketInterceptorProtocol } from '../utils/protocol';
import SharedSocketIOProtocolError from './errors/SharedSocketIOProtocolError';
import {
  deleteSocketIOEngine,
  encodeSocketIOPacket,
  getOrCreateSocketIOEngine,
  SocketIOEngine,
} from './SocketIOEngine';
import type { SocketIOMessage, SocketIOPacket, SocketIOParser, SocketIOProtocolOptions } from './types';

const { PacketType } = defaultParser;

const DEFAULT_NAMESPACE = '/';

class SocketIOProtocol<Message extends SocketIOMessage> implements InternalWebSocketInterceptorProtocol<Message> {
  readonly [INTERNAL_PROTOCOL_BRAND] = true;

  interceptor!: AnyWebSocketInterceptorImplementation;

  private engine?: SocketIOEngine;
  private encoder: InstanceType<SocketIOParser['Encoder']>;

  constructor(private options: Required<Omit<SocketIOProtocolOptions, 'parser'>> & { parser: SocketIOParser }) {
    this.encoder = new options.parser.Encoder();
  }

  get namespace() {
    return this.options.namespace;
  }

  get parser() {
    return this.options.parser;
  }

  async start(interceptor: AnyWebSocketInterceptorImplementation) {
    if (this.engine) {
      throw new SharedSocketIOProtocolError();
    }

    this.interceptor = interceptor;

    const engine = getOrCreateSocketIOEngine(interceptor, this.options);
    const engineStart = engine.start(this);
    this.engine = engine;

    // The interceptor stops only protocols that started, so a failed start undoes itself.
    try {
      await engineStart;
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop() {
    const engineStop = this.engine?.stop(this);

    if (this.engine?.isStopping) {
      deleteSocketIOEngine(this.interceptor);
    }

    await engineStop;
    this.engine = undefined;
  }

  clear() {
    this.engine?.clear(this);
  }

  claimConnection(url: string, connection: WebSocketInterceptorProtocolRawConnection) {
    return this.engine?.claimConnection(url, connection);
  }

  // Parsers such as `socket.io-parser` accept event names that are not strings, which handlers do not expect.
  receiveEventPacket(client: InternalWebSocketInterceptorClient, packet: SocketIOPacket) {
    if (!Array.isArray(packet.data)) {
      return;
    }

    const [type, ...socketArguments]: unknown[] = packet.data;

    if (typeof type !== 'string') {
      return;
    }

    const [data, ...args] = socketArguments;

    this.interceptor.handleProtocolMessage(client, {
      type,
      data,
      ...(args.length > 0 && { args }),
      ...(packet.id !== undefined && { ackId: packet.id }),
    } satisfies SocketIOMessage);
  }

  // Messages come from user code that may bypass the schema types.
  encode(message: Message | null): WebSocketInterceptorProtocolFrame[] {
    if (typeof message !== 'object' || message === null || (!('type' in message) && !('ackId' in message))) {
      throw new ValidationError(
        `Socket.IO messages must be objects with \`type\` or \`ackId\`, but received: ${String(message)}.`,
      );
    }

    return encodeSocketIOPacket(this.encoder, this.createSocketPacket(message));
  }

  private createSocketPacket(message: SocketIOMessage): SocketIOPacket {
    const { namespace } = this.options;

    const hasNoArguments = message.data === undefined && message.args === undefined;
    const socketArguments = hasNoArguments ? [] : [message.data, ...(message.args ?? [])];

    if ('type' in message) {
      return { type: PacketType.EVENT, nsp: namespace, data: [message.type, ...socketArguments] };
    }

    return { type: PacketType.ACK, nsp: namespace, id: message.ackId, data: socketArguments };
  }
}

export type { SocketIOProtocol };

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Creates a protocol for the `protocol` option of `createWebSocketInterceptor`, to mock Socket.IO servers with
 * interceptor handlers. Handlers receive events as `{ type, data, args?, ackId? }`, and the protocol answers the
 * Engine.IO and Socket.IO handshakes and pings. Supports Socket.IO v3 and v4 (Engine.IO protocol 4, Socket.IO protocol
 * 5).
 *
 * Polling, enabled by default, intercepts HTTP requests to `<base URL>/socket.io/`. Use one protocol and one
 * interceptor for each namespace and base URL. Interceptors of namespaces on the same base URL share a connection and
 * must use the same `parser`, and the first one started sets the `polling` option. Each interceptor lists a client for
 * each socket that joins its namespace.
 *
 * @example
 *   const interceptor = createWebSocketInterceptor<SocketIOSchema<ServerToClientEvents, ClientToServerEvents>>({
 *     baseURL: 'ws://localhost:3000',
 *     protocol: createSocketIOProtocol(),
 *   });
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#createsocketioprotocol `createSocketIOProtocol` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io Mocking Socket.IO servers}
 */
export function createSocketIOProtocol<Message extends SocketIOMessage = SocketIOMessage>(
  options: SocketIOProtocolOptions = {},
): WebSocketInterceptorProtocol<Message> {
  return new SocketIOProtocol<Message>({
    namespace: options.namespace ?? DEFAULT_NAMESPACE,
    polling: options.polling ?? true,
    parser: options.parser ?? defaultParser,
  });
}
