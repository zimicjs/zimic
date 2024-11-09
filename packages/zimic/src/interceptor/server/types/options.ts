/**
 * The options to create an
 * {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server interceptor server}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server `zimic server` API reference}
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
   * Whether to log unhandled requests to the console.
   *
   * @default true
   */
  logUnhandledRequests?: boolean;
}
