import {
  HttpResponseSchemaStatusCode,
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpStatusCode,
} from '@zimic/http';
import { Default, PossiblePromise } from '@zimic/utils/types';

import HttpRequestHandlerClient from '../HttpRequestHandlerClient';
import {
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  InterceptedHttpInterceptorRequest,
} from './requests';
import { HttpRequestHandlerRestriction } from './restrictions';

/**
 * An HTTP request handler to declare responses for intercepted requests.
 *
 * When multiple handlers of the same interceptor match the same method and path, the _last_ handler created with
 * {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptormethodpath `interceptor.<method>(path)`}
 * will be used.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference}
 */
export interface HttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> {
  /**
   * The method that matches this handler.
   *
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlermethod `handler.method` API reference}
   */
  get method(): Method;

  /**
   * The path that matches this handler. The base URL of the interceptor is not included, but it is used when matching
   * requests.
   *
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerpath `handler.path` API reference}
   */
  get path(): Path;
}

export interface InternalHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> extends HttpRequestHandler<Schema, Method, Path> {
  client: HttpRequestHandlerClient<Schema, Method, Path, StatusCode>;
}

/**
 * A local HTTP request handler to declare responses for intercepted requests. In a local handler, the mocking
 * operations are synchronous and are executed in the same process where it was created.
 *
 * When multiple handlers of the same interceptor match the same method and path, the _last_ handler created with
 * {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptormethodpath `interceptor.<method>(path)`}
 * will be used.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference}
 */
export interface LocalHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> extends HttpRequestHandler<Schema, Method, Path> {
  /** @readonly */
  get type(): 'local';

  /**
   * Declares a restriction to intercepted request matches. `headers`, `searchParams`, and `body` are supported to limit
   * which requests will match the handler and receive the mock response. If multiple restrictions are declared, either
   * in a single object or with multiple calls to `handler.with()`, all of them must be met, essentially creating an AND
   * condition.
   *
   * By default, restrictions use `exact: false`, meaning that any request **containing** the declared restrictions will
   * match the handler, regardless of having more properties or values. If you want to match only requests with the
   * exact values declared, you can use `exact: true`.
   *
   * A function is also supported to declare restrictions, in case they are dynamic.
   *
   * @param restriction The restriction to match intercepted requests.
   * @returns The same handler, now considering the specified restriction.
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference}
   */
  with: (restriction: HttpRequestHandlerRestriction<Schema, Method, Path>) => this;

  /**
   * Declares a response to return for matched intercepted requests.
   *
   * When the handler matches a request, it will respond with the given declaration. The response type is statically
   * validated against the schema of the interceptor.
   *
   * @param declaration The response declaration or a factory to create it.
   * @returns The same handler, now including type information about the response declaration based on the specified
   *   status code.
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrespond `handler.respond()` API reference}
   */
  respond: <NewStatusCode extends HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, NewStatusCode>,
  ) => LocalHttpRequestHandler<Schema, Method, Path, NewStatusCode>;

  /**
   * Declares a number of intercepted requests that the handler will be able to match and return its response.
   *
   * If only one argument is provided, the handler will match exactly that number of requests. In case of two arguments,
   * the handler will consider an inclusive range, matching at least the minimum (first argument) and at most the
   * maximum (second argument) number of requests.
   *
   * Once the handler receives more requests than the maximum number declared, it will stop matching requests and
   * returning its response. In this case, Zimic will try other handlers until one eligible is found, otherwise the
   * request will be either bypassed or rejected. Learn more about how Zimic decides which handler to use for an
   * intercepted request in the
   * {@link https://zimic.dev/docs/interceptor/api/http-interceptor#declaring-request-handlers Declaring request handlers}.
   *
   * **Important**: To make sure that all expected requests were made, use
   * {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorchecktimes `interceptor.checkTimes()`} or
   * {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlertimes `handler.times()`}.
   * {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorchecktimes `interceptor.checkTimes()`} is
   * generally preferred, as it checks all handlers created by the interceptor with a single call.
   *
   * @param numberOfRequests The number of times the handler should match intercepted requests.
   * @param minNumberOfRequests The minimum number of times the handler should match intercepted requests.
   * @param maxNumberOfRequests The maximum number of times the handler should match intercepted requests.
   * @returns The same handler, now considering the specified number of times.
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlertimes `handler.times()` API reference}
   */
  times: ((numberOfRequests: number) => this) & ((minNumberOfRequests: number, maxNumberOfRequests: number) => this);

  /**
   * Checks if the handler has matched the expected number of requests declared with
   * {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlertimes `handler.times()`}.
   *
   * If the handler has matched fewer or more requests than expected, this method will throw a `TimesCheckError` error
   * pointing to the
   * {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlertimes `handler.times()` API reference}
   * that was not satisfied.
   *
   * When {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor#saving-requests
   * `requestSaving.enabled`}
   * is `true` in your interceptor, the `TimesCheckError` errors will also list each unmatched request with diff of the
   * expected and received data. This is useful for debugging requests that did not match a handler with
   * {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction restrictions}.
   *
   * @throws {TimesCheckError} If the handler has matched less or more requests than the expected number of requests.
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerchecktimes `handler.checkTimes()` API reference}
   */
  checkTimes: () => void;

  /**
   * Clears any response declared with
   * [`handler.respond(declaration)`](https://zimic.dev/docs/interceptor/api/http-request-handler#handlerresponddeclaration),
   * restrictions declared with
   * [`handler.with(restriction)`](https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction),
   * and intercepted requests, making the handler stop matching requests. The next handler, created before this one,
   * that matches the same method and path will be used if present. If not, the requests of the method and path will not
   * be intercepted.
   *
   * To make the handler match requests again, register a new response with
   * {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrespond `handler.respond()`}.
   *
   * @returns The same handler, now cleared of any declared responses, restrictions, and intercepted requests.
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerclear `handler.clear()` API reference}
   */
  clear: () => this;

  /**
   * The intercepted requests that matched this handler, along with the responses returned to each of them. This is
   * useful for testing that the correct requests were made by your application.
   *
   * **Important**: This method can only be used if
   * {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor#saving-requests
   * `requestSaving.enabled`} is
   * `true` in the interceptor. See
   * {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor#saving-requests Saving intercepted requests}
   * for more information.
   *
   * @throws {DisabledRequestSavingError} If the interceptor has `requestSaving.enabled: false`.
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrequests `handler.requests` API reference}
   */
  get requests(): readonly InterceptedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[];
}

/**
 * A synced remote HTTP request handler. When a remote handler is synced, it is guaranteed that all of the mocking
 * operations were committed to the connected {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference}
 */
export interface SyncedRemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> extends HttpRequestHandler<Schema, Method, Path> {
  /** @readonly */
  get type(): 'remote';

  /**
   * Declares a restriction to intercepted request matches. `headers`, `searchParams`, and `body` are supported to limit
   * which requests will match the handler and receive the mock response. If multiple restrictions are declared, either
   * in a single object or with multiple calls to `handler.with()`, all of them must be met, essentially creating an AND
   * condition.
   *
   * By default, restrictions use `exact: false`, meaning that any request **containing** the declared restrictions will
   * match the handler, regardless of having more properties or values. If you want to match only requests with the
   * exact values declared, you can use `exact: true`.
   *
   * A function is also supported to declare restrictions, in case they are dynamic.
   *
   * @param restriction The restriction to match intercepted requests.
   * @returns The same handler, now considering the specified restriction.
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction `handler.with()` API reference}
   */
  with: (
    restriction: HttpRequestHandlerRestriction<Schema, Method, Path>,
  ) => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;

  /**
   * Declares a response to return for matched intercepted requests.
   *
   * When the handler matches a request, it will respond with the given declaration. The response type is statically
   * validated against the schema of the interceptor.
   *
   * @param declaration The response declaration or a factory to create it.
   * @returns The same handler, now including type information about the response declaration based on the specified
   *   status code.
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrespond `handler.respond()` API reference}
   */
  respond: <NewStatusCode extends HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, NewStatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, NewStatusCode>,
  ) => PendingRemoteHttpRequestHandler<Schema, Method, Path, NewStatusCode>;

  /**
   * Declares a number of intercepted requests that the handler will be able to match and return its response.
   *
   * If only one argument is provided, the handler will match exactly that number of requests. In case of two arguments,
   * the handler will consider an inclusive range, matching at least the minimum (first argument) and at most the
   * maximum (second argument) number of requests.
   *
   * Once the handler receives more requests than the maximum number declared, it will stop matching requests and
   * returning its response. In this case, Zimic will try other handlers until one eligible is found, otherwise the
   * request will be either bypassed or rejected. Learn more about how Zimic decides which handler to use for an
   * intercepted request in the
   * {@link https://zimic.dev/docs/interceptor/api/http-interceptor#declaring-request-handlers Declaring request handlers}.
   *
   * **Important**: To make sure that all expected requests were made, use
   * {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorchecktimes `interceptor.checkTimes()`} or
   * {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerchecktimes `handler.checkTimes()`}.
   * {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptorchecktimes `interceptor.checkTimes()`} is
   * generally preferred, as it checks all handlers created by the interceptor with a single call.
   *
   * @param numberOfRequests The number of times the handler should match intercepted requests.
   * @param minNumberOfRequests The minimum number of times the handler should match intercepted requests.
   * @param maxNumberOfRequests The maximum number of times the handler should match intercepted requests.
   * @returns The same handler, now considering the specified number of times.
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlertimes `handler.times()` API reference}
   */
  times: ((numberOfRequests: number) => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>) &
    ((
      minNumberOfRequests: number,
      maxNumberOfRequests: number,
    ) => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>);

  /**
   * Checks if the handler has matched the expected number of requests declared with
   * {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlertimes `handler.times()`}.
   *
   * If the handler has matched fewer or more requests than expected, this method will throw a `TimesCheckError` error
   * pointing to the
   * {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlertimes `handler.times()` API reference}
   * that was not satisfied.
   *
   * When {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor#saving-requests
   * `requestSaving.enabled`}
   * is true in your interceptor, the `TimesCheckError` errors will also list each unmatched request with diff of the
   * expected and received data. This is useful for debugging requests that did not match a handler with
   * {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction restrictions}.
   *
   * @throws {TimesCheckError} If the handler has matched less or more requests than the expected number of requests.
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerchecktimes `handler.checkTimes()` API reference}
   */
  checkTimes: () => Promise<void>;

  /**
   * Clears any response declared with
   * [`handler.respond(declaration)`](https://zimic.dev/docs/interceptor/api/http-request-handler#handlerresponddeclaration),
   * restrictions declared with
   * [`handler.with(restriction)`](https://zimic.dev/docs/interceptor/api/http-request-handler#handlerwithrestriction),
   * and intercepted requests, making the handler stop matching requests. The next handler, created before this one,
   * that matches the same method and path will be used if present. If not, the requests of the method and path will not
   * be intercepted.
   *
   * To make the handler match requests again, register a new response with
   * {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrespond `handler.respond()`}.
   *
   * @returns The same handler, now cleared of any declared responses, restrictions, and intercepted requests.
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerclear `handler.clear()` API reference}
   */
  clear: () => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;

  /**
   * The intercepted requests that matched this handler, along with the responses returned to each of them. This is
   * useful for testing that the correct requests were made by your application.
   *
   * **Important**: This method can only be used if
   * {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor#saving-requests
   * `requestSaving.enabled`} is
   * `true` in the interceptor. See
   * {@link https://zimic.dev/docs/interceptor/api/create-http-interceptor#saving-requests Saving intercepted requests}
   * for more information.
   *
   * @throws {DisabledRequestSavingError} If the interceptor has `requestSaving.enabled: false`.
   * @readonly
   * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler#handlerrequests `handler.requests` API reference}
   */
  get requests(): readonly InterceptedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[];
}

/**
 * A pending remote HTTP request handler. When a remote handler is pending, it is not guaranteed that all of the mocking
 * operations were committed to the connected {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 *
 * To commit a remote interceptor, you can `await` it or use the methods {@link then handler.then()},
 * {@link catch handler.catch()}, and {@link finally handler.finally()}.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference}
 */
export interface PendingRemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> extends SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> {
  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  then: <FulfilledResult = SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>, RejectedResult = never>(
    onFulfilled?:
      | ((
          handler: SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>,
        ) => PossiblePromise<FulfilledResult>)
      | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<FulfilledResult | RejectedResult>;

  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  catch: <RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> | RejectedResult>;

  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
   */
  finally: (
    onFinally?: (() => void) | null,
  ) => Promise<SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>>;
}

/**
 * A remote HTTP request handler to declare responses for intercepted requests. In a remote handler, the mocking
 * operations are asynchronous and include remote calls to the connected
 * {@link https://zimic.dev/docs/interceptor/cli/server interceptor server}.
 *
 * When multiple handlers of the same interceptor match the same method and path, the _last_ handler created with
 * {@link https://zimic.dev/docs/interceptor/api/http-interceptor#interceptormethodpath `interceptor.<method>(path)`}
 * will be used.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/http-request-handler `HttpRequestHandler` API reference}
 */
export type RemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpStatusCode = never,
> = PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;
