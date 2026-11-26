/** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server `InterceptorServer` API reference} */
export interface InterceptorServer {
  /** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#serverhostname `server.hostname` API reference} */
  hostname: string;

  /** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#serverport `server.port` API reference} */
  port: number | undefined;

  /** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#serverlogunhandledrequests `server.logUnhandledRequests` API reference} */
  logUnhandledRequests: boolean;

  /** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#serverlogunhandledconnections `server.logUnhandledConnections` API reference} */
  logUnhandledConnections: boolean;

  /** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#servertokensdirectory `server.tokensDirectory` API reference} */
  tokensDirectory?: string;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#serverisrunning `server.isRunning` API reference}
   */
  get isRunning(): boolean;

  /** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#serverstart `server.start()` API reference} */
  start: () => Promise<void>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server#serverstop `server.stop()` API reference} */
  stop: () => Promise<void>;
}
