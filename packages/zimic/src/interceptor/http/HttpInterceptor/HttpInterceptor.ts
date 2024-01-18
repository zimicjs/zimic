import { Default } from '@/types/utils';

import HttpInterceptorWorker from '../HttpInterceptorWorker';
import { HttpRequestHandlerResult } from '../HttpInterceptorWorker/types';
import HttpRequestTracker from '../HttpRequestTracker';
import { HttpInterceptorRequest } from '../HttpRequestTracker/types';
import { HttpInterceptorMethodHandler, StrictHttpInterceptorMethodHandler } from './types/handlers';
import { HttpInterceptorOptions } from './types/options';
import {
  HttpInterceptorMethod,
  HttpInterceptorRequestContext,
  HttpInterceptorSchema,
  HttpInterceptorSchemaMethod,
  HttpInterceptorSchemaPath,
} from './types/schema';

type HttpRequestTrackersByPath<Schema extends HttpInterceptorSchema, Method extends HttpInterceptorMethod> = Map<
  string,
  HttpRequestTracker<Default<Schema[keyof Schema][Method]>>[]
>;

abstract class HttpInterceptor<Schema extends HttpInterceptorSchema, Worker extends HttpInterceptorWorker> {
  protected worker: Worker;
  protected baseURL?: string;

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
    this.worker = options.worker;
    this.baseURL = options.baseURL;
  }

  private createTrackersByPathMap<Method extends HttpInterceptorMethod>(): HttpRequestTrackersByPath<Schema, Method> {
    return new Map<string, HttpRequestTracker<Default<Schema[keyof Schema][Method]>>[]>();
  }

  async start() {
    await this.worker.start();
  }

  stop() {
    this.worker.stop();
  }

  get: HttpInterceptorMethodHandler<Schema, 'GET'> = ((path) => {
    return this.prepareHttpRequestTracker('GET' as HttpInterceptorSchemaMethod<Schema>, path);
  }) satisfies StrictHttpInterceptorMethodHandler<
    Schema,
    HttpInterceptorSchemaMethod<Schema>
  > as HttpInterceptorMethodHandler<Schema, 'GET'>;

  post: HttpInterceptorMethodHandler<Schema, 'POST'> = ((path) => {
    return this.prepareHttpRequestTracker('POST' as HttpInterceptorSchemaMethod<Schema>, path);
  }) satisfies StrictHttpInterceptorMethodHandler<
    Schema,
    HttpInterceptorSchemaMethod<Schema>
  > as HttpInterceptorMethodHandler<Schema, 'POST'>;

  patch: HttpInterceptorMethodHandler<Schema, 'PATCH'> = ((path) => {
    return this.prepareHttpRequestTracker('PATCH' as HttpInterceptorSchemaMethod<Schema>, path);
  }) satisfies StrictHttpInterceptorMethodHandler<
    Schema,
    HttpInterceptorSchemaMethod<Schema>
  > as HttpInterceptorMethodHandler<Schema, 'PATCH'>;

  put: HttpInterceptorMethodHandler<Schema, 'PUT'> = ((path) => {
    return this.prepareHttpRequestTracker('PUT' as HttpInterceptorSchemaMethod<Schema>, path);
  }) satisfies StrictHttpInterceptorMethodHandler<
    Schema,
    HttpInterceptorSchemaMethod<Schema>
  > as HttpInterceptorMethodHandler<Schema, 'PUT'>;

  delete: HttpInterceptorMethodHandler<Schema, 'DELETE'> = ((path) => {
    return this.prepareHttpRequestTracker('DELETE' as HttpInterceptorSchemaMethod<Schema>, path);
  }) satisfies StrictHttpInterceptorMethodHandler<
    Schema,
    HttpInterceptorSchemaMethod<Schema>
  > as HttpInterceptorMethodHandler<Schema, 'DELETE'>;

  head: HttpInterceptorMethodHandler<Schema, 'HEAD'> = ((path) => {
    return this.prepareHttpRequestTracker('HEAD' as HttpInterceptorSchemaMethod<Schema>, path);
  }) satisfies StrictHttpInterceptorMethodHandler<
    Schema,
    HttpInterceptorSchemaMethod<Schema>
  > as HttpInterceptorMethodHandler<Schema, 'HEAD'>;

  options: HttpInterceptorMethodHandler<Schema, 'OPTIONS'> = ((path) => {
    return this.prepareHttpRequestTracker('OPTIONS' as HttpInterceptorSchemaMethod<Schema>, path);
  }) satisfies StrictHttpInterceptorMethodHandler<
    Schema,
    HttpInterceptorSchemaMethod<Schema>
  > as HttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  private prepareHttpRequestTracker<
    Method extends HttpInterceptorSchemaMethod<Schema>,
    Path extends HttpInterceptorSchemaPath<Schema, Method>,
  >(method: Method, path: Path) {
    const tracker = new HttpRequestTracker<Default<Schema[Path][Method]>>();

    const methodPathTrackers = this.trackersByMethod[method].get(path) ?? [];
    methodPathTrackers.push(tracker);

    if (!this.trackersByMethod[method].has(path)) {
      this.trackersByMethod[method].set(path, methodPathTrackers);

      this.worker.use(method, path, async (context) => {
        return this.handleInterceptedRequest(
          method,
          path,
          context as HttpInterceptorRequestContext<Schema, Method, Path>,
        );
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
    const methodPathTrackers = this.trackersByMethod[method].get(path) ?? [];
    const requestWithParsedBody = await this.parseRawRequest(request);

    const matchedTracker = methodPathTrackers.findLast((tracker) => {
      return tracker.matchesRequest(requestWithParsedBody);
    });

    if (matchedTracker) {
      const response = await matchedTracker.createResponse(requestWithParsedBody);
      return response;
    } else {
      return { bypass: true };
    }
  };

  private async parseRawRequest<
    Method extends HttpInterceptorSchemaMethod<Schema>,
    Path extends HttpInterceptorSchemaPath<Schema, Method>,
    Context extends HttpInterceptorRequestContext<Schema, Method, Path>,
  >(request: Context['request']) {
    type MethodSchema = Default<Schema[Path][Method]>;
    type MethodHttpInterceptorRequest = HttpInterceptorRequest<MethodSchema>;

    const parsedBody = await this.parseRawRequestBody(request);

    const proxyRequest = new Proxy(request as unknown as MethodHttpInterceptorRequest, {
      get(target, property, receiver) {
        if (property === 'body') {
          return parsedBody;
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    });

    return proxyRequest;
  }

  private async parseRawRequestBody<
    Method extends HttpInterceptorSchemaMethod<Schema>,
    Path extends HttpInterceptorSchemaPath<Schema, Method>,
    Context extends HttpInterceptorRequestContext<Schema, Method, Path>,
  >(request: Context['request']) {
    const bodyAsText = await request.text();

    try {
      const jsonParsedBody = JSON.parse(bodyAsText) as Context['request']['body'];
      return jsonParsedBody;
    } catch {
      return bodyAsText;
    }
  }
}

export default HttpInterceptor;
