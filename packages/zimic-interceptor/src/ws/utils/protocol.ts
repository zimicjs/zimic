import type { PossiblePromise } from '@zimic/utils/types';

import type {
  WebSocketInterceptorProtocol,
  WebSocketInterceptorProtocolConnectionClaim,
  WebSocketInterceptorProtocolRawConnection,
} from '../interceptor/types/protocol';
import type { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';

// A registered symbol, so interceptors recognize the protocols of this package even if each entry point bundles its own
// copy of this module.
export const INTERNAL_PROTOCOL_BRAND = Symbol.for('@zimic/interceptor/ws/internalProtocol');

/**
 * The lifecycle of protocols implemented by this package, which need more than a connection to work, such as serving a
 * transport other than WebSocket.
 */
export interface InternalWebSocketInterceptorProtocol<Message> extends WebSocketInterceptorProtocol<Message> {
  readonly [INTERNAL_PROTOCOL_BRAND]: true;

  start: (interceptor: AnyWebSocketInterceptorImplementation) => PossiblePromise<void>;
  stop: (interceptor: AnyWebSocketInterceptorImplementation) => PossiblePromise<void>;
  clear: () => void;

  claimConnection: (
    url: string,
    connection: WebSocketInterceptorProtocolRawConnection,
  ) => WebSocketInterceptorProtocolConnectionClaim | undefined;
}

export function isInternalWebSocketInterceptorProtocol<Message>(
  protocol: WebSocketInterceptorProtocol<Message> | undefined,
): protocol is InternalWebSocketInterceptorProtocol<Message> {
  return protocol !== undefined && INTERNAL_PROTOCOL_BRAND in protocol;
}
