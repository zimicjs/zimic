import {
  HTTP_METHODS,
  HttpMethod,
  HttpServiceResponseSchemaStatusCode,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  HttpServiceSchemaPath,
} from '@/http/types/schema';
import { Default } from '@/types/utils';
import { joinURLPaths } from '@/utils/fetch';

import LocalHttpInterceptorWorker from '../interceptorWorker/LocalHttpInterceptorWorker';
import { LocalHttpInterceptorWorker as PublicLocalHttpInterceptorWorker } from '../interceptorWorker/types/public';
import { HttpRequestHandlerResult } from '../interceptorWorker/types/requests';
import HttpRequestTracker from '../requestTracker/HttpRequestTracker';
import { HttpRequestTracker as PublicHttpRequestTracker } from '../requestTracker/types/public';
import { HttpInterceptorRequest } from '../requestTracker/types/requests';
import { SyncHttpInterceptorMethodHandler } from './types/handlers';
import { LocalHttpInterceptorOptions } from './types/options';
import { LocalHttpInterceptor as PublicLocalHttpInterceptor } from './types/public';
import { HttpInterceptorRequestContext } from './types/requests';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHttpRequestTracker = HttpRequestTracker<any, any, any, any>;

class LocalHttpInterceptor<Schema extends HttpServiceSchema> implements PublicLocalHttpInterceptor<Schema> {
  readonly type = 'local';

  private worker: LocalHttpInterceptorWorker;
  private _baseURL: string;

  private trackersByMethod: {
    [Method in HttpMethod]: Map<string, AnyHttpRequestTracker[]>;
  } = {
    GET: new Map(),
    POST: new Map(),
    PATCH: new Map(),
    PUT: new Map(),
    DELETE: new Map(),
    HEAD: new Map(),
    OPTIONS: new Map(),
  };

  constructor(options: LocalHttpInterceptorOptions) {
    this.worker = options.worker satisfies PublicLocalHttpInterceptorWorker as LocalHttpInterceptorWorker;
    this._baseURL = options.baseURL;
  }

  baseURL() {
    return this._baseURL;
  }

  get: SyncHttpInterceptorMethodHandler<Schema, 'GET'> = ((path) => {
    return this.createHttpRequestTracker('GET' as HttpServiceSchemaMethod<Schema>, path);
  }) as SyncHttpInterceptorMethodHandler<Schema, 'GET'>;

  post: SyncHttpInterceptorMethodHandler<Schema, 'POST'> = ((path) => {
    return this.createHttpRequestTracker('POST' as HttpServiceSchemaMethod<Schema>, path);
  }) as SyncHttpInterceptorMethodHandler<Schema, 'POST'>;

  patch: SyncHttpInterceptorMethodHandler<Schema, 'PATCH'> = ((path) => {
    return this.createHttpRequestTracker('PATCH' as HttpServiceSchemaMethod<Schema>, path);
  }) as SyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;

  put: SyncHttpInterceptorMethodHandler<Schema, 'PUT'> = ((path) => {
    return this.createHttpRequestTracker('PUT' as HttpServiceSchemaMethod<Schema>, path);
  }) as SyncHttpInterceptorMethodHandler<Schema, 'PUT'>;

  delete: SyncHttpInterceptorMethodHandler<Schema, 'DELETE'> = ((path) => {
    return this.createHttpRequestTracker('DELETE' as HttpServiceSchemaMethod<Schema>, path);
  }) as SyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;

  head: SyncHttpInterceptorMethodHandler<Schema, 'HEAD'> = ((path) => {
    return this.createHttpRequestTracker('HEAD' as HttpServiceSchemaMethod<Schema>, path);
  }) as SyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;

  options: SyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'> = ((path) => {
    return this.createHttpRequestTracker('OPTIONS' as HttpServiceSchemaMethod<Schema>, path);
  }) as SyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  private createHttpRequestTracker<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
  >(method: Method, path: Path): PublicHttpRequestTracker<Schema, Method, Path> {
    const tracker = new HttpRequestTracker<Schema, Method, Path>(this, method, path);
    this.registerRequestTracker(tracker);
    return tracker;
  }

  registerRequestTracker<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
    StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
  >(tracker: HttpRequestTracker<Schema, Method, Path, StatusCode>) {
    const methodPathTrackers = this.trackersByMethod[tracker.method()].get(tracker.path()) ?? [];

    if (!methodPathTrackers.includes(tracker)) {
      methodPathTrackers.push(tracker);
    }

    const isFirstTrackerForMethodPath = methodPathTrackers.length === 1;

    if (isFirstTrackerForMethodPath) {
      this.trackersByMethod[tracker.method()].set(tracker.path(), methodPathTrackers);

      const pathWithBaseURL = joinURLPaths(this.baseURL(), tracker.path());

      this.worker.use(this, tracker.method(), pathWithBaseURL, async (context) => {
        const response = await this.handleInterceptedRequest(
          tracker.method(),
          tracker.path(),
          context as HttpInterceptorRequestContext<Schema, Method, Path>,
        );
        return response;
      });
    }
  }

  private async handleInterceptedRequest<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
    Context extends HttpInterceptorRequestContext<Schema, Method, Path>,
  >(method: Method, path: Path, { request }: Context): Promise<HttpRequestHandlerResult> {
    const parsedRequest = await LocalHttpInterceptorWorker.parseRawRequest<Default<Schema[Path][Method]>>(request);
    const matchedTracker = this.findMatchedTracker(method, path, parsedRequest);

    if (matchedTracker) {
      const responseDeclaration = await matchedTracker.applyResponseDeclaration(parsedRequest);
      const responseToParse = LocalHttpInterceptorWorker.createResponseFromDeclaration(responseDeclaration);
      const parsedResponse = await LocalHttpInterceptorWorker.parseRawResponse<
        Default<Schema[Path][Method]>,
        typeof responseDeclaration.status
      >(responseToParse);

      matchedTracker.registerInterceptedRequest(parsedRequest, parsedResponse);

      const responseToReturn = LocalHttpInterceptorWorker.createResponseFromDeclaration(responseDeclaration);
      return { response: responseToReturn };
    } else {
      return { bypass: true };
    }
  }

  private findMatchedTracker<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
  >(
    method: Method,
    path: Path,
    parsedRequest: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): HttpRequestTracker<Schema, Method, Path, any> | undefined {
    const methodPathTrackers = this.trackersByMethod[method].get(path);
    const matchedTracker = methodPathTrackers?.findLast((tracker) => tracker.matchesRequest(parsedRequest));
    return matchedTracker;
  }

  clear() {
    for (const method of HTTP_METHODS) {
      this.bypassMethodTrackers(method);
      this.trackersByMethod[method].clear();
    }
    this.worker.clearInterceptorHandlers(this);
  }

  private bypassMethodTrackers(method: HttpMethod) {
    for (const trackers of this.trackersByMethod[method].values()) {
      for (const tracker of trackers) {
        tracker.bypass();
      }
    }
  }
}

export default LocalHttpInterceptor;
