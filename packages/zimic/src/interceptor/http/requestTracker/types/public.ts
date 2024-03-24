import HttpHeaders from '@/http/headers/HttpHeaders';
import HttpSearchParams from '@/http/searchParams/HttpSearchParams';
import {
  HttpServiceResponseSchemaStatusCode,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  HttpServiceSchemaPath,
} from '@/http/types/schema';
import { Default } from '@/types/utils';

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
export interface HttpRequestTracker<
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

  with: (
    restriction: HttpRequestTrackerRestriction<Schema, Method, Path>,
  ) => HttpRequestTracker<Schema, Method, Path, StatusCode>;

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
  ) => HttpRequestTracker<Schema, Method, Path, StatusCode>;

  /**
   * Clears any declared responses, making the tracker stop matching intercepted requests. The next tracker, created
   * before this one, that matches the same method and path will be used if present. If not, the requests of the method
   * and path will not be intercepted.
   *
   * To make the tracker match requests again, register a new response with `tracker.respond()`.
   *
   * @see {@link https://github.com/diego-aquino/zimic#trackerbypass}
   */
  bypass: () => HttpRequestTracker<Schema, Method, Path, StatusCode>;

  /**
   * Clears any declared responses, restrictions, and intercepted requests, making the tracker stop matching intercepted
   * requests. The next tracker, created before this one, that matches the same method and path will be used if present.
   * If not, the requests of the method and path will not be intercepted.
   *
   * To make the tracker match requests again, register a new response with `tracker.respond()`.
   *
   * @see {@link https://github.com/diego-aquino/zimic#trackerclear}
   */
  clear: () => HttpRequestTracker<Schema, Method, Path, StatusCode>;

  /**
   * @returns The intercepted requests that matched this tracker, along with the responses returned to each of them.
   *   This is useful for testing that the correct requests were made by your application.
   * @see {@link https://github.com/diego-aquino/zimic#trackerrequests}
   */
  requests: () => readonly TrackedHttpInterceptorRequest<Default<Schema[Path][Method]>, StatusCode>[];
}
