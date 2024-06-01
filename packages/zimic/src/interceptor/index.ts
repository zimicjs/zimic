import NotStartedHttpInterceptorError from './http/interceptor/errors/NotStartedHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from './http/interceptor/errors/UnknownHttpInterceptorPlatformError';
import UnknownHttpInterceptorTypeError from './http/interceptor/errors/UnknownHttpInterceptorTypeError';
import UnregisteredBrowserServiceWorkerError from './http/interceptorWorker/errors/UnregisteredBrowserServiceWorkerError';
import HttpInterceptorNamespace from './http/namespace/HttpInterceptorNamespace';

export {
  UnknownHttpInterceptorPlatformError,
  UnknownHttpInterceptorTypeError,
  NotStartedHttpInterceptorError,
  UnregisteredBrowserServiceWorkerError,
};

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
export type { HttpInterceptorNamespace };

/**
 * A set of interceptor resources for mocking HTTP requests.
 *
 * @see {@link https://github.com/zimicjs/zimic#zimicinterceptor-api-reference `zimic/interceptor` API reference}
 */
export const http = Object.freeze(new HttpInterceptorNamespace());
