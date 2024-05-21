import NotStartedHttpInterceptorError from './http/interceptor/errors/NotStartedHttpInterceptorError';
import UnknownHttpInterceptorPlatform from './http/interceptor/errors/UnknownHttpInterceptorPlatform';
import { createHttpInterceptor } from './http/interceptor/factory';
import UnregisteredServiceWorkerError from './http/interceptorWorker/errors/UnregisteredServiceWorkerError';

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
} from './http/requestHandler/types/public';

export type {
  HttpInterceptorType,
  HttpInterceptorPlatform,
  LocalHttpInterceptorOptions,
  RemoteHttpInterceptorOptions,
  HttpInterceptorOptions,
} from './http/interceptor/types/options';
export type { ExtractHttpInterceptorSchema } from './http/interceptor/types/schema';

export type { LocalHttpInterceptor, RemoteHttpInterceptor, HttpInterceptor } from './http/interceptor/types/public';

/**
 * An HTTP namespace containing the runtime resources related to HTTP, such as functions and default settings.
 *
 * @see {@link https://github.com/diego-aquino/zimic#http `http` API reference}
 */
export interface HttpNamespace {
  /**
   * Creates an HTTP interceptor.
   *
   * @param options The options for the interceptor.
   * @returns The created HTTP interceptor.
   * @throws {InvalidURLError} If the URL is invalid.
   * @throws {UnsupportedURLProtocolError} If the URL protocol is not either `http` or `https`.
   * @see {@link https://github.com/diego-aquino/zimic#httpcreateinterceptor `http.createInterceptor` API reference}
   */
  createInterceptor: typeof createHttpInterceptor;
}

/**
 * An HTTP namespace containing the runtime resources related to HTTP, such as functions and default settings.
 *
 * @see {@link https://github.com/diego-aquino/zimic#http `http` API reference}
 */
export const http: HttpNamespace = {
  createInterceptor: createHttpInterceptor,
};
