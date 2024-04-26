import {
  HTTP_METHODS,
  HttpMethod,
  HttpServiceResponseSchemaStatusCode,
  HttpServiceSchema,
  HttpServiceSchemaMethod,
  HttpServiceSchemaPath,
} from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';
import { AsyncCommitOptions, registerMultipleCommitCallback } from '@/utils/async';
import { joinURL } from '@/utils/fetch';

import HttpInterceptorWorker from '../interceptorWorker/HttpInterceptorWorker';
import { HttpResponseFactoryResult } from '../interceptorWorker/types/requests';
import HttpRequestTrackerClient, { AnyHttpRequestTrackerClient } from '../requestTracker/HttpRequestTrackerClient';
import LocalHttpRequestTracker from '../requestTracker/LocalHttpRequestTracker';
import RemoteHttpRequestTracker from '../requestTracker/RemoteHttpRequestTracker';
import { PublicHttpRequestTracker } from '../requestTracker/types/public';
import { HttpInterceptorRequest } from '../requestTracker/types/requests';
import { HttpInterceptorRequestContext } from './types/requests';

class HttpInterceptorClient<
  Schema extends HttpServiceSchema,
  TrackerConstructor extends HttpRequestTrackerConstructor = HttpRequestTrackerConstructor,
> {
  private worker: HttpInterceptorWorker;
  private _baseURL: URL;

  private Tracker: TrackerConstructor;

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

  constructor(options: { worker: HttpInterceptorWorker; baseURL: string; Tracker: TrackerConstructor }) {
    this.worker = options.worker;
    this._baseURL = new URL(options.baseURL);
    this.Tracker = options.Tracker;
  }

  baseURL() {
    return this._baseURL.toString();
  }

  get(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestTracker('GET' as HttpServiceSchemaMethod<Schema>, path);
  }

  post(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestTracker('POST' as HttpServiceSchemaMethod<Schema>, path);
  }

  patch(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestTracker('PATCH' as HttpServiceSchemaMethod<Schema>, path);
  }

  put(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestTracker('PUT' as HttpServiceSchemaMethod<Schema>, path);
  }

  delete(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestTracker('DELETE' as HttpServiceSchemaMethod<Schema>, path);
  }

  head(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestTracker('HEAD' as HttpServiceSchemaMethod<Schema>, path);
  }

  options(path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) {
    return this.createHttpRequestTracker('OPTIONS' as HttpServiceSchemaMethod<Schema>, path);
  }

  private createHttpRequestTracker<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
  >(method: Method, path: Path): PublicHttpRequestTracker<Schema, Method, Path> {
    const tracker = new this.Tracker<Schema, Method, Path>(this as SharedHttpInterceptorClient<Schema>, method, path);
    this.registerRequestTracker(tracker.client());
    return tracker;
  }

  registerRequestTracker<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
    StatusCode extends HttpServiceResponseSchemaStatusCode<Default<Default<Schema[Path][Method]>['response']>> = never,
  >(tracker: HttpRequestTrackerClient<Schema, Method, Path, StatusCode>) {
    const methodPathTrackers = this.trackersByMethod[tracker.method()].get(tracker.path()) ?? [];
    if (!methodPathTrackers.includes(tracker)) {
      methodPathTrackers.push(tracker);
    }

    const isFirstTrackerForMethodPath = methodPathTrackers.length === 1;
    if (!isFirstTrackerForMethodPath) {
      return;
    }

    this.trackersByMethod[tracker.method()].set(tracker.path(), methodPathTrackers);
    const pathWithBaseURL = joinURL(this.baseURL(), tracker.path());

    const registrationResult = this.worker.use(this, tracker.method(), pathWithBaseURL, async (context) => {
      const response = await this.handleInterceptedRequest(
        tracker.method(),
        tracker.path(),
        context as HttpInterceptorRequestContext<Schema, Method, Path>,
      );
      return response;
    });

    if (tracker instanceof RemoteHttpRequestTracker && registrationResult instanceof Promise) {
      tracker.registerSyncPromise(registrationResult);
    }
  }

  private async handleInterceptedRequest<
    Method extends HttpServiceSchemaMethod<Schema>,
    Path extends HttpServiceSchemaPath<Schema, Method>,
    Context extends HttpInterceptorRequestContext<Schema, Method, Path>,
  >(method: Method, path: Path, { request }: Context): Promise<HttpResponseFactoryResult> {
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
    const clearResults: PossiblePromise<AnyHttpRequestTrackerClient | void>[] = [];

    for (const method of HTTP_METHODS) {
      clearResults.push(...this.bypassMethodTrackers(method));
      this.trackersByMethod[method].clear();
    }

    const clearResult = this.worker.clearInterceptorHandlers(this);
    clearResults.push(clearResult);

    if (options.onCommit) {
      registerMultipleCommitCallback(clearResults, options.onCommit);
    }
  }

  private bypassMethodTrackers(method: HttpMethod) {
    const bypassResults: PossiblePromise<AnyHttpRequestTrackerClient>[] = [];

    for (const trackers of this.trackersByMethod[method].values()) {
      for (const tracker of trackers) {
        bypassResults.push(tracker.bypass());
      }
    }

    return bypassResults;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyHttpInterceptorClient = HttpInterceptorClient<any, any>;

export type HttpRequestTrackerConstructor = typeof LocalHttpRequestTracker | typeof RemoteHttpRequestTracker;

export type SharedHttpInterceptorClient<Schema extends HttpServiceSchema> = HttpInterceptorClient<
  Schema,
  typeof LocalHttpRequestTracker
> &
  HttpInterceptorClient<Schema, typeof RemoteHttpRequestTracker>;

export default HttpInterceptorClient;
