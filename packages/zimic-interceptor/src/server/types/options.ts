/** @see {@link https://zimic.dev/docs/interceptor/api/create-interceptor-server `createInterceptorServer` API reference} */
export interface InterceptorServerOptions {
  /** @see {@link https://zimic.dev/docs/interceptor/api/create-interceptor-server `createInterceptorServer` API reference} */
  hostname?: string;

  /** @see {@link https://zimic.dev/docs/interceptor/api/create-interceptor-server `createInterceptorServer` API reference} */
  port?: number;

  /** @see {@link https://zimic.dev/docs/interceptor/api/create-interceptor-server `createInterceptorServer` API reference} */
  logUnhandledRequests?: boolean;

  /** @see {@link https://zimic.dev/docs/interceptor/api/create-interceptor-server `createInterceptorServer` API reference} */
  tokensDirectory?: string;
}
