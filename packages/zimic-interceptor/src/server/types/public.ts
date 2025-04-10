/**
 * A server to intercept and handle requests. It is used in combination with
 * {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors remote interceptors}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic-interceptor server` API reference}
 */
export interface InterceptorServer {
  /**
   * The hostname of the server. It can be reassigned to a new value if the server is not running.
   *
   * @throws {RunningInterceptorServerError} When trying to reassign a new hostname with the server still running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic-interceptor server` API reference}
   */
  hostname: string;

  /**
   * The port of the server. It can be reassigned to a new value if the server is not running.
   *
   * @throws {RunningInterceptorServerError} When trying to reassign a new port with the server still running.
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
   * The directory where the authorized interceptor authentication tokens are saved. If provided, only remote
   * interceptors bearing a valid token will be accepted. This option is essential if you are exposing your interceptor
   * server publicly. For local development and testing, though, `--tokens-dir` is optional.
   *
   * @default undefined
   */
  tokensDirectory?: string;

  /**
   * Whether the server is running.
   *
   * @readonly
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic-interceptor server` API reference}
   */
  get isRunning(): boolean;

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
