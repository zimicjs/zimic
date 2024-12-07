import HttpFormData from '@/http/formData/HttpFormData';
import HttpHeaders from '@/http/headers/HttpHeaders';
import { HttpHeadersSchema } from '@/http/headers/types';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import { HttpSearchParamsSchema } from '@/http/searchParams/types';
import { HttpBody } from '@/http/types/requests';
import { HttpResponseSchemaStatusCode, HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@/http/types/schema';
import { DeepPartial, Default, IfAny, IfNever, PossiblePromise } from '@/types/utils';

import {
  HttpInterceptorRequest,
  HttpRequestBodySchema,
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  HttpRequestHeadersSchema,
  HttpRequestSearchParamsSchema,
  TrackedHttpInterceptorRequest,
} from './requests';

type PartialHttpHeadersOrSchema<Schema extends HttpHeadersSchema> =
  | Partial<Schema>
  | HttpHeaders<Partial<Schema>>
  | HttpHeaders<Schema>;

/**
 * A static headers restriction to match intercepted requests.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction `handler.with()` API reference}
 */
export type HttpRequestHandlerHeadersStaticRestriction<
  Schema extends HttpSchema,
  Path extends HttpSchemaPath<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
> = PartialHttpHeadersOrSchema<HttpRequestHeadersSchema<Default<Schema[Path][Method]>>>;

type PartialHttpSearchParamsOrSchema<Schema extends HttpSearchParamsSchema> = IfNever<
  Schema,
  never,
  Partial<Schema> | HttpSearchParams<Partial<Schema>> | HttpSearchParams<Schema>
>;

/**
 * A static search params restriction to match intercepted requests.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction `handler.with()` API reference}
 */
export type HttpRequestHandlerSearchParamsStaticRestriction<
  Schema extends HttpSchema,
  Path extends HttpSchemaPath<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
> = PartialHttpSearchParamsOrSchema<HttpRequestSearchParamsSchema<Default<Schema[Path][Method]>>>;

type PartialBodyOrSchema<Body extends HttpBody> =
  Body extends HttpFormData<infer Schema>
    ? HttpFormData<Partial<Schema>> | HttpFormData<Schema>
    : Body extends HttpSearchParams<infer Schema>
      ? HttpSearchParams<Partial<Schema>> | HttpSearchParams<Schema>
      : Body extends Blob
        ? Body
        : DeepPartial<Body>;

/**
 * A static body restriction to match intercepted requests.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction `handler.with()` API reference}
 */
export type HttpRequestHandlerBodyStaticRestriction<
  Schema extends HttpSchema,
  Path extends HttpSchemaPath<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
> = PartialBodyOrSchema<HttpRequestBodySchema<Default<Schema[Path][Method]>>>;

/**
 * A static restriction to match intercepted requests.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction `handler.with()` API reference}
 */
export interface HttpRequestHandlerStaticRestriction<
  Schema extends HttpSchema,
  Path extends HttpSchemaPath<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
> {
  /**
   * A set of headers that the intercepted request must contain to match the handler. If exact is `true`, the request
   * must contain exactly these headers and no others.
   */
  headers?: HttpRequestHandlerHeadersStaticRestriction<Schema, Path, Method>;

  /**
   * A set of search params that the intercepted request must contain to match the handler. If exact is `true`, the
   * request must contain exactly these search params and no others.
   */
  searchParams?: HttpRequestHandlerSearchParamsStaticRestriction<Schema, Path, Method>;

  /**
   * The body that the intercepted request must contain to match the handler. If exact is `true`, the request must
   * contain exactly this body and no other.
   */
  body?: HttpRequestHandlerBodyStaticRestriction<Schema, Path, Method>;

  /**
   * If `true`, the request must contain **exactly** the headers, search params, and body declared in this restriction.
   * Otherwise, the request must contain **at least** them.
   */
  exact?: boolean;
}

/**
 * A computed restriction to match intercepted requests.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction `handler.with()` API reference}
 */
export type HttpRequestHandlerComputedRestriction<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> = (request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>) => PossiblePromise<boolean>;

/**
 * A restriction to match intercepted requests.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction `handler.with()` API reference}
 */
export type HttpRequestHandlerRestriction<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> =
  | HttpRequestHandlerStaticRestriction<Schema, Path, Method>
  | HttpRequestHandlerComputedRestriction<Schema, Method, Path>;

/**
 * An HTTP request handler to declare responses for intercepted requests.
 *
 * When multiple handlers of the same interceptor match the same method and path, the _last_ handler created with
 * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)`}
 * will be used.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler` API reference}
 */
export interface HttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
> {
  /**
   * @returns The method that matches this handler.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlermethod `handler.method()` API reference}
   */
  method: () => Method;

  /**
   * @returns The path that matches this handler. The base URL of the interceptor is not included, but it is used when
   *   matching requests.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerpath `handler.path()` API reference}
   */
  path: () => Path;
}

/**
 * A local HTTP request handler to declare responses for intercepted requests. In a local handler, the mocking
 * operations are synchronous and are executed in the same process where it was created.
 *
 * When multiple handlers of the same interceptor match the same method and path, the _last_ handler created with
 * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)`}
 * will be used.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler` API reference}
 */
export interface LocalHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends IfAny<
    Schema,
    any, // eslint-disable-line @typescript-eslint/no-explicit-any
    HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>
  > = never,
> extends HttpRequestHandler<Schema, Method, Path> {
  readonly type: 'local';

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
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction `handler.with()` API reference}
   */
  with: (
    restriction: HttpRequestHandlerRestriction<Schema, Method, Path>,
  ) => LocalHttpRequestHandler<Schema, Method, Path, StatusCode>;

  /**
   * Declares a response to return for matched intercepted requests.
   *
   * When the handler matches a request, it will respond with the given declaration. The response type is statically
   * validated against the schema of the interceptor.
   *
   * @param declaration The response declaration or a factory to create it.
   * @returns The same handler, now including type information about the response declaration based on the specified
   *   status code.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerrespond `handler.respond()` API reference}
   */
  respond: <StatusCode extends HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, StatusCode>,
  ) => LocalHttpRequestHandler<Schema, Method, Path, StatusCode>;

  bypass: () => LocalHttpRequestHandler<Schema, Method, Path, StatusCode>;

  /**
   * Clears any response declared with
   * [`handler.respond(declaration)`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerresponddeclaration),
   * restrictions declared with
   * [`handler.with(restriction)`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction),
   * and intercepted requests, making the handler stop matching requests. The next handler, created before this one,
   * that matches the same method and path will be used if present. If not, the requests of the method and path will not
   * be intercepted.
   *
   * To make the handler match requests again, register a new response with
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerrespond `handler.respond()`}.
   *
   * This method is useful to reset handlers to a clean state between tests. It is more aggressive than
   * [`handler.bypass()`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerbypass), as it
   * also clears restrictions and intercepted requests.
   *
   * @returns The same handler, now cleared of any declared responses, restrictions, and intercepted requests.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerclear `handler.clear()` API reference}
   */
  clear: () => LocalHttpRequestHandler<Schema, Method, Path, StatusCode>;

  /**
   * Returns the intercepted requests that matched this handler, along with the responses returned to each of them. This
   * is useful for testing that the correct requests were made by your application.
   *
   * **IMPORTANT**: This method can only be used if `saveRequests` was set to `true` when creating the interceptor. See
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#saving-requests Saving intercepted requests}
   * for more information.
   *
   * @returns The intercepted requests.
   * @throws {DisabledRequestSavingError} If the interceptor was not created with `saveRequests: true`.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerrequests `handler.requests()` API reference}
   */
  requests: () => readonly TrackedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[];
}

/**
 * A synced remote HTTP request handler. When a remote handler is synced, it is guaranteed that all of the mocking
 * operations were committed to the connected
 * {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server interceptor server}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler` API reference}
 */
export interface SyncedRemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> extends HttpRequestHandler<Schema, Method, Path> {
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
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction `handler.with()` API reference}
   */
  with: (
    restriction: HttpRequestHandlerRestriction<Schema, Method, Path>,
  ) => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;

  respond: <StatusCode extends HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, StatusCode>,
  ) => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;

  bypass: () => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;

  /**
   * Clears any response declared with
   * [`handler.respond(declaration)`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerresponddeclaration),
   * restrictions declared with
   * [`handler.with(restriction)`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerwithrestriction),
   * and intercepted requests, making the handler stop matching requests. The next handler, created before this one,
   * that matches the same method and path will be used if present. If not, the requests of the method and path will not
   * be intercepted.
   *
   * To make the handler match requests again, register a new response with
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerrespond `handler.respond()`}.
   *
   * This method is useful to reset handlers to a clean state between tests. It is more aggressive than
   * [`handler.bypass()`](https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerbypass), as it
   * also clears restrictions and intercepted requests.
   *
   * @returns The same handler, now cleared of any declared responses, restrictions, and intercepted requests.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerclear `handler.clear()` API reference}
   */
  clear: () => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;

  /**
   * Returns the intercepted requests that matched this handler, along with the responses returned to each of them. This
   * is useful for testing that the correct requests were made by your application.
   *
   * **IMPORTANT**: This method can only be used if `saveRequests` was set to `true` when creating the interceptor. See
   * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#saving-requests Saving intercepted requests}
   * for more information.
   *
   * @returns The intercepted requests.
   * @throws {DisabledRequestSavingError} If the interceptor was not created with `saveRequests: true`.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlerrequests `handler.requests()` API reference}
   */
  requests: () => Promise<readonly TrackedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[]>;
}

/**
 * A pending remote HTTP request handler. When a remote handler is pending, it is not guaranteed that all of the mocking
 * operations were committed to the connected
 * {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server interceptor server}.
 *
 * To commit a remote interceptor, you can `await` it or use the methods {@link then handler.then()},
 * {@link catch handler.catch()}, and {@link finally handler.finally()}.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler` API reference}
 */
export interface PendingRemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> extends SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> {
  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server interceptor server}.
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
   * {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server interceptor server}.
   */
  catch: <RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> | RejectedResult>;

  /**
   * Waits for the remote handler to be synced with the connected
   * {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server interceptor server}.
   */
  finally: (
    onFinally?: (() => void) | null,
  ) => Promise<SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>>;
}

/**
 * A remote HTTP request handler to declare responses for intercepted requests. In a remote handler, the mocking
 * operations are asynchronous and include remote calls to the connected
 * {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐server#zimic-server interceptor server}.
 *
 * When multiple handlers of the same interceptor match the same method and path, the _last_ handler created with
 * {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-interceptormethodpath `interceptor.<method>(path)`}
 * will be used.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#httprequesthandler `HttpRequestHandler` API reference}
 */
export interface RemoteHttpRequestHandler<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath<Schema, Method>,
  StatusCode extends IfAny<
    Schema,
    any, // eslint-disable-line @typescript-eslint/no-explicit-any
    HttpResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>
  > = never,
> extends PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> {
  readonly type: 'remote';
}
