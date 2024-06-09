import { HttpRequest } from '@/http/types/requests';
import { PossiblePromise } from '@/types/utils';

/**
 * An type of an HTTP interceptor.
 *
 * @see {@link https://github.com/zimicjs/zimic#httpinterceptor `HttpInterceptor` API reference}
 */
export type HttpInterceptorType = 'local' | 'remote';

/**
 * The platform where an HTTP interceptor is running.
 *
 * @see {@link https://github.com/zimicjs/zimic#http-interceptorplatform `interceptor.platform()` API reference}
 */
export type HttpInterceptorPlatform = 'node' | 'browser';

/**
 * The strategy to treat unhandled requests.
 *
 * When `log` is `true`, unhandled requests are logged to the console. If provided a handler, unhandled requests will be
 * logged if `await context.log()` is called.
 *
 * @see {@link https://github.com/zimicjs/zimic#unhandled-requests Unhandled requests}
 */
export namespace UnhandledRequestStrategy {
  /**
   * A static declaration of the strategy to handle unhandled requests.
   *
   * @see {@link https://github.com/zimicjs/zimic#unhandled-requests Unhandled requests}
   */
  export type Declaration = Partial<{
    log: boolean;
  }>;

  export interface HandlerContext {
    /**
     * Logs the unhandled request to the console.
     *
     * If the request was bypassed by a
     * {@link https://github.com/zimicjs/zimic#local-http-interceptors local interceptor}, the log will be a warning. If
     * the request was rejected by a {@link https://github.com/zimicjs/zimic#local-http-interceptors remote interceptor},
     * the log will be an error.
     *
     * @see {@link https://github.com/zimicjs/zimic#unhandled-requests Unhandled requests}
     */
    log: () => Promise<void>;
  }

  /**
   * A dynamic handler to unhandled requests.
   *
   * @see {@link https://github.com/zimicjs/zimic#unhandled-requests Unhandled requests}
   */
  export type Handler = (request: HttpRequest, context: HandlerContext) => PossiblePromise<void>;

  /**
   * The action to take when an unhandled request is intercepted.
   *
   * In a {@link https://github.com/zimicjs/zimic#local-http-interceptors local interceptor}, the action is always
   * `bypass`, meaning that unhandled requests pass through the interceptor and reach the real network.
   * {@link https://github.com/zimicjs/zimic#local-http-interceptors Remote interceptors} always use `reject`, since
   * unhandled requests that react an {@link https://github.com/zimicjs/zimic#zimic-server interceptor server} cannot be
   * bypassed.
   *
   * @see {@link https://github.com/zimicjs/zimic#unhandled-requests Unhandled requests}
   */
  export type Action = 'bypass' | 'reject';
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type UnhandledRequestStrategy = UnhandledRequestStrategy.Declaration | UnhandledRequestStrategy.Handler;

export interface SharedHttpInterceptorOptions {
  /** The type of the HTTP interceptor. */
  type: HttpInterceptorType;

  /**
   * Represents the URL that should be matched by the interceptor. Any request starting with this base URL will be
   * intercepted if a matching {@link https://github.com/zimicjs/zimic#httprequesthandler handler} exists.
   *
   * For {@link https://github.com/zimicjs/zimic#remote-http-interceptors remote interceptors}, this base URL should
   * point to an {@link https://github.com/zimicjs/zimic#zimic-server interceptor server}. It may include additional
   * paths to differentiate between conflicting mocks.
   */
  baseURL: string | URL;

  /**
   * Whether {@link https://github.com/zimicjs/zimic#httprequesthandler request handlers} should save their intercepted
   * requests and make them accessible through
   * {@link https://github.com/zimicjs/zimic#http-handlerrequests `handler.requests()`}.
   *
   * **IMPORTANT**: Saving the intercepted requests will lead to a memory leak if not accompanied by clearing of the
   * interceptor or disposal of the handlers (i.e. garbage collection). If you plan on accessing those requests, such as
   * to assert them in your tests, set this option to `true` and make sure to regularly clear the interceptor. A common
   * practice is to call {@link https://github.com/zimicjs/zimic#http-interceptorclear `interceptor.clear()`} after each
   * test. This prevents leaking memory from the accumulated requests.
   *
   * @default false
   * @see {@link https://github.com/zimicjs/zimic#saving-intercepted-requests Saving intercepted requests}
   * @see {@link https://github.com/zimicjs/zimic#testing Testing}
   */
  saveRequests?: boolean;

  /**
   * The strategy to handle unhandled requests. If a request starts with the base URL of the interceptor, but no
   * matching handler exists, this strategy will be used. If a function is provided, it will be called with the
   * unhandled request.
   *
   * @see {@link https://github.com/zimicjs/zimic#unhandled-requests Unhandled requests}
   */
  onUnhandledRequest?: UnhandledRequestStrategy;
}

/**
 * The options to create a {@link https://github.com/zimicjs/zimic#local-http-interceptors local HTTP interceptor}.
 *
 * @see {@link https://github.com/zimicjs/zimic#creating-a-local-http-interceptor Creating a local HTTP interceptor}
 */
export interface LocalHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'local';
}

/**
 * The options to create a {@link https://github.com/zimicjs/zimic#remote-http-interceptors remote HTTP interceptor}.
 *
 * @see {@link https://github.com/zimicjs/zimic#creating-a-remote-http-interceptor Creating a remote HTTP interceptor}
 */
export interface RemoteHttpInterceptorOptions extends SharedHttpInterceptorOptions {
  type: 'remote';
}

/**
 * The options to create an {@link https://github.com/zimicjs/zimic#httpinterceptor HTTP interceptor}.
 *
 * @see {@link https://github.com/zimicjs/zimic#httpcreateinterceptor `http.createInterceptor()` API reference}
 */
export type HttpInterceptorOptions = LocalHttpInterceptorOptions | RemoteHttpInterceptorOptions;
