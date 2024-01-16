import { Default } from '@/types/utils';

import HttpInterceptorWorker from '../HttpInterceptorWorker';
import { HttpRequestHandlerContext, HttpRequestHandlerResult } from '../HttpInterceptorWorker/types';
import HttpRequestTracker from '../HttpRequestTracker';
import { HttpInterceptorRequest } from '../HttpRequestTracker/types';
import { HttpInterceptorMethodHandler } from './types/handlers';
import { HttpInterceptorContext, HttpInterceptorOptions } from './types/options';
import { HttpInterceptorMethod, HttpInterceptorSchema, HttpInterceptorSchemaPath } from './types/schema';

type HttpRequestTrackersByPath<Schema extends HttpInterceptorSchema, Method extends HttpInterceptorMethod> = Map<
  string,
  HttpRequestTracker<Default<Schema[keyof Schema][Method]>>[]
>;

abstract class HttpInterceptor<Schema extends HttpInterceptorSchema, Worker extends HttpInterceptorWorker> {
  private context: HttpInterceptorContext<Worker>;

  private trackersByMethod: { [Method in HttpInterceptorMethod]: HttpRequestTrackersByPath<Schema, Method> } = {
    GET: this.createTrackersByPathMap<'GET'>(),
    POST: this.createTrackersByPathMap<'POST'>(),
    PATCH: this.createTrackersByPathMap<'PATCH'>(),
    PUT: this.createTrackersByPathMap<'PUT'>(),
    DELETE: this.createTrackersByPathMap<'DELETE'>(),
    HEAD: this.createTrackersByPathMap<'HEAD'>(),
    OPTIONS: this.createTrackersByPathMap<'OPTIONS'>(),
  };

  constructor(options: HttpInterceptorOptions & { worker: Worker }) {
    this.context = {
      worker: options.worker,
      baseURL: options.baseURL,
    };
  }

  private createTrackersByPathMap<Method extends HttpInterceptorMethod>(): HttpRequestTrackersByPath<Schema, Method> {
    return new Map<string, HttpRequestTracker<Default<Schema[keyof Schema][Method]>>[]>();
  }

  async start() {
    await this.context.worker.start();
  }

  stop() {
    this.context.worker.stop();
  }

  get: HttpInterceptorMethodHandler<Schema, 'GET'> = (path) => {
    return this.prepareHttpRequestTracker('GET', path);
  };

  post: HttpInterceptorMethodHandler<Schema, 'POST'> = (path) => {
    return this.prepareHttpRequestTracker('POST', path);
  };

  patch: HttpInterceptorMethodHandler<Schema, 'PATCH'> = (path) => {
    return this.prepareHttpRequestTracker('PATCH', path);
  };

  put: HttpInterceptorMethodHandler<Schema, 'PUT'> = (path) => {
    return this.prepareHttpRequestTracker('PUT', path);
  };

  delete: HttpInterceptorMethodHandler<Schema, 'DELETE'> = (path) => {
    return this.prepareHttpRequestTracker('DELETE', path);
  };

  head: HttpInterceptorMethodHandler<Schema, 'HEAD'> = (path) => {
    return this.prepareHttpRequestTracker('HEAD', path);
  };

  options: HttpInterceptorMethodHandler<Schema, 'OPTIONS'> = (path) => {
    return this.prepareHttpRequestTracker('OPTIONS', path);
  };

  private prepareHttpRequestTracker<
    Method extends HttpInterceptorMethod,
    Path extends HttpInterceptorSchemaPath<Schema>,
  >(method: Method, path: Path) {
    const tracker = new HttpRequestTracker<Default<Schema[Path][Method]>>();

    const methodPathTrackers = this.trackersByMethod[method].get(path) ?? [];
    methodPathTrackers.push(tracker);

    if (!this.trackersByMethod[method].has(path)) {
      this.trackersByMethod[method].set(path, methodPathTrackers);

      const boundRequestHandler = this.handleInterceptedRequest.bind(this, method, path);
      this.context.worker.use(method, path, boundRequestHandler);
    }

    return tracker;
  }

  private handleInterceptedRequest = async <
    Method extends HttpInterceptorMethod,
    Path extends HttpInterceptorSchemaPath<Schema>,
  >(
    method: Method,
    path: Path,
    { request }: HttpRequestHandlerContext<Default<Default<Schema[Path][Method]>['request']>['body']>,
  ): Promise<HttpRequestHandlerResult> => {
    const methodPathTrackers = this.trackersByMethod[method].get(path) ?? [];

    const requestWithParsedBody = this.parseRawRequest<Method, Path>(request);

    const matchedTracker = methodPathTrackers.findLast((tracker) => tracker.matchesRequest(requestWithParsedBody));

    if (matchedTracker) {
      const responseDefinition = await matchedTracker.createResponseResult(requestWithParsedBody);
      return responseDefinition;
    } else {
      return { bypass: true };
    }
  };

  private parseRawRequest<Method extends HttpInterceptorMethod, Path extends HttpInterceptorSchemaPath<Schema>>(
    request: HttpRequestHandlerContext<Default<Default<Schema[Path][Method]>['request']>['body']>['request'],
  ) {
    const requestWithParsedBody = request as unknown as HttpInterceptorRequest<
      Default<Default<Schema[Path][Method]>['request']>
    >;

    const requestContentType = request.headers.get('Content-Type');
    const hasJSONBody = requestContentType?.includes('application/json');

    const propertiesToAddToRequest: Partial<
      HttpInterceptorRequest<Default<Default<Schema[Path][Method]>['request']>>
    >[] = [
      {
        rawBody: request.body,
      },
      hasJSONBody
        ? {
            body: request.json() as Default<Default<Default<Schema[Path][Method]>['request']>['body']>,
          }
        : {},
    ];

    Object.assign(requestWithParsedBody, ...propertiesToAddToRequest);
    return requestWithParsedBody;
  }
}

export default HttpInterceptor;
