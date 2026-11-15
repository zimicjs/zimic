import * as defaultParser from 'socket.io-parser';

import type { WebSocketInterceptorProtocol } from '../interceptor/types/protocol';
import SocketIOProtocol from './SocketIOProtocol';
import type { SocketIOMessage } from './types/messages';
import type { SocketIOProtocolOptions } from './types/options';

const DEFAULT_NAMESPACE = '/';

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Creates a protocol to mock Socket.IO servers with WebSocket interceptor handlers.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-protocols#createsocketioprotocol `createSocketIOProtocol` API reference}
 * @see {@link https://zimic.dev/docs/interceptor/guides/ws/socket-io Mocking Socket.IO servers}
 */
export function createSocketIOProtocol<Message extends SocketIOMessage = SocketIOMessage>(
  options: SocketIOProtocolOptions = {},
): WebSocketInterceptorProtocol<Message> {
  return new SocketIOProtocol<Message>({
    namespace: options.namespace ?? DEFAULT_NAMESPACE,
    polling: options.polling,
    parser: options.parser ?? defaultParser,
  });
}
