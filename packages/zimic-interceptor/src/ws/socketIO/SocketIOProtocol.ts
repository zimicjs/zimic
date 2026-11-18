import { assertTypeOf, ValidationError } from '@zimic/utils/validation';
import * as defaultParser from 'socket.io-parser';
import { isPacketValid, type Packet } from 'socket.io-parser';

import type {
  WebSocketInterceptorProtocol,
  WebSocketInterceptorProtocolClientOptions,
  WebSocketInterceptorProtocolConnection,
  WebSocketInterceptorProtocolContext,
  WebSocketInterceptorProtocolOpenedClient,
} from '../interceptor/types/protocol';
import SharedSocketIOProtocolError from './errors/SharedSocketIOProtocolError';
import { SocketIOEngine, type SocketIOEngineOptions, startSocketIOEngine } from './SocketIOEngine';
import type { SocketIOMessage } from './types/messages';

const { PacketType } = defaultParser;

function printInvalidMessage(message: object) {
  try {
    return JSON.stringify(message);
  } catch {
    // If `JSON.stringify` fails, we render the message as a string anyway.
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(message);
  }
}

class SocketIOProtocol<Message extends SocketIOMessage> implements WebSocketInterceptorProtocol<Message> {
  private context!: WebSocketInterceptorProtocolContext<Message>;
  private engine?: SocketIOEngine;

  private isRunning = false;

  constructor(private options: SocketIOEngineOptions & { namespace: string }) {}

  get namespace() {
    return this.options.namespace;
  }

  get polling() {
    return this.options.polling;
  }

  get parser() {
    return this.options.parser;
  }

  async start(context: WebSocketInterceptorProtocolContext<Message>) {
    if (this.isRunning) {
      throw new SharedSocketIOProtocolError();
    }

    this.isRunning = true;
    this.context = context;

    try {
      const { engine, engineStart } = await startSocketIOEngine(context.interceptor, this);
      this.engine = engine;

      await engineStart;
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop() {
    try {
      await this.engine?.stop(this);
    } finally {
      this.engine = undefined;
      this.isRunning = false;
    }
  }

  clear() {
    this.engine?.clear(this);
  }

  claimConnection(connection: WebSocketInterceptorProtocolConnection) {
    return this.engine?.claimConnection(connection);
  }

  openClient(options: WebSocketInterceptorProtocolClientOptions<Message>) {
    return this.context.openClient(options);
  }

  // Parsers are user code, and socket.io-parser accepts non-string event names.
  receiveEventPacket(client: WebSocketInterceptorProtocolOpenedClient<SocketIOMessage>, packet: Packet) {
    if (!isPacketValid(packet)) {
      return;
    }

    // Valid event packets carry arrays of arguments.
    const [type, data, ...args] = packet.data as unknown[];

    if (typeof type !== 'string') {
      return;
    }

    client.receive({
      type,
      data,
      ...(args.length > 0 && { args }),
      ...(packet.id !== undefined && { ackId: packet.id }),
    } satisfies SocketIOMessage);
  }

  createMessagePacket(message: Message): Packet {
    // Messages come from user code that may bypass the schema types.
    const untypedMessage: unknown = message;

    assertTypeOf('message', untypedMessage, 'object');

    const hasAckId = 'ackId' in untypedMessage && untypedMessage.ackId !== undefined;

    if (!('type' in untypedMessage || hasAckId)) {
      throw new ValidationError(
        `Socket.IO messages must be objects with \`type\` or \`ackId\`, but received: ${printInvalidMessage(untypedMessage)}.`,
      );
    }

    if ('type' in message) {
      assertTypeOf('message.type', message.type, 'string');

      // Event packets have no ack ID, so they would drop it.
      if (message.ackId !== undefined) {
        throw new ValidationError(
          `Socket.IO events sent by interceptors must not have an \`ackId\`, but received: ${printInvalidMessage(message)}.`,
        );
      }
    }

    const hasNoArguments = message.data === undefined && message.args === undefined;
    const socketArguments = hasNoArguments ? [] : [message.data, ...(message.args ?? [])];

    const packet: Packet =
      'type' in message
        ? { type: PacketType.EVENT, nsp: this.options.namespace, data: [message.type, ...socketArguments] }
        : { type: PacketType.ACK, nsp: this.options.namespace, id: message.ackId, data: socketArguments };

    if (!isPacketValid(packet)) {
      throw new ValidationError(
        `Socket.IO messages must not have a reserved \`type\` or a non-integer \`ackId\`, but received: ${printInvalidMessage(message)}.`,
      );
    }

    return packet;
  }
}

export default SocketIOProtocol;
