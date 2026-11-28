import { assertTypeOf } from '@zimic/utils/validation';
import * as defaultParser from 'socket.io-parser';

import type { WebSocketInterceptorProtocol } from '../interceptor/types/protocol';
import SocketIOProtocol from './SocketIOProtocol';
import type { SocketIOMessage } from './types/messages';
import type { SocketIOProtocolOptions } from './types/options';

const DEFAULT_NAMESPACE = '/';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io#creating-a-socketio-interceptor Creating a Socket.IO interceptor}
 */
// Without a type argument or a contextual type, the client messages are `never`, so the protocol fits interceptors of
// any Socket.IO schema. It decodes client messages without checking them against the schema in any case.
export function createSocketIOProtocol<
  ServerMessage extends SocketIOMessage = SocketIOMessage,
  ClientMessage extends SocketIOMessage = never,
>(options: SocketIOProtocolOptions = {}): WebSocketInterceptorProtocol<ServerMessage, ClientMessage> {
  assertTypeOf('options.namespace', options.namespace, 'string', { optional: true });
  assertTypeOf('options.polling', options.polling, 'object', { optional: true });
  assertTypeOf('options.parser', options.parser, 'object', { optional: true });

  if (options.parser) {
    assertTypeOf('options.parser.Encoder', options.parser.Encoder, 'function');
    assertTypeOf('options.parser.Decoder', options.parser.Decoder, 'function');
  }

  return new SocketIOProtocol<ServerMessage, ClientMessage>({
    namespace: options.namespace ?? DEFAULT_NAMESPACE,
    polling: options.polling,
    parser: options.parser ?? defaultParser,
  });
}
