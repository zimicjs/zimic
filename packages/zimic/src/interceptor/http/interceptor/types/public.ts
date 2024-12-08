import { HttpSchema } from '@/http/types/schema';

import {
  HttpInterceptorMethodHandler,
  SyncHttpInterceptorMethodHandler,
  AsyncHttpInterceptorMethodHandler,
} from './handlers';
import { HttpInterceptorPlatform } from './options';

/**
 * An interceptor to handle HTTP requests and return mock responses. The methods, paths, status codes, parameters, and
 * responses are statically-typed based on the provided service schema.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptor `HttpInterceptor` API reference}
 */
export interface HttpInterceptor<Schema extends HttpSchema> {
  /**
   * @returns The base URL used by the interceptor.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorbaseurl `interceptor.baseURL()` API reference}
   */
  baseURL: () => string;

  /**
   * @returns The platform the interceptor is running on.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorplatform `interceptor.platform()` API reference}
   */
  platform: () => HttpInterceptorPlatform | null;

  /**
   * @returns Whether the interceptor is currently running and ready to use.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorisrunning `interceptor.isRunning()` API reference}
   */
  isRunning: () => boolean;

  /**
   * Starts the interceptor, allowing it to intercept HTTP requests.
   *
   * When targeting a browser environment, make sure to run `npx zimic browser init <publicDirectory>` on your terminal
   * before starting the worker. This initializes the mock service worker in your public directory.
   *
   * @throws {UnregisteredServiceWorkerError} When the worker is targeting a browser environment and the mock service
   *   worker is not registered.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorstart `interceptor.start()` API reference}
   */
  start: () => Promise<void>;

  /**
   * Stops the interceptor, preventing it from intercepting HTTP requests.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorstop `interceptor.stop()` API reference}
   */
  stop: () => Promise<void>;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A GET
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  get: HttpInterceptorMethodHandler<Schema, 'GET'>;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A POST
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  post: HttpInterceptorMethodHandler<Schema, 'POST'>;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A PATCH
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  patch: HttpInterceptorMethodHandler<Schema, 'PATCH'>;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A PUT
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  put: HttpInterceptorMethodHandler<Schema, 'PUT'>;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A DELETE
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  delete: HttpInterceptorMethodHandler<Schema, 'DELETE'>;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A HEAD
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  head: HttpInterceptorMethodHandler<Schema, 'HEAD'>;

  /**
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns An OPTIONS
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotStartedHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  options: HttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  /**
   * Clears all of the
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   * instances created by this interceptor. After calling this method, the interceptor will no longer intercept any
   * requests until new mock responses are registered.
   *
   * This method is useful to reset the interceptor mocks between tests.
   *
   * @throws {NotStartedHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorclear `interceptor.clear()` API reference}
   */
  clear: () => void;
}

/**
 * A local interceptor to handle HTTP requests and return mock responses. The methods, paths, status codes, parameters,
 * and responses are statically-typed based on the provided service schema.
 *
 * To intercept HTTP requests, the interceptor must have been started with
 * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorstart `interceptor.start()`}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptor `HttpInterceptor` API reference}
 */
export interface LocalHttpInterceptor<Schema extends HttpSchema> extends HttpInterceptor<Schema> {
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

/**
 * A remote interceptor to handle HTTP requests and return mock responses. The methods, paths, status codes, parameters,
 * and responses are statically-typed based on the provided service schema.
 *
 * To intercept HTTP requests, the interceptor must have been started with
 * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorstart `interceptor.start()`}
 * and an {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server interceptor server} should be
 * running.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptor `HttpInterceptor` API reference}
 */
export interface RemoteHttpInterceptor<Schema extends HttpSchema> extends HttpInterceptor<Schema> {
  readonly type: 'remote';

  get: AsyncHttpInterceptorMethodHandler<Schema, 'GET'>;
  post: AsyncHttpInterceptorMethodHandler<Schema, 'POST'>;
  patch: AsyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;
  put: AsyncHttpInterceptorMethodHandler<Schema, 'PUT'>;
  delete: AsyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;
  head: AsyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;
  options: AsyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  clear: () => Promise<void>;
}
