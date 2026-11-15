import { ValidationError } from '@zimic/utils/validation';
import * as defaultParser from 'socket.io-parser';
import type { Packet } from 'socket.io-parser';

import type {
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
import type { SocketIOMessage } from './types/messages';
import type { SocketIOParser } from './types/options';
import type { SocketIOPollingInterceptor } from './types/polling';

const { PacketType } = defaultParser;

class SocketIOProtocol<Message extends SocketIOMessage> implements InternalWebSocketInterceptorProtocol<Message> {
  readonly [INTERNAL_PROTOCOL_BRAND] = true;

  interceptor!: AnyWebSocketInterceptorImplementation;

  private engine?: SocketIOEngine;
  private encoder: InstanceType<SocketIOParser['Encoder']>;

  constructor(
    private options: { namespace: string; polling: SocketIOPollingInterceptor | undefined; parser: SocketIOParser },
  ) {
    this.encoder = new options.parser.Encoder();
  }

  get namespace() {
    return this.options.namespace;
  }

  get polling() {
    return this.options.polling;
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
  receiveEventPacket(client: InternalWebSocketInterceptorClient, packet: Packet) {
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

  private createSocketPacket(message: SocketIOMessage): Packet {
    const { namespace } = this.options;

    const hasNoArguments = message.data === undefined && message.args === undefined;
    const socketArguments = hasNoArguments ? [] : [message.data, ...(message.args ?? [])];

    if ('type' in message) {
      return { type: PacketType.EVENT, nsp: namespace, data: [message.type, ...socketArguments] };
    }

    return { type: PacketType.ACK, nsp: namespace, id: message.ackId, data: socketArguments };
  }
}

export default SocketIOProtocol;
