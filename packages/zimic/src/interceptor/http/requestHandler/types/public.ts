import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import {
  HttpServiceResponseSchemaStatusCode,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  HttpServiceSchemaPath,
} from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';

import {
  HttpRequestHeadersSchema,
  HttpInterceptorRequest,
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerResponseDeclarationFactory,
  HttpRequestSearchParamsSchema,
  TrackedHttpInterceptorRequest,
  HttpRequestBodySchema,
} from './requests';

export type HttpRequestHandlerHeadersStaticRestriction<
  Schema extends HttpServiceSchema,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  Method extends HttpServiceSchemaMethod<Schema>,
> =
  | HttpRequestHeadersSchema<Default<Schema[Path][Method]>>
  | HttpHeaders<HttpRequestHeadersSchema<Default<Schema[Path][Method]>>>;

export type HttpRequestHandlerSearchParamsStaticRestriction<
  Schema extends HttpServiceSchema,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  Method extends HttpServiceSchemaMethod<Schema>,
> =
  | HttpRequestSearchParamsSchema<Default<Schema[Path][Method]>>
  | HttpSearchParams<HttpRequestSearchParamsSchema<Default<Schema[Path][Method]>>>;

export type HttpRequestHandlerBodyStaticRestriction<
  Schema extends HttpServiceSchema,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  Method extends HttpServiceSchemaMethod<Schema>,
> = HttpRequestBodySchema<Default<Schema[Path][Method]>>;

export interface HttpRequestHandlerStaticRestriction<
  Schema extends HttpServiceSchema,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  Method extends HttpServiceSchemaMethod<Schema>,
> {
  headers?: HttpRequestHandlerHeadersStaticRestriction<Schema, Path, Method>;
  searchParams?: HttpRequestHandlerSearchParamsStaticRestriction<Schema, Path, Method>;
  body?: HttpRequestHandlerBodyStaticRestriction<Schema, Path, Method>;
  exact?: boolean;
}

export type HttpRequestHandlerComputedRestriction<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
> = (request: HttpInterceptorRequest<Path, Default<Schema[Path][Method]>>) => boolean;

export type HttpRequestHandlerRestriction<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
> =
  | HttpRequestHandlerStaticRestriction<Schema, Path, Method>
  | HttpRequestHandlerComputedRestriction<Schema, Method, Path>;

export interface HttpRequestHandler<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> {
  /**
   * @returns The method that matches this handler.
   * @see {@link https://github.com/diego-aquino/zimic#handlermethod}
   */
  method: () => Method;

  /**
   * @returns The path that matches this handler. The base URL of the interceptor is not included, but it is used when
   *   matching requests.
   * @see {@link https://github.com/diego-aquino/zimic#handlerpath}
   */
  path: () => Path;

  /**
   * Declares a restriction to intercepted request matches. `headers`, `searchParams`, and `body` are supported to limit
   * which requests will match the handler and receive the mock response. If multiple restrictions are declared, either
   * in a single object or with multiple calls to `.with()`, all of them must be met, essentially creating an AND
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
   * @see {@link https://github.com/diego-aquino/zimic#handlerwithrestriction}
   */

  with: (
    restriction: HttpRequestHandlerRestriction<Schema, Method, Path>,
  ) => HttpRequestHandler<Schema, Method, Path, StatusCode>;

  /**
   * Declares a response to return for matched intercepted requests.
   *
   * When the handler matches a request, it will respond with the given declaration. The response type is statically
   * validated against the schema of the interceptor.
   *
   * @param declaration The response declaration or a factory to create it.
   * @returns The same handler, now including type information about the response declaration based on the specified
   *   status code.
   * @see {@link https://github.com/diego-aquino/zimic#handlerrespond}
   */
  respond: <StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, StatusCode>,
  ) => HttpRequestHandler<Schema, Method, Path, StatusCode>;

  /**
   * Clears any response declared with
   * [`.respond(declaration)`](https://github.com/diego-aquino/zimic#handlerresponddeclaration), making the handler stop
   * matching requests. The next handler, created before this one, that matches the same method and path will be used if
   * present. If not, the requests of the method and path will not be intercepted.
   *
   * To make the handler match requests again, register a new response with `handler.respond()`.
   *
   * This method is useful to skip a handler. It is more gentle than
   * [`handler.clear()`](https://github.com/diego-aquino/zimic#handlerclear), as it only removed the response, keeping
   * restrictions and intercepted requests.
   *
   * @returns The same handler, now without a declared responses.
   * @see {@link https://github.com/diego-aquino/zimic#handlerbypass}
   */
  bypass: () => HttpRequestHandler<Schema, Method, Path, StatusCode>;

  /**
   * Clears any response declared with
   * [`.respond(declaration)`](https://github.com/diego-aquino/zimic#handlerresponddeclaration), restrictions declared
   * with [`.with(restriction)`](https://github.com/diego-aquino/zimic#handlerwithrestriction), and intercepted
   * requests, making the handler stop matching requests. The next handler, created before this one, that matches the
   * same method and path will be used if present. If not, the requests of the method and path will not be intercepted.
   *
   * To make the handler match requests again, register a new response with `handler.respond()`.
   *
   * This method is useful to reset handlers to a clean state between tests. It is more aggressive than
   * [`handler.bypass()`](https://github.com/diego-aquino/zimic#handlerbypass), as it also clears restrictions and
   * intercepted requests.
   *
   * @returns The same handler, now cleared of any declared responses, restrictions, and intercepted requests.
   * @see {@link https://github.com/diego-aquino/zimic#handlerclear}
   */
  clear: () => HttpRequestHandler<Schema, Method, Path, StatusCode>;

  /**
   * @returns The intercepted requests that matched this handler, along with the responses returned to each of them.
   *   This is useful for testing that the correct requests were made by your application.
   * @see {@link https://github.com/diego-aquino/zimic#handlerrequests}
   */
  requests:
    | (() => readonly TrackedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[])
    | (() => Promise<readonly TrackedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[]>);
}

/**
 * HTTP request handlers allow declaring responses to return for matched intercepted requests. They also keep track of
 * the intercepted requests and their responses, allowing checks about how many requests your application made and with
 * which parameters.
 *
 * When multiple handlers of the same interceptor match the same method and path, the _last_ handler created with
 * {@link https://github.com/diego-aquino/zimic#interceptormethodpath `interceptor.<method>(path)`} will be used.
 *
 * @see {@link https://github.com/diego-aquino/zimic#httprequesthandler}
 */
export interface LocalHttpRequestHandler<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> extends HttpRequestHandler<Schema, Method, Path, StatusCode> {
  readonly type: 'local';

  with: (
    restriction: HttpRequestHandlerRestriction<Schema, Method, Path>,
  ) => LocalHttpRequestHandler<Schema, Method, Path, StatusCode>;

  respond: <StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, StatusCode>,
  ) => LocalHttpRequestHandler<Schema, Method, Path, StatusCode>;

  bypass: () => LocalHttpRequestHandler<Schema, Method, Path, StatusCode>;

  clear: () => LocalHttpRequestHandler<Schema, Method, Path, StatusCode>;

  requests: () => readonly TrackedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[];
}

export interface SyncedRemoteHttpRequestHandler<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> extends HttpRequestHandler<Schema, Method, Path, StatusCode> {
  with: (
    restriction: HttpRequestHandlerRestriction<Schema, Method, Path>,
  ) => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;

  respond: <StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestHandlerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>
      | HttpRequestHandlerResponseDeclarationFactory<Path, Default<Schema[Path][Method]>, StatusCode>,
  ) => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;

  bypass: () => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;

  clear: () => PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>;

  requests: () => Promise<readonly TrackedHttpInterceptorRequest<Path, Default<Schema[Path][Method]>, StatusCode>[]>;
}

export interface PendingRemoteHttpRequestHandler<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> extends SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> {
  then: <FulfilledResult = SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>, RejectedResult = never>(
    onFulfilled?:
      | ((
          handler: SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>,
        ) => PossiblePromise<FulfilledResult>)
      | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<FulfilledResult | RejectedResult>;

  catch: <RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> | RejectedResult>;

  finally: (
    onFinally?: (() => void) | null,
  ) => Promise<SyncedRemoteHttpRequestHandler<Schema, Method, Path, StatusCode>>;
}

export interface RemoteHttpRequestHandler<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> extends PendingRemoteHttpRequestHandler<Schema, Method, Path, StatusCode> {
  readonly type: 'remote';
}
