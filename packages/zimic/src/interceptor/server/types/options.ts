/**
 * The options to create an {@link https://github.com/zimicjs/zimic#zimic-server interceptor server}.
 *
 * @see {@link https://github.com/zimicjs/zimic#zimic-server `zimic server` API reference}
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
   * @see {@link https://github.com/zimicjs/zimic#unhandled-requests Unhandled requests}
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
