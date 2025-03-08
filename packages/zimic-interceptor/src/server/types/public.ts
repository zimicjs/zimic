/**
 * A server to intercept and handle requests. It is used in combination with
 * {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors remote interceptors}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic-interceptor server` API reference}
 */
export interface InterceptorServer {
  /**
   * The hostname of the server.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic-interceptor server` API reference}
   */
  hostname: string;

  /**
   * The port of the server.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic-interceptor server` API reference}
   */
  port: number | undefined;

  /**
   * Whether to log warnings about unhandled requests to the console.
   *
   * @default true
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic-interceptor server` API reference}
   */
  logUnhandledRequests: boolean;

  /**
   * The HTTP URL of the server.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic-interceptor server` API reference}
   */
  httpURL: string | undefined;

  /**
   * Whether the server is running.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic-interceptor server` API reference}
   */
  isRunning: boolean;

  /**
   * Starts the server.
   *
   * The server is automatically stopped if a process exit event is detected, such as SIGINT, SIGTERM, or an uncaught
   * exception.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic-interceptor server` API reference}
   */
  start: () => Promise<void>;

  /**
   * Stops the server.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic-interceptor server` API reference}
   */
  stop: () => Promise<void>;
}
