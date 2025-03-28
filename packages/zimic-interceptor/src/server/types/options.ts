/**
 * The options to create an
 * {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server interceptor server}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic-interceptor server` API reference}
 */
export interface InterceptorServerOptions {
  /**
   * The hostname to start the server on.
   *
   * @default localhost
   */
  hostname?: string;

  /** The port to start the server on. If no port is provided, a random one is chosen. */
  port?: number;

  /**
   * Whether to log warnings about unhandled requests to the console.
   *
   * @default true
   */
  logUnhandledRequests?: boolean;

  /**
   * The path to the directory where the authentication tokens for remote interceptors are stored. If not provided, only
   * remote interceptors with one of the allowed tokens will be accepted. This option is strongly recommended if you are
   * exposing your interceptor server publicly.
   */
  tokensDirectory?: string;
}
