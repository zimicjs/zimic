import { decodePacket } from 'engine.io-parser';
import * as defaultParser from 'socket.io-parser';

import { isServerSide } from '@/utils/environment';
import { isWebSocketBinaryMessageData, normalizeBufferSource } from '@/ws/utils/messageData';

import type {
  WebSocketInterceptorProtocol,
  WebSocketInterceptorProtocolFrame,
  WebSocketInterceptorProtocolRawConnection,
} from '../interceptor/types/protocol';
import type { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';
import { INTERNAL_PROTOCOL_BRAND, type InternalWebSocketInterceptorProtocol } from '../utils/protocol';
import {
  getOrCreateSocketIOEngine,
  SocketIOEngine,
  SocketIOEngineMember,
  SocketIOEngineSession,
} from './SocketIOEngine';
import type { SocketIOMessage, SocketIOPacket, SocketIOParser, SocketIOProtocolOptions } from './types';

const { PacketType } = defaultParser;

const DEFAULT_NAMESPACE = '/';
const DEFAULT_PING_INTERVAL = 25000;
const DEFAULT_PING_TIMEOUT = 20000;

const ENGINE_IO_MESSAGE_PACKET_PREFIX = '4';

interface SocketIODecoderState {
  decoder: InstanceType<SocketIOParser['Decoder']>;
  decodedPackets: SocketIOPacket[];
}

class SocketIOProtocol<Message extends SocketIOMessage>
  implements InternalWebSocketInterceptorProtocol<Message>, SocketIOEngineMember
{
  readonly [INTERNAL_PROTOCOL_BRAND] = true;

  interceptor!: AnyWebSocketInterceptorImplementation;

  private engine?: SocketIOEngine;
  private encoder: InstanceType<SocketIOParser['Encoder']>;
  private decoderStates = new WeakMap<SocketIOEngineSession, SocketIODecoderState>();

  constructor(private options: Required<Omit<SocketIOProtocolOptions, 'parser'>> & { parser: SocketIOParser }) {
    this.encoder = new options.parser.Encoder();
  }

  get namespace() {
    return this.options.namespace;
  }

  async start(interceptor: AnyWebSocketInterceptorImplementation) {
    if (this.engine) {
      throw new Error('A Socket.IO protocol can be used by only one running interceptor. Create one for each of them.');
    }

    this.interceptor = interceptor;
    this.engine = getOrCreateSocketIOEngine(interceptor, this.options);

    // The interceptor stops only protocols that started, so a failed start undoes itself.
    try {
      await this.engine.start(this);
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop() {
    await this.engine?.stop(this);
    this.engine = undefined;
  }

  clear() {
    this.engine?.clear(this);
  }

  claimConnection(url: string, connection: WebSocketInterceptorProtocolRawConnection) {
    return this.engine?.claimConnection(url, connection);
  }

  receiveFrame(session: SocketIOEngineSession, frame: WebSocketInterceptorProtocolFrame) {
    const packet = decodePacket(frame, 'arraybuffer');

    if (packet.type !== 'message') {
      return;
    }

    for (const socketPacket of this.decodeSocketPackets(this.convertChunkForParser(packet.data), session)) {
      this.handleSocketPacket(socketPacket, session);
    }
  }

  // On Node.js, custom parsers such as `socket.io-msgpack-parser` read binary chunks as buffers, as a Socket.IO server
  // gives them. The default parser keeps array buffers, which is how handlers receive binary attachments.
  private convertChunkForParser(chunk: unknown) {
    const needsNodeBuffer = this.options.parser !== defaultParser && isServerSide() && chunk instanceof ArrayBuffer;
    return needsNodeBuffer ? Buffer.from(chunk) : chunk;
  }

  // Decoders emit each packet when it is complete, which spans several frames for binary attachments.
  private decodeSocketPackets(chunk: unknown, session: SocketIOEngineSession) {
    const state = this.getOrCreateDecoderState(session);
    state.decoder.add(chunk);
    return state.decodedPackets.splice(0);
  }

  private getOrCreateDecoderState(session: SocketIOEngineSession) {
    const existingState = this.decoderStates.get(session);

    if (existingState) {
      return existingState;
    }

    const state: SocketIODecoderState = { decoder: new this.options.parser.Decoder(), decodedPackets: [] };
    state.decoder.on('decoded', (packet) => state.decodedPackets.push(packet));

    this.decoderStates.set(session, state);
    return state;
  }

  private handleSocketPacket(packet: SocketIOPacket, session: SocketIOEngineSession) {
    if (packet.type === PacketType.CONNECT) {
      this.engine?.handleConnectPacket(this, session, packet.nsp);
      return;
    }

    const client = packet.nsp === this.options.namespace ? session.clients.get(this) : undefined;

    if (!client) {
      return;
    }

    if (packet.type === PacketType.DISCONNECT) {
      this.engine?.leaveNamespace(this, session);
    } else if (packet.type === PacketType.EVENT || packet.type === PacketType.BINARY_EVENT) {
      this.interceptor.handleProtocolMessage(client, this.createEventMessage(packet));
    }
  }

  sendSocketPacket(session: SocketIOEngineSession, packet: SocketIOPacket) {
    for (const frame of this.encodeSocketPacket(packet)) {
      session.transport.send(frame);
    }
  }

  private createEventMessage(packet: SocketIOPacket): SocketIOMessage {
    const [type, data, ...args] = packet.data as [string, unknown, ...unknown[]];

    return {
      type,
      data,
      ...(args.length > 0 && { args }),
      ...(packet.id !== undefined && { ackId: packet.id }),
    };
  }

  encode(message: Message): WebSocketInterceptorProtocolFrame[] {
    if (typeof message !== 'object' || (!('type' in message) && !('ackId' in message))) {
      throw new TypeError(
        `Socket.IO messages must be objects with \`type\` or \`ackId\`, but received: ${String(message)}.`,
      );
    }

    return this.encodeSocketPacket(this.createSocketPacket(message));
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

  private encodeSocketPacket(packet: SocketIOPacket) {
    return this.encoder.encode(packet).map((encodedChunk) => this.createEngineFrame(encodedChunk));
  }

  private createEngineFrame(encodedChunk: unknown): WebSocketInterceptorProtocolFrame {
    if (typeof encodedChunk === 'string') {
      return `${ENGINE_IO_MESSAGE_PACKET_PREFIX}${encodedChunk}`;
    }

    if (!isWebSocketBinaryMessageData(encodedChunk) || encodedChunk instanceof Blob) {
      throw new TypeError('Socket.IO binary attachments sent by interceptors must be ArrayBuffers or views.');
    }

    return normalizeBufferSource(encodedChunk);
  }
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Creates a protocol for the `protocol` option of `createWebSocketInterceptor`, to mock Socket.IO servers with
 * interceptor handlers. Handlers receive events as `{ type, data, args?, ackId? }`, and the protocol answers the
 * Engine.IO and Socket.IO handshakes and pings. Supports Socket.IO v3 and v4 (Engine.IO protocol 4, Socket.IO protocol
 * 5).
 *
 * Polling, enabled by default, intercepts HTTP requests to `<base URL>/socket.io/`. Use one protocol and one
 * interceptor for each namespace and base URL. Interceptors of namespaces on the same base URL share a connection, and
 * the first one started sets the `polling`, `pingInterval`, and `pingTimeout` options. Each interceptor lists a client
 * for each socket that joins its namespace.
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
    pingInterval: options.pingInterval ?? DEFAULT_PING_INTERVAL,
    pingTimeout: options.pingTimeout ?? DEFAULT_PING_TIMEOUT,
  });
}
