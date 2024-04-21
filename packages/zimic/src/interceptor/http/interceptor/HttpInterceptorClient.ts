import {
  HTTP_METHODS,
  HttpMethod,
  HttpServiceResponseSchemaStatusCode,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  HttpServiceSchemaPath,
} from '@/http/types/schema';
import { Default } from '@/types/utils';
import { AsyncCommitOptions, registerCommitCallback, registerMultipleCommitCallback } from '@/utils/async';
import { joinURLPaths } from '@/utils/fetch';

import HttpInterceptorWorker from '../interceptorWorker/HttpInterceptorWorker';
import { HttpRequestHandlerResult } from '../interceptorWorker/types/requests';
import HttpRequestTrackerClient, { AnyHttpRequestTrackerClient } from '../requestTracker/HttpRequestTrackerClient';
import LocalHttpRequestTracker from '../requestTracker/LocalHttpRequestTracker';
import RemoteHttpRequestTracker from '../requestTracker/RemoteHttpRequestTracker';
import { PublicHttpRequestTracker } from '../requestTracker/types/public';
import { HttpInterceptorRequest } from '../requestTracker/types/requests';
import { HttpInterceptorRequestContext } from './types/requests';

class HttpInterceptorClient<Schema extends HttpServiceSchema> {
  private worker: HttpInterceptorWorker;
  private _baseURL: URL;

  private Tracker: typeof LocalHttpRequestTracker | typeof RemoteHttpRequestTracker;

  private trackersByMethod: {
    [Method in HttpMethod]: Map<string, AnyHttpRequestTrackerClient[]>;
  } = {
    GET: new Map(),
    POST: new Map(),
    PATCH: new Map(),
    PUT: new Map(),
    DELETE: new Map(),
    HEAD: new Map(),
    OPTIONS: new Map(),
  };

  constructor(options: {
    worker: HttpInterceptorWorker;
    baseURL: string;
    Tracker: typeof LocalHttpRequestTracker | typeof RemoteHttpRequestTracker;
  }) {
    this.worker = options.worker;
    this._baseURL = new URL(options.baseURL);
    this.Tracker = options.Tracker;
  }

  baseURL() {
    return this._baseURL.toString();
  }

  get(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>, options: AsyncCommitOptions = {}) {
    return this.createHttpRequestTracker('GET' as HttpServiceSchemaMethod<Schema>, path, options);
  }

  post(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>, options: AsyncCommitOptions = {}) {
    return this.createHttpRequestTracker('POST' as HttpServiceSchemaMethod<Schema>, path, options);
  }

  patch(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>, options: AsyncCommitOptions = {}) {
    return this.createHttpRequestTracker('PATCH' as HttpServiceSchemaMethod<Schema>, path, options);
  }

  put(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>, options: AsyncCommitOptions = {}) {
    return this.createHttpRequestTracker('PUT' as HttpServiceSchemaMethod<Schema>, path, options);
  }

  delete(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>, options: AsyncCommitOptions = {}) {
    return this.createHttpRequestTracker('DELETE' as HttpServiceSchemaMethod<Schema>, path, options);
  }

  head(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>, options: AsyncCommitOptions = {}) {
    return this.createHttpRequestTracker('HEAD' as HttpServiceSchemaMethod<Schema>, path, options);
  }

  options(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>, options: AsyncCommitOptions = {}) {
    return this.createHttpRequestTracker('OPTIONS' as HttpServiceSchemaMethod<Schema>, path, options);
  }

  private createHttpRequestTracker<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
  >(method: Method, path: Path, options: AsyncCommitOptions = {}): PublicHttpRequestTracker<Schema, Method, Path> {
    const tracker = new this.Tracker<Schema, Method, Path>(this, method, path);
    this.registerRequestTracker(tracker.client(), options);
    return tracker;
  }

  registerRequestTracker<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
    StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
  >(tracker: HttpRequestTrackerClient<Schema, Method, Path, StatusCode>, options: AsyncCommitOptions = {}) {
    const methodPathTrackers = this.trackersByMethod[tracker.method()].get(tracker.path()) ?? [];
    if (!methodPathTrackers.includes(tracker)) {
      methodPathTrackers.push(tracker);
    }

    const isFirstTrackerForMethodPath = methodPathTrackers.length === 1;
    if (!isFirstTrackerForMethodPath) {
      return;
    }

    this.trackersByMethod[tracker.method()].set(tracker.path(), methodPathTrackers);
    const pathWithBaseURL = joinURLPaths(this.baseURL(), tracker.path());

    const listenerResult = this.worker.use(this, tracker.method(), pathWithBaseURL, async (context) => {
      const response = await this.handleInterceptedRequest(
        tracker.method(),
        tracker.path(),
        context as HttpInterceptorRequestContext<Schema, Method, Path>,
      );
      return response;
    });

    if (options.onCommit) {
      registerCommitCallback(listenerResult, options.onCommit);
    }
  }

  private async handleInterceptedRequest<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
    Context extends HttpInterceptorRequestContext<Schema, Method, Path>,
  >(method: Method, path: Path, { request }: Context): Promise<HttpRequestHandlerResult> {
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
  }

  private findMatchedTracker<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
  >(
    method: Method,
    path: Path,
    parsedRequest: HttpInterceptorRequest<Default<Schema[Path][Method]>>,
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HttpRequestTrackerClient<Schema, Method, Path, any> | undefined {
    const methodPathTrackers = this.trackersByMethod[method].get(path);
    const matchedTracker = methodPathTrackers?.findLast((tracker) => tracker.matchesRequest(parsedRequest));
    return matchedTracker;
  }

  clear(options: AsyncCommitOptions = {}) {
    for (const method of HTTP_METHODS) {
      this.bypassMethodTrackers(method, options);
      this.trackersByMethod[method].clear();
    }

    const clearResult = this.worker.clearInterceptorHandlers(this);

    if (options.onCommit) {
      registerCommitCallback(clearResult, options.onCommit);
    }
  }

  private bypassMethodTrackers(method: HttpMethod, options: AsyncCommitOptions = {}) {
    const bypassResults: (Promise<AnyHttpRequestTrackerClient> | AnyHttpRequestTrackerClient)[] = [];

    for (const trackers of this.trackersByMethod[method].values()) {
      for (const tracker of trackers) {
        bypassResults.push(tracker.bypass());
      }
    }

    if (options.onCommit) {
      registerMultipleCommitCallback(bypassResults, options.onCommit);
    }
  }
}

export default HttpInterceptorClient;
