import type { PossiblePromise } from '@zimic/utils/types';

/** The search params of polling requests read by a Socket.IO protocol. */
interface SocketIOPollingSearchParams {
  EIO?: string;
  sid?: string;
}

/** An Engine.IO error, answered to invalid polling requests. */
interface SocketIOPollingErrorBody {
  code: number;
  message: string;
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * The HTTP schema of the interceptor passed as the `polling` option of {@link createSocketIOProtocol}.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- HTTP schemas need the implicit index signature of type aliases.
export type SocketIOPollingSchema = {
  '/': {
    GET: {
      request: { searchParams: SocketIOPollingSearchParams };
      response: {
        200: { body: string };
        400: { body: SocketIOPollingErrorBody };
        403: { body: SocketIOPollingErrorBody };
      };
    };
    POST: {
      request: { searchParams: SocketIOPollingSearchParams; body?: string };
      response: {
        200: { body: string };
        400: { body: SocketIOPollingErrorBody };
      };
    };
  };
};

/** A polling request, as read by a Socket.IO protocol. */
export interface SocketIOPollingRequest {
  /** The URL of the request. */
  url: string;
  /** The search params of the request, which identify the Engine.IO version and session. */
  searchParams: { get: (name: keyof SocketIOPollingSearchParams) => string | null };
  /** The packets sent by the client, or `null` if none. */
  body: string | null;
}

/** The responses of a polling method, by status code. */
type SocketIOPollingResponses<Method extends keyof SocketIOPollingSchema['/']> =
  SocketIOPollingSchema['/'][Method]['response'];

/** A response to a polling request, as declared by a Socket.IO protocol. */
export type SocketIOPollingResponse<Method extends keyof SocketIOPollingSchema['/']> = {
  [Status in keyof SocketIOPollingResponses<Method>]: { status: Status } & SocketIOPollingResponses<Method>[Status];
}[keyof SocketIOPollingResponses<Method>];

/** A handler of polling requests, declared by a Socket.IO protocol. */
interface SocketIOPollingHandler<Method extends keyof SocketIOPollingSchema['/']> {
  /** Declares the response to each polling request. */
  respond: (
    declaration: (request: SocketIOPollingRequest) => PossiblePromise<SocketIOPollingResponse<Method>>,
  ) => unknown;
}

/**
 * An HTTP interceptor of {@link SocketIOPollingSchema}, created with `createHttpInterceptor` from
 * `@zimic/interceptor/http`.
 */
export interface SocketIOPollingInterceptor {
  /** The type of the interceptor, the same as the WebSocket interceptor. */
  readonly type: 'local' | 'remote';
  /** The base URL of the interceptor, the WebSocket base URL with `http` instead of `ws`. */
  readonly baseURL: string;
  /** Whether the interceptor is running. The protocol starts and stops it. */
  readonly isRunning: boolean;
  /** Starts the interceptor. */
  start: () => Promise<void>;
  /** Stops the interceptor. */
  stop: () => Promise<void>;
  /** Declares a handler of the long-polling requests. */
  get: (path: '/') => SocketIOPollingHandler<'GET'>;
  /** Declares a handler of the packets sent by polling clients. */
  post: (path: '/') => SocketIOPollingHandler<'POST'>;
}
