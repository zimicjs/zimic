/**
 * A server to intercept and handle requests. It is used in combination with
 * {@link https://github.com/zimicjs/zimic/wiki/getting-started#remote-http-interceptors remote interceptors}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli-zimic-server#zimic-server `zimic server` API reference}
 */
export interface InterceptorServer {
  /**
   * @returns The hostname of the server.
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli-zimic-server#zimic-server `zimic server` API reference}
   */
  hostname: () => string;

  /**
   * @returns The port of the server.
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli-zimic-server#zimic-server `zimic server` API reference}
   */
  port: () => number | undefined;

  /**
   * @returns The HTTP URL of the server.
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli-zimic-server#zimic-server `zimic server` API reference}
   */
  httpURL: () => string | undefined;

  /**
   * @returns Whether the server is running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli-zimic-server#zimic-server `zimic server` API reference}
   */
  isRunning: () => boolean;

  /**
   * Starts the server.
   *
   * The server is automatically stopped if a process exit event is detected, such as SIGINT, SIGTERM, or an uncaught
   * exception.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli-zimic-server#zimic-server `zimic server` API reference}
   */
  start: () => Promise<void>;

  /**
   * Stops the server.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli-zimic-server#zimic-server `zimic server` API reference}
   */
  stop: () => Promise<void>;
}
