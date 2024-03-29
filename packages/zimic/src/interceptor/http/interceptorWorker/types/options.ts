enum HttpInterceptorWorkerPlatformEnum {
  BROWSER = 'browser',
  NODE = 'node',
}

type HttpInterceptorWorkerPlatformUnion = `${HttpInterceptorWorkerPlatformEnum}`;

/** The platform used by the worker (`browser` or `node`). */
export type HttpInterceptorWorkerPlatform = HttpInterceptorWorkerPlatformEnum | HttpInterceptorWorkerPlatformUnion;
export const HttpInterceptorWorkerPlatform = HttpInterceptorWorkerPlatformEnum; // eslint-disable-line @typescript-eslint/no-redeclare

/** Options to create an HTTP interceptor worker. */
export interface HttpInterceptorWorkerOptions {
  /**
   * The platform used by the worker (`browser` or `node`).
   *
   * When using `browser`, make sure to run `npx zimic browser init <publicDirectory>` on your terminal before starting
   * the worker. This initializes the mock service worker in your public directory.
   *
   * @see {@link https://github.com/diego-aquino/zimic#zimic-browser-init-publicdirectory}
   */
  platform: HttpInterceptorWorkerPlatform;
}
