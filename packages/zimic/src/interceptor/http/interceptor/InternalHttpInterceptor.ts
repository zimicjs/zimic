import { Default } from '@/types/utils';

import HttpInterceptorWorker from '../interceptorWorker/HttpInterceptorWorker';
import { HttpRequestHandlerResult } from '../interceptorWorker/types';
import InternalHttpRequestTracker from '../requestTracker/InternalHttpRequestTracker';
import { HttpRequestTracker } from '../requestTracker/types/public';
import { HttpInterceptorRequest } from '../requestTracker/types/requests';
import { HttpInterceptorMethodHandler } from './types/handlers';
import { HttpInterceptor } from './types/public';
import {
  HTTP_INTERCEPTOR_METHODS,
  HttpInterceptorMethod,
  HttpInterceptorRequestContext,
  HttpInterceptorResponseSchemaStatusCode,
  HttpInterceptorSchema,
  HttpInterceptorSchemaMethod,
  HttpInterceptorSchemaPath,
} from './types/schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyInternalHttpRequestTracker = InternalHttpRequestTracker<any, any, any, any>;

class InternalHttpInterceptor<Schema extends HttpInterceptorSchema, Worker extends HttpInterceptorWorker>
  implements HttpInterceptor<Schema>
{
  protected _worker: Worker;

  private trackersByMethod: {
    [Method in HttpInterceptorMethod]: Map<string, AnyInternalHttpRequestTracker[]>;
  } = {
    GET: new Map(),
    POST: new Map(),
    PATCH: new Map(),
    PUT: new Map(),
    DELETE: new Map(),
    HEAD: new Map(),
    OPTIONS: new Map(),
  };

  constructor(options: { worker: Worker }) {
    this._worker = options.worker;
  }

  worker() {
    return this._worker;
  }

  baseURL() {
    return this._worker.baseURL();
  }

  isRunning() {
    return this._worker.isRunning();
  }

  async start() {
    await this._worker.start();
  }

  stop() {
    this._worker.stop();
  }

  get: HttpInterceptorMethodHandler<Schema, 'GET'> = ((path) => {
    return this.createHttpRequestTracker('GET' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'GET'>;

  post: HttpInterceptorMethodHandler<Schema, 'POST'> = ((path) => {
    return this.createHttpRequestTracker('POST' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'POST'>;

  patch: HttpInterceptorMethodHandler<Schema, 'PATCH'> = ((path) => {
    return this.createHttpRequestTracker('PATCH' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'PATCH'>;

  put: HttpInterceptorMethodHandler<Schema, 'PUT'> = ((path) => {
    return this.createHttpRequestTracker('PUT' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'PUT'>;

  delete: HttpInterceptorMethodHandler<Schema, 'DELETE'> = ((path) => {
    return this.createHttpRequestTracker('DELETE' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'DELETE'>;

  head: HttpInterceptorMethodHandler<Schema, 'HEAD'> = ((path) => {
    return this.createHttpRequestTracker('HEAD' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'HEAD'>;

  options: HttpInterceptorMethodHandler<Schema, 'OPTIONS'> = ((path) => {
    return this.createHttpRequestTracker('OPTIONS' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  private createHttpRequestTracker<
    Method extends HttpInterceptorSchemaMethod<Schema>,
    Path extends HttpInterceptorSchemaPath<Schema, Method>,
  >(method: Method, path: Path): HttpRequestTracker<Schema, Method, Path> {
    const tracker = new InternalHttpRequestTracker<Schema, Method, Path>(this, method, path);
    this.registerRequestTracker(tracker);
    return tracker;
  }

  registerRequestTracker<
    Method extends HttpInterceptorSchemaMethod<Schema>,
    Path extends HttpInterceptorSchemaPath<Schema, Method>,
    StatusCode extends HttpInterceptorResponseSchemaStatusCode<
      Default<Default<Schema[Path][Method]>['response']>
    > = never,
  >(tracker: InternalHttpRequestTracker<Schema, Method, Path, StatusCode>) {
    const methodPathTrackers = this.trackersByMethod[tracker.method()].get(tracker.path()) ?? [];

    if (!methodPathTrackers.includes(tracker)) {
      methodPathTrackers.push(tracker);
    }

    const isFirstTrackerForMethodPath = methodPathTrackers.length === 1;

    if (isFirstTrackerForMethodPath) {
      this.trackersByMethod[tracker.method()].set(tracker.path(), methodPathTrackers);

      this._worker.use(tracker.method(), tracker.path(), async (context) => {
        const response = this.handleInterceptedRequest(
          tracker.method(),
          tracker.path(),
          context as HttpInterceptorRequestContext<Schema, Method, Path>,
        );
        return response;
      });
    }
  }

  private handleInterceptedRequest = async <
    Method extends HttpInterceptorSchemaMethod<Schema>,
    Path extends HttpInterceptorSchemaPath<Schema, Method>,
    Context extends HttpInterceptorRequestContext<Schema, Method, Path>,
  >(
    method: Method,
    path: Path,
    { request }: Context,
  ): Promise<HttpRequestHandlerResult> => {
    const parsedRequest = await HttpInterceptorWorker.parseRawRequest<Default<Schema[Path][Method]>>(request);
    const matchedTracker = this.findMatchedTracker(method, path, parsedRequest);

    if (matchedTracker) {
      const responseDeclaration = await matchedTracker.applyResponseDeclaration(parsedRequest);

      const responseToParse = HttpInterceptorWorker.createResponseFromDeclaration(responseDeclaration);

      const parsedResponse = await HttpInterceptorWorker.parseRawResponse<
        Default<Schema[Path][Method]>,
        typeof responseDeclaration.status
      >(responseToParse);

      matchedTracker.registerInterceptedRequest(parsedRequest, parsedResponse);

      const responseToReturn = HttpInterceptorWorker.createResponseFromDeclaration(responseDeclaration);
      return { response: responseToReturn };
    } else {
      return { bypass: true };
    }
  };

  private findMatchedTracker<
    Method extends HttpInterceptorSchemaMethod<Schema>,
    Path extends HttpInterceptorSchemaPath<Schema, Method>,
  >(
    method: Method,
    path: Path,
    parsedRequest: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): InternalHttpRequestTracker<Schema, Method, Path, any> | undefined {
    const methodPathTrackers = this.trackersByMethod[method].get(path);
    const matchedTracker = methodPathTrackers?.findLast((tracker) => tracker.matchesRequest(parsedRequest));
    return matchedTracker;
  }

  clear() {
    this._worker.clearHandlers();

    for (const method of HTTP_INTERCEPTOR_METHODS) {
      this.bypassMethodTrackers(method);
      this.trackersByMethod[method].clear();
    }
  }

  private bypassMethodTrackers(method: HttpInterceptorMethod) {
    for (const trackers of this.trackersByMethod[method].values()) {
      for (const tracker of trackers) {
        tracker.bypass();
      }
    }
  }
}

export default InternalHttpInterceptor;
