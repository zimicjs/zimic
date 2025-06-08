/** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server `InterceptorServer` API reference} */
export interface InterceptorServer {
  /** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server `InterceptorServer` API reference} */
  hostname: string;

  /** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server `InterceptorServer` API reference} */
  port: number | undefined;

  /** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server `InterceptorServer` API reference} */
  logUnhandledRequests: boolean;

  /** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server `InterceptorServer` API reference} */
  tokensDirectory?: string;

  /**
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server `InterceptorServer` API reference}
   */
  get isRunning(): boolean;

  /** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server `InterceptorServer` API reference} */
  start: () => Promise<void>;

  /** @see {@link https://zimic.dev/docs/interceptor/api/interceptor-server `InterceptorServer` API reference} */
  stop: () => Promise<void>;
}
