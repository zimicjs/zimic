import { decodePacket } from 'engine.io-parser';
import * as defaultParser from 'socket.io-parser';

import { isServerSide } from '@/utils/environment';
import { logger } from '@/utils/logging';
import { isWebSocketBinaryMessageData, normalizeBufferSource } from '@/ws/utils/messageData';

import type {
  InternalWebSocketInterceptorProtocol,
  WebSocketInterceptorProtocol,
  WebSocketInterceptorProtocolClient,
  WebSocketInterceptorProtocolFrame,
  WebSocketInterceptorProtocolHost,
  WebSocketInterceptorProtocolRawConnection,
} from '../interceptor/types/protocol';
import {
  createUnsupportedEngineIOVersionMessage,
  getOrCreateSocketIOEngine,
  SocketIOEngine,
  SocketIOEngineMember,
  SUPPORTED_ENGINE_IO_VERSION,
} from './SocketIOEngine';
import type { SocketIOMessage, SocketIOPacket, SocketIOParser, SocketIOProtocolOptions } from './types';

const { PacketType } = defaultParser;

const DEFAULT_NAMESPACE = '/';
const DEFAULT_PING_INTERVAL = 25000;
const DEFAULT_PING_TIMEOUT = 20000;

// A code in the application range, because Socket.IO has no close code for a refused protocol version.
const UNSUPPORTED_VERSION_CLOSE_CODE = 4000;

const ENGINE_IO_MESSAGE_PACKET_PREFIX = '4';

interface SocketIODecoderState {
  decoder: InstanceType<SocketIOParser['Decoder']>;
  decodedPackets: SocketIOPacket[];
}

class SocketIOProtocol implements InternalWebSocketInterceptorProtocol<SocketIOMessage>, SocketIOEngineMember {
  host!: WebSocketInterceptorProtocolHost;

  private engine?: SocketIOEngine;
  private encoder: InstanceType<SocketIOParser['Encoder']>;
  private decoderStates = new WeakMap<WebSocketInterceptorProtocolClient, SocketIODecoderState>();

  constructor(private options: Required<Omit<SocketIOProtocolOptions, 'parser'>> & { parser: SocketIOParser }) {
    this.encoder = new options.parser.Encoder();
  }

  async start(host: WebSocketInterceptorProtocolHost) {
    this.host = host;
    this.engine = getOrCreateSocketIOEngine(host, this.options);
    await this.engine.attach(this);
  }

  async stop() {
    await this.engine?.detach(this);
    this.engine = undefined;
  }

  closeClients() {
    this.engine?.closeMemberClients(this);
  }

  claimConnection(url: string, connection: WebSocketInterceptorProtocolRawConnection) {
    return this.engine?.claimConnection(url, connection);
  }

  onConnection = (client: WebSocketInterceptorProtocolClient) => {
    const version = new URL(client.url).searchParams.get('EIO');

    if (version !== SUPPORTED_ENGINE_IO_VERSION) {
      const message = createUnsupportedEngineIOVersionMessage(version);
      logger.warn(message);
      client.close(UNSUPPORTED_VERSION_CLOSE_CODE, message);
      return undefined;
    }

    return this.engine?.connectClient(this, client);
  };

  decode(frame: WebSocketInterceptorProtocolFrame, client: WebSocketInterceptorProtocolClient): SocketIOMessage[] {
    const packet = decodePacket(frame, 'arraybuffer');

    if (packet.type !== 'message') {
      return [];
    }

    return this.decodeSocketPackets(this.convertChunkForParser(packet.data), client).flatMap((socketPacket) => {
      return socketPacket.nsp === this.options.namespace ? this.handleSocketPacket(socketPacket, client) : [];
    });
  }

  // On Node.js, custom parsers such as `socket.io-msgpack-parser` read binary chunks as buffers, as a Socket.IO server
  // gives them. The default parser keeps array buffers, which is how handlers receive binary attachments.
  private convertChunkForParser(chunk: unknown) {
    const needsNodeBuffer = this.options.parser !== defaultParser && isServerSide() && chunk instanceof ArrayBuffer;
    return needsNodeBuffer ? Buffer.from(chunk) : chunk;
  }

  // Decoders emit each packet when it is complete, which spans several frames for binary attachments.
  private decodeSocketPackets(chunk: unknown, client: WebSocketInterceptorProtocolClient) {
    const state = this.getOrCreateDecoderState(client);
    state.decoder.add(chunk);
    return state.decodedPackets.splice(0);
  }

  private getOrCreateDecoderState(client: WebSocketInterceptorProtocolClient) {
    const existingState = this.decoderStates.get(client);

    if (existingState) {
      return existingState;
    }

    const state: SocketIODecoderState = { decoder: new this.options.parser.Decoder(), decodedPackets: [] };
    state.decoder.on('decoded', (packet) => state.decodedPackets.push(packet));

    this.decoderStates.set(client, state);
    return state;
  }

  private handleSocketPacket(packet: SocketIOPacket, client: WebSocketInterceptorProtocolClient): SocketIOMessage[] {
    if (packet.type === PacketType.CONNECT) {
      this.sendConnectReply(client);
      return [];
    }

    if (packet.type === PacketType.EVENT || packet.type === PacketType.BINARY_EVENT) {
      return [this.createEventMessage(packet)];
    }

    return [];
  }

  private sendConnectReply(client: WebSocketInterceptorProtocolClient) {
    const reply = { type: PacketType.CONNECT, nsp: this.options.namespace, data: { sid: crypto.randomUUID() } };

    for (const frame of this.encodeSocketPacket(reply)) {
      client.sendFrame(frame);
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

  encode(message: SocketIOMessage): WebSocketInterceptorProtocolFrame[] {
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
 * Polling, enabled by default, intercepts HTTP requests to `<base URL>/socket.io/`. Each namespace needs its own
 * interceptor. Interceptors of namespaces on the same base URL share a connection, and the first one started sets the
 * `polling`, `pingInterval`, and `pingTimeout` options.
 *
 * @example
 *   const interceptor = createWebSocketInterceptor<SocketIOSchema<ServerToClientEvents, ClientToServerEvents>>({
 *     baseURL: 'ws://localhost:3000',
 *     protocol: createSocketIOProtocol(),
 *   });
 */
export function createSocketIOProtocol(options: SocketIOProtocolOptions = {}): WebSocketInterceptorProtocol {
  return new SocketIOProtocol({
    namespace: options.namespace ?? DEFAULT_NAMESPACE,
    polling: options.polling ?? true,
    parser: options.parser ?? defaultParser,
    pingInterval: options.pingInterval ?? DEFAULT_PING_INTERVAL,
    pingTimeout: options.pingTimeout ?? DEFAULT_PING_TIMEOUT,
  }) as WebSocketInterceptorProtocol;
}
