/**
 * The options to create an {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/cli/server `zimic-interceptor server` API reference}
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
   * The directory where the authorized interceptor authentication tokens are saved. If provided, only remote
   * interceptors bearing a valid token will be accepted. This option is essential if you are exposing your interceptor
   * server publicly. For local development and testing, though, `--tokens-dir` is optional.
   *
   * @default undefined
   */
  tokensDirectory?: string;
}
