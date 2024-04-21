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
  HttpRequestTrackerResponseDeclaration,
  HttpRequestTrackerResponseDeclarationFactory,
  HttpRequestSearchParamsSchema,
  TrackedHttpInterceptorRequest,
  HttpRequestBodySchema,
} from './requests';

export type HttpRequestTrackerHeadersStaticRestriction<
  Schema extends HttpServiceSchema,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  Method extends HttpServiceSchemaMethod<Schema>,
> =
  | HttpRequestHeadersSchema<Default<Schema[Path][Method]>>
  | HttpHeaders<HttpRequestHeadersSchema<Default<Schema[Path][Method]>>>;

export type HttpRequestTrackerSearchParamsStaticRestriction<
  Schema extends HttpServiceSchema,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  Method extends HttpServiceSchemaMethod<Schema>,
> =
  | HttpRequestSearchParamsSchema<Default<Schema[Path][Method]>>
  | HttpSearchParams<HttpRequestSearchParamsSchema<Default<Schema[Path][Method]>>>;

export type HttpRequestTrackerBodyStaticRestriction<
  Schema extends HttpServiceSchema,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  Method extends HttpServiceSchemaMethod<Schema>,
> = HttpRequestBodySchema<Default<Schema[Path][Method]>>;

export interface HttpRequestTrackerStaticRestriction<
  Schema extends HttpServiceSchema,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  Method extends HttpServiceSchemaMethod<Schema>,
> {
  headers?: HttpRequestTrackerHeadersStaticRestriction<Schema, Path, Method>;
  searchParams?: HttpRequestTrackerSearchParamsStaticRestriction<Schema, Path, Method>;
  body?: HttpRequestTrackerBodyStaticRestriction<Schema, Path, Method>;
  exact?: boolean;
}

export type HttpRequestTrackerComputedRestriction<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
> = (request: HttpInterceptorRequest<Default<Schema[Path][Method]>>) => boolean;

export type HttpRequestTrackerRestriction<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
> =
  | HttpRequestTrackerStaticRestriction<Schema, Path, Method>
  | HttpRequestTrackerComputedRestriction<Schema, Method, Path>;

export interface PublicBaseHttpRequestTracker<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> {
  /**
   * @returns The method that matches this tracker.
   * @see {@link https://github.com/diego-aquino/zimic#trackermethod}
   */
  method: () => Method;

  /**
   * @returns The path that matches this tracker. The base URL of the interceptor is not included, but it is used when
   *   matching requests.
   * @see {@link https://github.com/diego-aquino/zimic#trackerpath}
   */
  path: () => Path;

  /**
   * Declares a restriction to intercepted request matches. `headers`, `searchParams`, and `body` are supported to limit
   * which requests will match the tracker and receive the mock response. If multiple restrictions are declared, either
   * in a single object or with multiple calls to `.with()`, all of them must be met, essentially creating an AND
   * condition.
   *
   * By default, restrictions use `exact: false`, meaning that any request **containing** the declared restrictions will
   * match the tracker, regardless of having more properties or values. If you want to match only requests with the
   * exact values declared, you can use `exact: true`.
   *
   * A function is also supported to declare restrictions, in case they are dynamic.
   *
   * @param restriction The restriction to match intercepted requests.
   * @returns The same tracker, now considering the specified restriction.
   * @see {@link https://github.com/diego-aquino/zimic#trackerwithrestriction}
   */

  with: (
    restriction: HttpRequestTrackerRestriction<Schema, Method, Path>,
  ) => PublicBaseHttpRequestTracker<Schema, Method, Path, StatusCode>;

  /**
   * Declares a response to return for matched intercepted requests.
   *
   * When the tracker matches a request, it will respond with the given declaration. The response type is statically
   * validated against the schema of the interceptor.
   *
   * @param declaration The response declaration or a factory to create it.
   * @returns The same tracker, now including type information about the response declaration based on the specified
   *   status code.
   * @see {@link https://github.com/diego-aquino/zimic#trackerrespond}
   */
  respond: <StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<Default<Schema[Path][Method]>, StatusCode>,
  ) => PublicBaseHttpRequestTracker<Schema, Method, Path, StatusCode>;

  /**
   * Clears any response declared with
   * [`.respond(declaration)`](https://github.com/diego-aquino/zimic#trackerresponddeclaration), making the tracker stop
   * matching requests. The next tracker, created before this one, that matches the same method and path will be used if
   * present. If not, the requests of the method and path will not be intercepted.
   *
   * To make the tracker match requests again, register a new response with `tracker.respond()`.
   *
   * This method is useful to skip a tracker. It is more gentle than
   * [`tracker.clear()`](https://github.com/diego-aquino/zimic#trackerclear), as it only removed the response, keeping
   * restrictions and intercepted requests.
   *
   * @returns The same tracker, now without a declared responses.
   * @see {@link https://github.com/diego-aquino/zimic#trackerbypass}
   */
  bypass: () => PublicBaseHttpRequestTracker<Schema, Method, Path, StatusCode>;

  /**
   * Clears any response declared with
   * [`.respond(declaration)`](https://github.com/diego-aquino/zimic#trackerresponddeclaration), restrictions declared
   * with [`.with(restriction)`](https://github.com/diego-aquino/zimic#trackerwithrestriction), and intercepted
   * requests, making the tracker stop matching requests. The next tracker, created before this one, that matches the
   * same method and path will be used if present. If not, the requests of the method and path will not be intercepted.
   *
   * To make the tracker match requests again, register a new response with `tracker.respond()`.
   *
   * This method is useful to reset trackers to a clean state between tests. It is more aggressive than
   * [`tracker.bypass()`](https://github.com/diego-aquino/zimic#trackerbypass), as it also clears restrictions and
   * intercepted requests.
   *
   * @returns The same tracker, now cleared of any declared responses, restrictions, and intercepted requests.
   * @see {@link https://github.com/diego-aquino/zimic#trackerclear}
   */
  clear: () => PublicBaseHttpRequestTracker<Schema, Method, Path, StatusCode>;

  /**
   * @returns The intercepted requests that matched this tracker, along with the responses returned to each of them.
   *   This is useful for testing that the correct requests were made by your application.
   * @see {@link https://github.com/diego-aquino/zimic#trackerrequests}
   */
  requests:
    | (() => readonly TrackedHttpInterceptorRequest<Default<Schema[Path][Method]>, StatusCode>[])
    | (() => Promise<readonly TrackedHttpInterceptorRequest<Default<Schema[Path][Method]>, StatusCode>[]>);
}

/**
 * HTTP request trackers allow declaring responses to return for matched intercepted requests. They also keep track of
 * the intercepted requests and their responses, allowing checks about how many requests your application made and with
 * which parameters.
 *
 * When multiple trackers of the same interceptor match the same method and path, the _last_ tracker created with
 * {@link https://github.com/diego-aquino/zimic#interceptormethodpath `interceptor.<method>(path)`} will be used.
 *
 * @see {@link https://github.com/diego-aquino/zimic#httprequesttracker}
 */
export interface PublicLocalHttpRequestTracker<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> extends PublicBaseHttpRequestTracker<Schema, Method, Path, StatusCode> {
  readonly type: 'local';

  with: (
    restriction: HttpRequestTrackerRestriction<Schema, Method, Path>,
  ) => PublicLocalHttpRequestTracker<Schema, Method, Path, StatusCode>;

  respond: <StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<Default<Schema[Path][Method]>, StatusCode>,
  ) => PublicLocalHttpRequestTracker<Schema, Method, Path, StatusCode>;

  bypass: () => PublicLocalHttpRequestTracker<Schema, Method, Path, StatusCode>;

  clear: () => PublicLocalHttpRequestTracker<Schema, Method, Path, StatusCode>;

  requests: () => readonly TrackedHttpInterceptorRequest<Default<Schema[Path][Method]>, StatusCode>[];
}

export interface PublicSyncedRemoteHttpRequestTracker<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> extends PublicBaseHttpRequestTracker<Schema, Method, Path, StatusCode> {
  with: (
    restriction: HttpRequestTrackerRestriction<Schema, Method, Path>,
  ) => PublicPendingRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>;

  respond: <StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>>(
    declaration:
      | HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<Default<Schema[Path][Method]>, StatusCode>,
  ) => PublicPendingRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>;

  bypass: () => PublicPendingRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>;

  clear: () => PublicPendingRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>;

  requests: () => Promise<readonly TrackedHttpInterceptorRequest<Default<Schema[Path][Method]>, StatusCode>[]>;
}

export interface PublicPendingRemoteHttpRequestTracker<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> extends PublicSyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode> {
  then: <
    FulfilledResult = PublicSyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>,
    RejectedResult = never,
  >(
    onFulfilled?:
      | ((
          tracker: PublicSyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>,
        ) => PossiblePromise<FulfilledResult>)
      | null,
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<FulfilledResult | RejectedResult>;

  catch: <RejectedResult = never>(
    onRejected?: ((reason: unknown) => PossiblePromise<RejectedResult>) | null,
  ) => Promise<PublicSyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode> | RejectedResult>;

  finally: (
    onFinally?: (() => void) | null,
  ) => Promise<PublicSyncedRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>>;
}

export interface PublicRemoteHttpRequestTracker<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> extends PublicPendingRemoteHttpRequestTracker<Schema, Method, Path, StatusCode> {
  readonly type: 'remote';
}

export type PublicHttpRequestTracker<
  Schema extends HttpServiceSchema,
  Method extends HttpServiceSchemaMethod<Schema>,
  Path extends HttpServiceSchemaPath<Schema, Method>,
  StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
> =
  | PublicLocalHttpRequestTracker<Schema, Method, Path, StatusCode>
  | PublicRemoteHttpRequestTracker<Schema, Method, Path, StatusCode>;
