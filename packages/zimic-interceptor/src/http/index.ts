import {
  InvalidFormDataError as HttpInvalidFormDataError,
  InvalidJSONError as HttpInvalidJSONError,
} from '@zimic/http';

export { default as RunningHttpInterceptorError } from './interceptor/errors/RunningHttpInterceptorError';
export { default as NotRunningHttpInterceptorError } from './interceptor/errors/NotRunningHttpInterceptorError';
export { default as UnknownHttpInterceptorPlatformError } from './interceptor/errors/UnknownHttpInterceptorPlatformError';
export { default as UnknownHttpInterceptorTypeError } from './interceptor/errors/UnknownHttpInterceptorTypeError';
export { default as RequestSavingSafeLimitExceededError } from './interceptor/errors/RequestSavingSafeLimitExceededError';

export { default as UnregisteredBrowserServiceWorkerError } from './interceptorWorker/errors/UnregisteredBrowserServiceWorkerError';

export { default as DisabledRequestSavingError } from './requestHandler/errors/DisabledRequestSavingError';
export { default as TimesCheckError } from './requestHandler/errors/TimesCheckError';

export type {
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  HttpInterceptorRequest,
  HttpInterceptorResponse,
  InterceptedHttpInterceptorRequest,
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

export { createHttpInterceptor } from './interceptor/factory';

/**
 * Error thrown when a value is not valid {@link https://developer.mozilla.org/docs/Web/API/FormData FormData}. HTTP
 * interceptors might throw this error when trying to parse the body of a request or response with the header
 * `'content-type': 'multipart/form-data'`, if the content cannot be parsed to form data.
 *
 * @deprecated This type has been moved to {@link https://zimic.dev/docs/http `@zimic/http`}. Please import
 *   `InvalidFormDataError` from `@zimic/http` instead.
 *
 *   ```ts
 *   import { InvalidFormDataError } from '@zimic/http';
 *   ```
 */
export class InvalidFormDataError extends HttpInvalidFormDataError {}

/**
 * Error thrown when a value is not valid JSON. HTTP interceptors might throw this error when trying to parse the body
 * of a request or response with the header `'content-type': 'application/json'`, if the content cannot be parsed to
 * JSON.
 *
 * @deprecated This type has been moved to {@link https://zimic.dev/docs/http `@zimic/http`}. Please import
 *   `InvalidJSONError` from `@zimic/http` instead.
 *
 *   ```ts
 *   import { InvalidJSONError } from '@zimic/http';
 *   ```
 */
export class InvalidJSONError extends HttpInvalidJSONError {}
