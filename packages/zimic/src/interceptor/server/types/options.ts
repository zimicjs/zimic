/**
 * The options to create an
 * {@link https://github.com/zimicjs/zimic/wiki/cli-zimic-server#zimic-server interceptor server}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli-zimic-server#zimic-server `zimic server` API reference}
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
   * The strategy to use for unhandled requests.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api-zimic-interceptor-http#unhandled-requests Unhandled requests}
   */
  onUnhandledRequest?: {
    /**
     * Whether to log unhandled requests.
     *
     * @default true
     */
    log?: boolean;
  };
}
