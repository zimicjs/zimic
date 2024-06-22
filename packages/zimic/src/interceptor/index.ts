import HttpInterceptorNamespace from './http/namespace/HttpInterceptorNamespace';

export { default as NotStartedHttpInterceptorError } from './http/interceptor/errors/NotStartedHttpInterceptorError';
export { default as UnknownHttpInterceptorPlatformError } from './http/interceptor/errors/UnknownHttpInterceptorPlatformError';
export { default as UnknownHttpInterceptorTypeError } from './http/interceptor/errors/UnknownHttpInterceptorTypeError';
export { default as UnregisteredBrowserServiceWorkerError } from './http/interceptorWorker/errors/UnregisteredBrowserServiceWorkerError';
export { default as HttpInterceptorNamespace } from './http/namespace/HttpInterceptorNamespace';
export { default as DisabledRequestSavingError } from './http/requestHandler/errors/DisabledRequestSavingError';

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
  HttpRequestHandlerStaticRestriction,
  HttpRequestHandlerComputedRestriction,
  HttpRequestHandlerHeadersStaticRestriction,
  HttpRequestHandlerSearchParamsStaticRestriction,
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

export type { HttpInterceptorNamespaceDefault } from './http/namespace/HttpInterceptorNamespace';

/**
 * A set of interceptor resources for mocking HTTP requests.
 *
 * @see {@link https://github.com/zimicjs/zimic#zimicinterceptor-api-reference `zimic/interceptor` API reference}
 */
export const http = Object.freeze(new HttpInterceptorNamespace());
