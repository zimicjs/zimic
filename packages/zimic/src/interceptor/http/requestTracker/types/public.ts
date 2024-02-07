import { Default } from '@/types/utils';

import {
  HttpInterceptorResponseSchemaStatusCode,
  HttpInterceptorSchema,
  HttpInterceptorSchemaMethod,
  HttpInterceptorSchemaPath,
} from '../../interceptor/types/schema';
import {
  HttpRequestTrackerResponseDeclaration,
  HttpRequestTrackerResponseDeclarationFactory,
  TrackedHttpInterceptorRequest,
} from './requests';

/**
 * HTTP request trackers allow declaring responses to return for matched intercepted requests. They also keep track of
 * the intercepted requests and their responses, allowing checks about how many requests your application made and with
 * which parameters.
 *
 * When multiple trackers of the same interceptor match the same method and route, the *last* tracker created with
 * {@link https://github.com/diego-aquino/zimic#interceptormethodpath `interceptor.<method>(path)`} will be used.
 *
 * @see {@link https://github.com/diego-aquino/zimic#httprequesttracker}
 */
export interface HttpRequestTracker<
  Schema extends HttpInterceptorSchema,
  Method extends HttpInterceptorSchemaMethod<Schema>,
  Path extends HttpInterceptorSchemaPath<Schema, Method>,
  StatusCode extends HttpInterceptorResponseSchemaStatusCode<
    Default<Default<Schema[Path][Method]>['response']>
  > = never,
> {
  /**
   * @returns The method that matches this tracker.
   *
   * @see {@link https://github.com/diego-aquino/zimic#trackermethod}
   */
  method: () => Method;

  /**
   * @returns The path that matches this tracker. The base URL of the interceptor is not included, but it is used when
   * matching requests.
   *
   * @see {@link https://github.com/diego-aquino/zimic#trackerpath}
   */
  path: () => Path;

  /**
   * Declares a response to return for matched intercepted requests.
   *
   * When the tracker matches a request, it will respond with the given declaration. The response type is statically
   * validated against the schema of the interceptor.
   *
   * @param declaration The response declaration or a factory to create it.
   *
   * @returns The same tracker, now including type information about the response declaration based on the
   * specified status code.
   *
   * @see {@link https://github.com/diego-aquino/zimic#trackerrespond}
   */
  respond: <
    StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>>,
  >(
    declaration:
      | HttpRequestTrackerResponseDeclaration<Default<Schema[Path][Method]>, StatusCode>
      | HttpRequestTrackerResponseDeclarationFactory<Default<Schema[Path][Method]>, StatusCode>,
  ) => HttpRequestTracker<Schema, Method, Path, StatusCode>;

  /**
   * Clears any declared response and makes the tracker stop matching intercepted requests. The next tracker, created
   * before this one, that matches the same method and path will be used if present. If not, the requests of the method
   * and path will not be intercepted.
   *
   * @see {@link https://github.com/diego-aquino/zimic#trackerbypass}
   */
  bypass: () => HttpRequestTracker<Schema, Method, Path, StatusCode>;

  /**
   * @returns The intercepted requests that matched this tracker, along with the responses returned to each of them.
   * This is useful for testing that the correct requests were made by your application.
   *
   * @see {@link https://github.com/diego-aquino/zimic#trackerrequests}
   */
  requests: () => readonly TrackedHttpInterceptorRequest<Default<Schema[Path][Method]>, StatusCode>[];
}
