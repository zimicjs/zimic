import NotStartedHttpInterceptorError from './http/interceptor/errors/NotStartedHttpInterceptorError';
import UnknownHttpInterceptorPlatform from './http/interceptor/errors/UnknownHttpInterceptorPlatform';
import { createHttpInterceptor } from './http/interceptor/factory';
import { UnhandledRequestStrategy } from './http/interceptor/types/options';
import UnregisteredServiceWorkerError from './http/interceptorWorker/errors/UnregisteredServiceWorkerError';
import HttpInterceptorWorkerStore from './http/interceptorWorker/HttpInterceptorWorkerStore';

export { UnknownHttpInterceptorPlatform, NotStartedHttpInterceptorError, UnregisteredServiceWorkerError };

export type {
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  TrackedHttpInterceptorRequest,
} from './http/requestHandler/types/requests';

export type {
  LocalHttpRequestHandler,
  RemoteHttpRequestHandler,
  SyncedRemoteHttpRequestHandler,
  PendingRemoteHttpRequestHandler,
  HttpRequestHandler,
  HttpRequestHandlerRestriction,
  HttpRequestHandlerComputedRestriction,
  HttpRequestHandlerHeadersStaticRestriction,
  HttpRequestHandlerSearchParamsStaticRestriction,
  HttpRequestHandlerStaticRestriction,
  HttpRequestHandlerBodyStaticRestriction,
} from './http/requestHandler/types/public';

export type {
  HttpInterceptorType,
  HttpInterceptorPlatform,
  LocalHttpInterceptorOptions,
  RemoteHttpInterceptorOptions,
  HttpInterceptorOptions,
  UnhandledRequestStrategy,
} from './http/interceptor/types/options';
export type { ExtractHttpInterceptorSchema } from './http/interceptor/types/schema';

export type { LocalHttpInterceptor, RemoteHttpInterceptor, HttpInterceptor } from './http/interceptor/types/public';

/** @see {@link https://github.com/diego-aquino/zimic#http `http` API reference} */
export interface HttpNamespace {
  /**
   * Creates an HTTP interceptor.
   *
   * @param options The options for the interceptor.
   * @returns The created HTTP interceptor.
   * @throws {InvalidURLError} If the base URL is invalid.
   * @throws {UnsupportedURLProtocolError} If the base URL protocol is not either `http` or `https`.
   * @see {@link https://github.com/diego-aquino/zimic#httpcreateinterceptor `http.createInterceptor` API reference}
   * @see {@link https://github.com/diego-aquino/zimic#declaring-http-service-schemas Declaring service schemas}
   */
  createInterceptor: typeof createHttpInterceptor;

  /** Default HTTP settings. */
  default: {
    /**
     * Sets the default strategy for unhandled requests. If a request does not start with the base URL of any
     * interceptors, this strategy will be used. If a function is provided, it will be called with the unhandled
     * request. Defining a custom strategy when creating an interceptor will override this default for that
     * interceptor.
     *
     * @param strategy The default strategy to be set.
     */
    onUnhandledRequest: (strategy: UnhandledRequestStrategy) => void;
  };
}

/** @see {@link https://github.com/diego-aquino/zimic#http `http` API reference} */
export const http: HttpNamespace = Object.freeze({
  createInterceptor: createHttpInterceptor,

  default: Object.freeze({
    onUnhandledRequest: (strategy: UnhandledRequestStrategy) => {
      const store = new HttpInterceptorWorkerStore();
      store.setDefaultUnhandledRequestStrategy(strategy);
    },
  }),
});
