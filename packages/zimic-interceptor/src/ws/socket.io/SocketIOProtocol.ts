import { ValidationError } from '@zimic/utils/validation';
import * as defaultParser from 'socket.io-parser';
import type { Packet } from 'socket.io-parser';

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

// `JSON.stringify` returns `undefined` for functions and throws for bigints and circular references, so it prints only
// objects it can serialize.
function printInvalidMessage(message: unknown) {
  if (message !== null && typeof message === 'object') {
    try {
      return JSON.stringify(message);
    } catch {
      // Falls back to `String`, as other values do.
    }
  }

  return String(message);
}

class SocketIOProtocol<Message extends SocketIOMessage> implements WebSocketInterceptorProtocol<Message> {
  // Assigned on start, before the engine can open clients for this protocol.
  private context!: WebSocketInterceptorProtocolContext<Message>;
  private engine?: SocketIOEngine;
  // Set from the start of `start` until `stop` completes, because the engine is assigned only after awaiting its lookup.
  private isInUse = false;

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
    if (this.isInUse) {
      throw new SharedSocketIOProtocolError();
    }

    this.isInUse = true;
    this.context = context;

    try {
      // An engine that rejects the namespace does not register it, so it has nothing to undo.
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
      this.isInUse = false;
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

  // Parsers are user-provided and `socket.io-parser` accepts event names that are not strings, so the arguments are
  // validated before reaching handlers.
  receiveEventPacket(client: WebSocketInterceptorProtocolOpenedClient<SocketIOMessage>, packet: Packet) {
    const socketArguments: unknown = packet.data;

    if (!Array.isArray(socketArguments)) {
      return;
    }

    const [type, data, ...args]: unknown[] = socketArguments;

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

    const isValidMessage =
      typeof untypedMessage === 'object' &&
      untypedMessage !== null &&
      ('type' in untypedMessage || 'ackId' in untypedMessage);

    if (!isValidMessage) {
      throw new ValidationError(
        `Socket.IO messages must be objects with \`type\` or \`ackId\`, but received: ${printInvalidMessage(untypedMessage)}.`,
      );
    }

    const { namespace } = this.options;

    const hasNoArguments = message.data === undefined && message.args === undefined;
    const socketArguments = hasNoArguments ? [] : [message.data, ...(message.args ?? [])];

    if ('type' in message) {
      // Interceptors do not send events that expect acknowledgements, so an event packet would drop the `ackId`. Schema
      // types accept it when a client event of the same name may carry an ack, as any event of the default map may.
      if (message.ackId !== undefined) {
        throw new ValidationError(
          `Socket.IO events sent by interceptors must not have an \`ackId\`, but received: ${printInvalidMessage(message)}.`,
        );
      }

      return { type: PacketType.EVENT, nsp: namespace, data: [message.type, ...socketArguments] };
    }

    return { type: PacketType.ACK, nsp: namespace, id: message.ackId, data: socketArguments };
  }
}

export default SocketIOProtocol;
