import { HttpRequest } from '@/http/types/requests';
import { PossiblePromise } from '@/types/utils';

/**
 * An type of an HTTP interceptor.
 *
 * @see {@link https://github.com/diego-aquino/zimic#httpinterceptor `HttpInterceptor` API reference}
 */
export type HttpInterceptorType = 'local' | 'remote';

/**
 * The platform where an HTTP interceptor is running.
 *
 * @see {@link https://github.com/diego-aquino/zimic#http-interceptorplatform `interceptor.platform()` API reference}
 */
export type HttpInterceptorPlatform = 'node' | 'browser';

export namespace UnhandledRequestStrategy {
  export type Declaration = Partial<{
    log: boolean;
  }>;

  export interface HandlerContext {
    log: () => Promise<void>;
  }
  export type Handler = (request: HttpRequest, context: HandlerContext) => PossiblePromise<void>;

  export type Action = 'bypass' | 'reject';
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type UnhandledRequestStrategy = UnhandledRequestStrategy.Declaration | UnhandledRequestStrategy.Handler;

export interface SharedHttpInterceptorOptions {
  /** The type of the HTTP interceptor. */
  type: HttpInterceptorType;

  /**
   * Represents the URL that should be matched by the interceptor. Any request starting with this base URL will be
   * intercepted if a matching {@link https://github.com/diego-aquino/zimic#httprequesthandler handler} exists.
   *
   * For {@link https://github.com/diego-aquino/zimic#remote-http-interceptors remote interceptors}, this base URL should
   * point to an {@link https://github.com/diego-aquino/zimic#zimic-server interceptor server}. It may include additional
   * paths to differentiate between conflicting mocks.
   */
  baseURL: string | URL;
  onUnhandledRequest?: UnhandledRequestStrategy;
}

/** The options to create a local HTTP interceptor. */
export interface LocalHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'local';
}

/** The options to create a remote HTTP interceptor. */
export interface RemoteHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'remote';
}

/**
 * The options to create an HTTP interceptor.
 *
 * @see {@link https://github.com/diego-aquino/zimic#httpcreateinterceptor `http.createInterceptor()` API reference}
 */
export type HttpInterceptorOptions = LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions;
