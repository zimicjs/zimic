import { HttpServiceSchema } from '@/http/types/schema';

import {
  HttpInterceptorMethodHandler,
  SyncHttpInterceptorMethodHandler,
  AsyncHttpInterceptorMethodHandler,
} from './handlers';

interface BaseHttpInterceptor<Schema extends HttpServiceSchema> {
  /**
   * @returns The base URL used by the interceptor.
   * @see {@link https://github.com/diego-aquino/zimic#interceptorbaseurl}
   */
  baseURL: () => string;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A GET {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the provided
   *   path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorWorkerError} If the worker is not running.
   * @see {@link https://github.com/diego-aquino/zimic#interceptormethodpath}
   */
  get: HttpInterceptorMethodHandler<Schema, 'GET'>;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A POST {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the provided
   *   path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorWorkerError} If the worker is not running.
   * @see {@link https://github.com/diego-aquino/zimic#interceptormethodpath}
   */
  post: HttpInterceptorMethodHandler<Schema, 'POST'>;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A PATCH {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the
   *   provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorWorkerError} If the worker is not running.
   * @see {@link https://github.com/diego-aquino/zimic#interceptormethodpath}
   */
  patch: HttpInterceptorMethodHandler<Schema, 'PATCH'>;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A PUT {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the provided
   *   path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorWorkerError} If the worker is not running.
   * @see {@link https://github.com/diego-aquino/zimic#interceptormethodpath}
   */
  put: HttpInterceptorMethodHandler<Schema, 'PUT'>;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A DELETE {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the
   *   provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorWorkerError} If the worker is not running.
   * @see {@link https://github.com/diego-aquino/zimic#interceptormethodpath}
   */
  delete: HttpInterceptorMethodHandler<Schema, 'DELETE'>;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A HEAD {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the provided
   *   path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorWorkerError} If the worker is not running.
   * @see {@link https://github.com/diego-aquino/zimic#interceptormethodpath}
   */
  head: HttpInterceptorMethodHandler<Schema, 'HEAD'>;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns An OPTIONS {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the
   *   provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorWorkerError} If the worker is not running.
   * @see {@link https://github.com/diego-aquino/zimic#interceptormethodpath}
   */
  options: HttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  /**
   * Clears all of the {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} instances
   * created by this interceptor. After calling this method, the interceptor will no longer intercept any requests until
   * new mock responses are registered.
   *
   * This method is useful to reset the interceptor mocks between tests.
   *
   * @see {@link https://github.com/diego-aquino/zimic#interceptorclear}
   */
  clear: () => void;
}

/**
 * Interceptor to handle matched HTTP requests and return mock responses. The methods, paths, status codes, parameters
 * and responses are statically-typed based on the provided service schema.
 *
 * To intercept HTTP requests, an interceptor needs a running
 * {@link https://github.com/diego-aquino/zimic#httpinterceptorworker HttpInterceptorWorker}.
 *
 * @see {@link https://github.com/diego-aquino/zimic#httpinterceptor}
 */

export interface LocalHttpInterceptor<Schema extends HttpServiceSchema> extends BaseHttpInterceptor<Schema> {
  readonly type: 'local';

  get: SyncHttpInterceptorMethodHandler<Schema, 'GET'>;
  post: SyncHttpInterceptorMethodHandler<Schema, 'POST'>;
  patch: SyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;
  put: SyncHttpInterceptorMethodHandler<Schema, 'PUT'>;
  delete: SyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;
  head: SyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;
  options: SyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  clear: () => void;
}

export interface RemoteHttpInterceptor<Schema extends HttpServiceSchema> extends BaseHttpInterceptor<Schema> {
  readonly type: 'remote';

  pathPrefix: () => string;

  get: AsyncHttpInterceptorMethodHandler<Schema, 'GET'>;
  post: AsyncHttpInterceptorMethodHandler<Schema, 'POST'>;
  patch: AsyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;
  put: AsyncHttpInterceptorMethodHandler<Schema, 'PUT'>;
  delete: AsyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;
  head: AsyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;
  options: AsyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  clear: () => Promise<void>;
}

export type HttpInterceptor<Schema extends HttpServiceSchema> =
  | LocalHttpInterceptor<Schema>
  | RemoteHttpInterceptor<Schema>;
