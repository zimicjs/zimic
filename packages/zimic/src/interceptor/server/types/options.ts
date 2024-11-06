/**
 * The strategy to treat unhandled requests.
 *
 * When `log` is `true`, unhandled requests are logged to the console. If provided a handler, unhandled requests will be
 * logged if `await context.log()` is called.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
 */
export namespace UnhandledRequestStrategy {
  /**
   * The action to take when an unhandled request is intercepted.
   *
   * In a {@link https://github.com/zimicjs/zimic/wiki/getting‐started#local-http-interceptors local interceptor}, the
   * action is always `bypass`, meaning that unhandled requests pass through the interceptor and reach the real network.
   * {@link https://github.com/zimicjs/zimic/wiki/getting‐started#local-http-interceptors Remote interceptors} always use
   * `reject`, since unhandled requests that react an
   * {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server interceptor server} cannot be bypassed.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  export type Action = 'reject';

  /**
   * A static declaration of the strategy to use for unhandled requests.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  export interface Declaration {
    /** The action to take when an unhandled request is intercepted. */
    action: Action;

    /**
     * Whether to log unhandled requests to the console.
     *
     * @default true
     */
    log?: boolean;
  }
}

export type UnhandledRequestStrategy = UnhandledRequestStrategy.Declaration;

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
   * The strategy to use for unhandled requests.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  onUnhandledRequest?: UnhandledRequestStrategy;
}
