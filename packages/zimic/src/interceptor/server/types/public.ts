/**
 * A server to intercept and handle requests. It is used in combination with
 * {@link https://github.com/zimicjs/zimic#remote-http-interceptors remote interceptors}.
 *
 * @see {@link https://github.com/zimicjs/zimic#zimic-server `zimic server` API reference}
 */
export interface InterceptorServer {
  /**
   * The hostname of the server.
   *
   * @see {@link https://github.com/zimicjs/zimic#zimic-server `zimic server` API reference}
   */
  hostname: () => string;

  /**
   * The port of the server.
   *
   * @see {@link https://github.com/zimicjs/zimic#zimic-server `zimic server` API reference}
   */
  port: () => number | undefined;

  /**
   * The HTTP URL of the server.
   *
   * @see {@link https://github.com/zimicjs/zimic#zimic-server `zimic server` API reference}
   */
  httpURL: () => string | undefined;

  /**
   * Whether the server is running.
   *
   * @see {@link https://github.com/zimicjs/zimic#zimic-server `zimic server` API reference}
   */
  isRunning: () => boolean;

  /**
   * Start the server.
   *
   * @see {@link https://github.com/zimicjs/zimic#zimic-server `zimic server` API reference}
   */
  start: () => Promise<void>;

  /**
   * Stop the server.
   *
   * @see {@link https://github.com/zimicjs/zimic#zimic-server `zimic server` API reference}
   */
  stop: () => Promise<void>;
}
