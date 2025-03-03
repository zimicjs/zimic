import HttpInterceptorNamespace from './namespace/HttpInterceptorNamespace';

export { default as InvalidJSONError } from './interceptorWorker/errors/InvalidJSONError';
export { default as InvalidFormDataError } from './interceptorWorker/errors/InvalidFormDataError';
export { default as NotStartedHttpInterceptorError } from './interceptor/errors/NotStartedHttpInterceptorError';
export { default as UnknownHttpInterceptorPlatformError } from './interceptor/errors/UnknownHttpInterceptorPlatformError';
export { default as UnknownHttpInterceptorTypeError } from './interceptor/errors/UnknownHttpInterceptorTypeError';
export { default as UnregisteredBrowserServiceWorkerError } from './interceptorWorker/errors/UnregisteredBrowserServiceWorkerError';
export { default as DisabledRequestSavingError } from './requestHandler/errors/DisabledRequestSavingError';
export { default as TimesCheckError } from './requestHandler/errors/TimesCheckError';

export type {
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  TrackedHttpInterceptorRequest,
} from './requestHandler/types/requests';

export type {
  LocalHttpRequestHandler,
  RemoteHttpRequestHandler,
  SyncedRemoteHttpRequestHandler,
  PendingRemoteHttpRequestHandler,
  HttpRequestHandler,
} from './requestHandler/types/public';
export type {
  HttpRequestHandlerRestriction,
  HttpRequestHandlerStaticRestriction,
  HttpRequestHandlerComputedRestriction,
  HttpRequestHandlerHeadersStaticRestriction,
  HttpRequestHandlerSearchParamsStaticRestriction,
  HttpRequestHandlerBodyStaticRestriction,
} from './requestHandler/types/restrictions';

export type {
  HttpInterceptorType,
  HttpInterceptorPlatform,
  LocalHttpInterceptorOptions,
  RemoteHttpInterceptorOptions,
  HttpInterceptorOptions,
  UnhandledRequestStrategy,
} from './interceptor/types/options';

export type { UnhandledHttpInterceptorRequest } from './interceptor/types/requests';

export type { InferHttpInterceptorSchema } from './interceptor/types/schema';

export type { LocalHttpInterceptor, RemoteHttpInterceptor, HttpInterceptor } from './interceptor/types/public';

/**
 * A namespace of interceptor resources for mocking HTTP requests.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptor `HttpInterceptor` API reference}
 */
export const httpInterceptor = Object.freeze(new HttpInterceptorNamespace());

export type { default as HttpInterceptorNamespace } from './namespace/HttpInterceptorNamespace';
export type { HttpInterceptorNamespaceDefault } from './namespace/HttpInterceptorNamespace';
