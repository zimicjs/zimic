import NotStartedHttpInterceptorError from './http/interceptor/errors/NotStartedHttpInterceptorError';
import UnknownHttpInterceptorPlatform from './http/interceptor/errors/UnknownHttpInterceptorPlatform';
import UnregisteredServiceWorkerError from './http/interceptorWorker/errors/UnregisteredServiceWorkerError';
import HttpInterceptorNamespace from './http/namespace/HttpInterceptorNamespace';

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
