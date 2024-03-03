import { HttpInterceptorMethodHandler } from './handlers';
import { HttpInterceptorSchema } from './schema';

/**
 * Interceptor to handle matched HTTP requests and return mock responses. The methods, paths, status codes, parameters
 * and responses are statically-typed based on the provided service schema.
 *
 * To intercept HTTP requests, an interceptor needs a running
 * {@link https://github.com/diego-aquino/zimic#httpinterceptorworker HttpInterceptorWorker}.
 *
 * @see {@link https://github.com/diego-aquino/zimic#httpinterceptor}
 */

export interface HttpInterceptor<Schema extends HttpInterceptorSchema> {
  /**
   * @returns The base URL used by the interceptor.
   * @see {@link https://github.com/diego-aquino/zimic#interceptorbaseurl}
   */
  baseURL: () => string;

  /**
   * @returns A GET {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the provided
   *   path. The path and method must be declared in the interceptor schema.
   *
   *   Paths with dynamic parameters, such as `/users/:id`, are supported, but you need to specify the original
   *
   *   Path as a type parameter to get type-inference and type-validation.
   * @see {@link https://github.com/diego-aquino/zimic#interceptormethodpath}
   */
  get: HttpInterceptorMethodHandler<Schema, 'GET'>;

  /**
   * @returns A POST {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the provided
   *   path. The path and method must be declared in the interceptor schema.
   *
   *   Paths with dynamic parameters, such as `/users/:id`, are supported, but you need to specify the original path as a
   *   type parameter to get type-inference and type-validation.
   * @see {@link https://github.com/diego-aquino/zimic#interceptormethodpath}
   */
  post: HttpInterceptorMethodHandler<Schema, 'POST'>;

  /**
   * @returns A PATCH {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the
   *   provided path. The path and method must be declared in the interceptor schema.
   *
   *   Paths with dynamic parameters, such as `/users/:id`, are supported, but you need to specify the original path as a
   *   type parameter to get type-inference and type-validation.
   * @see {@link https://github.com/diego-aquino/zimic#interceptormethodpath}
   */
  patch: HttpInterceptorMethodHandler<Schema, 'PATCH'>;

  /**
   * @returns A PUT {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the provided
   *   path. The path and method must be declared in the interceptor schema.
   *
   *   Paths with dynamic parameters, such as `/users/:id`, are supported, but you need to specify the original path as a
   *   type parameter to get type-inference and type-validation.
   * @see {@link https://github.com/diego-aquino/zimic#interceptormethodpath}
   */
  put: HttpInterceptorMethodHandler<Schema, 'PUT'>;

  /**
   * @returns A DELETE {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the
   *   provided path. The path and method must be declared in the interceptor schema.
   *
   *   Paths with dynamic parameters, such as `/users/:id`, are supported, but you need to specify the original path as a
   *   type parameter to get type-inference and type-validation.
   * @see {@link https://github.com/diego-aquino/zimic#interceptormethodpath}
   */
  delete: HttpInterceptorMethodHandler<Schema, 'DELETE'>;

  /**
   * @returns A HEAD {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the provided
   *   path. The path and method must be declared in the interceptor schema.
   *
   *   Paths with dynamic parameters, such as `/users/:id`, are supported, but you need to specify the original path as a
   *   type parameter to get type-inference and type-validation.
   * @see {@link https://github.com/diego-aquino/zimic#interceptormethodpath}
   */
  head: HttpInterceptorMethodHandler<Schema, 'HEAD'>;

  /**
   * @returns An OPTIONS {@link https://github.com/diego-aquino/zimic#httprequesttracker HttpRequestTracker} for the
   *   provided path. The path and method must be declared in the interceptor schema.
   *
   *   Paths with dynamic parameters, such as `/users/:id`, are supported, but you need to specify the original path as a
   *   type parameter to get type-inference and type-validation.
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
