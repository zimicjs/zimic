import { HttpSchema } from '@zimic/http';

import { SyncHttpInterceptorMethodHandler, AsyncHttpInterceptorMethodHandler } from './handlers';
import { HttpInterceptorPlatform, RemoteHttpInterceptorOptions, UnhandledRequestStrategy } from './options';

/**
 * Configures if the intercepted requests are saved and how they are handled.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#saving-requests Saving intercepted requests}
 * @see {@link https://github.com/zimicjs/zimic/wiki/guides‐testing‐interceptor Testing}
 */
export interface HttpInterceptorRequestSaving {
  /**
   * Whether {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler request handlers}
   * should save their intercepted requests in memory and make them accessible through
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerrequests `handler.requests`}.
   *
   * If you are using
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorchecktimes `interceptor.checkTimes()`}
   * or
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerchecktimes `handler.checkTimes()`}
   * during tests, consider enabling this option to get more detailed information in `TimesCheckError` errors.
   *
   * **Important**: If `requestSaving.enabled` is `true`, make sure to regularly clear the interceptor to avoid requests
   * accumulating in memory. A common practice is to call
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorclear `interceptor.clear()`}
   * after each test.
   *
   * @default process.env.NODE_ENV === 'test'
   */
  enabled: boolean;

  /**
   * The safe number of requests to save in memory before logging warnings in the console. If `requestSaving.enabled` is
   * `true` and the interceptor is not regularly cleared with
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorclear `interceptor.clear()`},
   * the requests may accumulate in memory and cause performance issues. This option does not limit the number of
   * requests saved in memory, only when to log warnings.
   *
   * @default 1000
   */
  safeLimit: number;
}

/**
 * An interceptor to handle HTTP requests and return mock responses. The methods, paths, status codes, parameters, and
 * responses are statically-typed based on the provided service schema.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httpinterceptor `HttpInterceptor` API reference}
 */
// The schema is still a generic type for backward compatibility.
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface HttpInterceptor<_Schema extends HttpSchema> {
  /**
   * The base URL used by the interceptor.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorbaseurl `interceptor.baseURL` API reference}
   */
  baseURL: string;

  /**
   * Configures if the intercepted requests are saved and how they are handled.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#saving-requests Saving intercepted requests}
   * @see {@link https://github.com/zimicjs/zimic/wiki/guides‐testing‐interceptor Testing}
   */
  requestSaving: HttpInterceptorRequestSaving;

  /**
   * The platform the interceptor is running on.
   *
   * @readonly
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorplatform `interceptor.platform` API reference}
   */
  get platform(): HttpInterceptorPlatform | null;

  /**
   * Whether the interceptor is currently running and ready to use.
   *
   * @readonly
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorisrunning `interceptor.isRunning` API reference}
   */
  get isRunning(): boolean;

  /**
   * Starts the interceptor, allowing it to intercept HTTP requests.
   *
   * When targeting a browser environment, make sure to run `npx zimic-interceptor browser init <publicDirectory>` on
   * your terminal before starting the worker. This initializes the mock service worker in your public directory.
   *
   * @throws {UnregisteredServiceWorkerError} When the worker is targeting a browser environment and the mock service
   *   worker is not registered.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorstart `interceptor.start()` API reference}
   */
  start: () => Promise<void>;

  /**
   * Stops the interceptor, preventing it from intercepting HTTP requests. Stopped interceptors are automatically
   * cleared, exactly as if
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorclear `interceptor.clear()`}
   * had been called.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorstop `interceptor.stop()` API reference}
   */
  stop: () => Promise<void>;

  /**
   * Checks if all handlers created by this interceptor have matched the number of requests declared with
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes `handler.times()`}.
   *
   * If some handler has matched fewer or more requests than expected, this method will throw a `TimesCheckError` error,
   * including a stack trace to the
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes `handler.times()`} that
   * was not satisfied.
   *
   * This is useful in an `afterEach` hook (or equivalent) to make sure that all expected requests were made at the end
   * of each test.
   *
   * When
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#saving-requests
   * `requestSaving.enabled`} is
   * `true` in your interceptor, the `TimesCheckError` errors will also list each unmatched request with diff of the
   * expected and received data. This is useful for debugging requests that did not match a handler with
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions}.
   *
   * @throws {TimesCheckError} If some handler has matched less or more requests than the expected number of requests.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorchecktimes `interceptor.checkTimes()` API reference}
   * @see {@link https://github.com/zimicjs/zimic/wiki/guides‐teting Testing guide}
   */
  checkTimes: (() => void) | (() => Promise<void>);

  /**
   * Clears the interceptor and all of its
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   * instances, including their registered responses and intercepted requests. After calling this method, the
   * interceptor will no longer intercept any requests until new mock responses are registered.
   *
   * This method is useful to reset the interceptor mocks between tests.
   *
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptorclear `interceptor.clear()` API reference}
   */
  clear: (() => void) | (() => Promise<void>);
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
  /** @readonly */
  get type(): 'local';

  /**
   * The strategy to use for unhandled requests. If a request starts with the base URL of the interceptor, but no
   * matching handler exists, this strategy will be used. If a function is provided, it will be called with the
   * unhandled request.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  onUnhandledRequest?: UnhandledRequestStrategy.Local;

  /**
   * Creates a GET
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A GET
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  get: SyncHttpInterceptorMethodHandler<Schema, 'GET'>;

  /**
   * Creates a POST
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A POST
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  post: SyncHttpInterceptorMethodHandler<Schema, 'POST'>;

  /**
   * Creates a PATCH
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A PATCH
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  patch: SyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;

  /**
   * Creates a PUT
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A PUT
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  put: SyncHttpInterceptorMethodHandler<Schema, 'PUT'>;

  /**
   * Creates a DELETE
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A DELETE
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  delete: SyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;

  /**
   * Creates a HEAD
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A HEAD
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  head: SyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;

  /**
   * Creates an OPTIONS
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns An OPTIONS
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  options: SyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  checkTimes: () => void;

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
  /** @readonly */
  get type(): 'remote';

  /**
   * Options to authenticate the interceptor when connecting to an interceptor server. This is required if the
   * interceptor server was started with the `--tokens-dir` option.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#authentication Interceptor server authentication}
   */
  auth?: RemoteHttpInterceptorOptions['auth'];

  /**
   * The strategy to use for unhandled requests. If a request starts with the base URL of the interceptor, but no
   * matching handler exists, this strategy will be used. If a function is provided, it will be called with the
   * unhandled request.
   *
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests Unhandled requests}
   */
  onUnhandledRequest?: UnhandledRequestStrategy.Remote;

  /**
   * Creates a GET
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * When using a
   * {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors remote interceptor}, creating
   * a handler is an asynchronous operation, so you need to `await` it. You can also chain any number of operations and
   * apply them by awaiting the handler.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A GET
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  get: AsyncHttpInterceptorMethodHandler<Schema, 'GET'>;

  /**
   * Creates a POST
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * When using a
   * {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors remote interceptor}, creating
   * a handler is an asynchronous operation, so you need to `await` it. You can also chain any number of operations and
   * apply them by awaiting the handler.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A POST
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  post: AsyncHttpInterceptorMethodHandler<Schema, 'POST'>;

  /**
   * Creates a PATCH
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * When using a
   * {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors remote interceptor}, creating
   * a handler is an asynchronous operation, so you need to `await` it. You can also chain any number of operations and
   * apply them by awaiting the handler.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A PATCH
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  patch: AsyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;

  /**
   * Creates a PUT
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * When using a
   * {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors remote interceptor}, creating
   * a handler is an asynchronous operation, so you need to `await` it. You can also chain any number of operations and
   * apply them by awaiting the handler.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A PUT
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  put: AsyncHttpInterceptorMethodHandler<Schema, 'PUT'>;

  /**
   * Creates a DELETE
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * When using a
   * {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors remote interceptor}, creating
   * a handler is an asynchronous operation, so you need to `await` it. You can also chain any number of operations and
   * apply them by awaiting the handler.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A DELETE
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  delete: AsyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;

  /**
   * Creates a HEAD
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * When using a
   * {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors remote interceptor}, creating
   * a handler is an asynchronous operation, so you need to `await` it. You can also chain any number of operations and
   * apply them by awaiting the handler.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns A HEAD
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  head: AsyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;

  /**
   * Creates an OPTIONS
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`} for
   * a path. The path and method must be declared in the interceptor schema.
   *
   * When using a
   * {@link https://github.com/zimicjs/zimic/wiki/getting‐started#remote-http-interceptors remote interceptor}, creating
   * a handler is an asynchronous operation, so you need to `await` it. You can also chain any number of operations and
   * apply them by awaiting the handler.
   *
   * After a request is intercepted, Zimic tries to find a handler that matches it, considering the base URL of the
   * interceptor, and the method, path,
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction restrictions},
   * and
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes limits on the number of requests}
   * of the handler. The handlers are checked from the **last** one created to the first one, so new handlers have
   * preference over older ones. This allows you to declare generic and specific handlers based on their order of
   * creation. For example, a generic handler for `GET /users` can return an empty list, while a specific handler in a
   * test case can return a list with some users. In this case, the specific handler will be considered first as long as
   * it is created **after** the generic one.
   *
   * @param path The path to intercept. Paths with dynamic parameters, such as `/users/:id`, are supported, but you need
   *   to specify the original path as a type parameter to get type-inference and type-validation.
   * @returns An OPTIONS
   *   {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler`}
   *   for the provided path. The path and method must be declared in the interceptor schema.
   * @throws {NotRunningHttpInterceptorError} If the interceptor is not running.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)` API reference}
   */
  options: AsyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  checkTimes: () => Promise<void>;

  clear: () => Promise<void>;
}
