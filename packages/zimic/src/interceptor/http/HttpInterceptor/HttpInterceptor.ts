import { Default } from '@/types/utils';

import HttpInterceptorWorker from '../HttpInterceptorWorker';
import { HttpRequestHandlerResult } from '../HttpInterceptorWorker/types';
import HttpRequestTracker from '../HttpRequestTracker';
import InternalHttpRequestTracker from '../HttpRequestTracker/InternalHttpRequestTracker';
import { HttpInterceptorRequest } from '../HttpRequestTracker/types/requests';
import { HttpInterceptorMethodHandler } from './types/handlers';
import {
  HttpInterceptorMethod,
  HttpInterceptorRequestContext,
  HttpInterceptorSchema,
  HttpInterceptorSchemaMethod,
  HttpInterceptorSchemaPath,
} from './types/schema';

type HttpRequestTrackersByPath<Schema extends HttpInterceptorSchema, Method extends HttpInterceptorMethod> = Map<
  string,
  InternalHttpRequestTracker<Default<Schema[keyof Schema][Method]>>[]
>;

class HttpInterceptor<Schema extends HttpInterceptorSchema> {
  protected _worker: HttpInterceptorWorker;

  private trackersByMethod: {
    [Method in HttpInterceptorMethod]: HttpRequestTrackersByPath<Schema, Method>;
  } = {
    GET: this.createTrackersByPathMap<'GET'>(),
    POST: this.createTrackersByPathMap<'POST'>(),
    PATCH: this.createTrackersByPathMap<'PATCH'>(),
    PUT: this.createTrackersByPathMap<'PUT'>(),
    DELETE: this.createTrackersByPathMap<'DELETE'>(),
    HEAD: this.createTrackersByPathMap<'HEAD'>(),
    OPTIONS: this.createTrackersByPathMap<'OPTIONS'>(),
  };

  constructor(options: { worker: HttpInterceptorWorker }) {
    this._worker = options.worker;
  }

  private createTrackersByPathMap<Method extends HttpInterceptorMethod>(): HttpRequestTrackersByPath<Schema, Method> {
    return new Map<string, InternalHttpRequestTracker<Default<Schema[keyof Schema][Method]>>[]>();
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
    return this.prepareHttpRequestTracker('GET' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'GET'>;

  post: HttpInterceptorMethodHandler<Schema, 'POST'> = ((path) => {
    return this.prepareHttpRequestTracker('POST' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'POST'>;

  patch: HttpInterceptorMethodHandler<Schema, 'PATCH'> = ((path) => {
    return this.prepareHttpRequestTracker('PATCH' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'PATCH'>;

  put: HttpInterceptorMethodHandler<Schema, 'PUT'> = ((path) => {
    return this.prepareHttpRequestTracker('PUT' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'PUT'>;

  delete: HttpInterceptorMethodHandler<Schema, 'DELETE'> = ((path) => {
    return this.prepareHttpRequestTracker('DELETE' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'DELETE'>;

  head: HttpInterceptorMethodHandler<Schema, 'HEAD'> = ((path) => {
    return this.prepareHttpRequestTracker('HEAD' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'HEAD'>;

  options: HttpInterceptorMethodHandler<Schema, 'OPTIONS'> = ((path) => {
    return this.prepareHttpRequestTracker('OPTIONS' as HttpInterceptorSchemaMethod<Schema>, path);
  }) as HttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  private prepareHttpRequestTracker<
    Method extends HttpInterceptorSchemaMethod<Schema>,
    Path extends HttpInterceptorSchemaPath<Schema, Method>,
  >(method: Method, path: Path): HttpRequestTracker<Default<Schema[Path][Method]>> {
    const tracker = new InternalHttpRequestTracker<Default<Schema[Path][Method]>>();

    const methodPathTrackers = this.trackersByMethod[method].get(path) ?? [];
    methodPathTrackers.push(tracker);

    if (!this.trackersByMethod[method].has(path)) {
      this.trackersByMethod[method].set(path, methodPathTrackers);

      this._worker.use(method, path, async (context) => {
        const response = this.handleInterceptedRequest(
          method,
          path,
          context as HttpInterceptorRequestContext<Schema, Method, Path>,
        );
        return response;
      });
    }

    return tracker;
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
    const parsedRequest = await this._worker.parseRawRequest<Default<Schema[Path][Method]>>(request);
    const matchedTracker = this.findMatchedTracker(method, path, parsedRequest);

    if (matchedTracker) {
      const responseDeclaration = await matchedTracker.applyResponseDeclaration(parsedRequest);

      const responseToParse = this._worker.createResponseFromDeclaration(responseDeclaration);

      const parsedResponse = await this._worker.parseRawResponse<
        Default<Schema[Path][Method]>,
        typeof responseDeclaration.status
      >(responseToParse);

      matchedTracker.registerInterceptedRequest(parsedRequest, parsedResponse);

      const responseToReturn = this._worker.createResponseFromDeclaration(responseDeclaration);
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
  ): InternalHttpRequestTracker<Default<Schema[keyof Schema][Method]>> | undefined {
    const methodPathTrackers = this.trackersByMethod[method].get(path);
    const matchedTracker = methodPathTrackers?.findLast((tracker) => tracker.matchesRequest(parsedRequest));
    return matchedTracker;
  }

  clearHandlers() {
    this._worker.clearHandlers();
  }
}

export default HttpInterceptor;
