import {
  HTTP_METHODS,
  HttpHeadersInit,
  HttpHeaders,
  HttpBody,
  HttpResponse,
  HttpMethod,
  HttpMethodSchema,
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpStatusCode,
  InferPathParams,
  parseHttpBody,
  HttpSearchParams,
  HttpRequest,
} from '@zimic/http';
import { isDefined } from '@zimic/utils/data';
import { Default, PossiblePromise } from '@zimic/utils/types';
import { createRegexFromPath, excludeNonPathParams, validatePathParams } from '@zimic/utils/url';

import { removeArrayElement } from '@/utils/arrays';
import { isClientSide } from '@/utils/environment';
import { methodCanHaveResponseBody } from '@/utils/http';
import { logUnhandledRequestWarning, logger } from '@/utils/logging';
import { isURLUnderBaseURL } from '@/utils/urls';

import NotRunningHttpInterceptorError from '../interceptor/errors/NotRunningHttpInterceptorError';
import HttpInterceptorImplementation, {
  AnyHttpInterceptorImplementation,
} from '../interceptor/HttpInterceptorImplementation';
import { HttpInterceptorPlatform, HttpInterceptorType, UnhandledRequestStrategy } from '../interceptor/types/options';
import {
  UnhandledHttpInterceptorRequestPath,
  UnhandledHttpInterceptorRequestMethodSchema,
} from '../interceptor/types/requests';
import HttpRequestHandlerImplementation, {
  AnyHttpRequestHandlerImplementation,
  HttpRequestHandlerRequestMatch,
} from '../requestHandler/HttpRequestHandlerImplementation';
import {
  HTTP_INTERCEPTOR_REQUEST_HIDDEN_PROPERTIES,
  HTTP_INTERCEPTOR_RESPONSE_HIDDEN_PROPERTIES,
  HttpInterceptorRequest,
  HttpInterceptorResponse,
} from '../requestHandler/types/requests';
import { DEFAULT_UNHANDLED_REQUEST_STRATEGY } from './constants';
import { HttpInterceptorWorkerType } from './types/options';

const RESPONSE_ACTION_SYMBOL = Symbol.for('HttpResponse.action');

interface HttpHandler {
  interceptor: AnyHttpInterceptorImplementation;
  implementation: AnyHttpRequestHandlerImplementation;
  pathRegex: RegExp;
}

interface FailedHttpRequestMatch {
  handler: HttpHandler;
  request: HttpInterceptorRequest<string, HttpMethodSchema>;
  requestMatch: Extract<HttpRequestHandlerRequestMatch, { success: false }>;
}

interface HttpRequestHandling {
  response: HttpResponse | null;
  matchedSomeHandler: boolean;
  error?: boolean;
}

abstract class HttpInterceptorWorker {
  abstract get type(): HttpInterceptorWorkerType;

  platform: HttpInterceptorPlatform | null = null;
  isRunning = false;

  private startingPromise?: Promise<void>;
  private stoppingPromise?: Promise<void>;

  protected runningInterceptors: AnyHttpInterceptorImplementation[] = [];

  private httpHandlersByMethod: {
    [Method in HttpMethod]: HttpHandler[];
  } = {
    GET: [],
    POST: [],
    PATCH: [],
    PUT: [],
    DELETE: [],
    HEAD: [],
    OPTIONS: [],
  };

  get numberOfRunningInterceptors() {
    return this.runningInterceptors.length;
  }

  abstract start(): Promise<void>;

  protected async sharedStart(internalStart: () => Promise<void>) {
    if (this.stoppingPromise) {
      await this.stoppingPromise;
    }

    if (this.isRunning) {
      return;
    }

    if (this.startingPromise) {
      return this.startingPromise;
    }

    try {
      this.startingPromise = internalStart();
      await this.startingPromise;
    } catch (error) {
      // In server side (e.g. Node.js), we need to manually log the error because this will be treated as an unhandled
      // promise rejection. If we don't log it, the output won't contain details about the error. In the browser,
      // uncaught promise rejections are automatically logged.
      if (!isClientSide()) {
        console.error(error);
      }

      await this.stop();
      throw error;
    } finally {
      this.startingPromise = undefined;
    }
  }

  abstract stop(): Promise<void>;

  protected async sharedStop(internalStop: () => PossiblePromise<void>) {
    if (!this.isRunning) {
      return;
    }

    if (this.stoppingPromise) {
      return this.stoppingPromise;
    }

    const stoppingResult = internalStop();

    /* istanbul ignore next -- @preserve
     * This if statement only runs if concurrent calls to stop() are made, which is an edge case that is hard to
     * reliably reproduce in tests. */
    if (stoppingResult instanceof Promise) {
      this.stoppingPromise = stoppingResult;

      try {
        await this.stoppingPromise;
      } finally {
        this.stoppingPromise = undefined;
      }
    }
  }

  use<
    Schema extends HttpSchema,
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath<Schema, Method>,
    StatusCode extends HttpStatusCode,
  >(
    interceptor: HttpInterceptorImplementation<Schema>,
    handler: HttpRequestHandlerImplementation<Schema, Method, Path, StatusCode>,
  ) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    validatePathParams(handler.path);

    this.httpHandlersByMethod[handler.method].push({
      interceptor,
      implementation: handler,
      pathRegex: createRegexFromPath(handler.path),
    });
  }

  protected clearHttpHandlers<Schema extends HttpSchema>(
    interceptor: HttpInterceptorImplementation<Schema> | undefined,
  ) {
    for (const method of HTTP_METHODS) {
      this.httpHandlersByMethod[method] =
        interceptor === undefined
          ? []
          : this.httpHandlersByMethod[method].filter((handler) => handler.interceptor !== interceptor);
    }
  }

  // The handlers of all interceptors in the worker are tried together, from the last created to the first, so a newer
  // handler wins regardless of the start order of its interceptor or the path it was declared with.
  protected async createResponseWithHandlers(request: HttpRequest): Promise<HttpRequestHandling> {
    const requestURL = excludeNonPathParams(new URL(request.url));
    const requestURLAsString = requestURL.href === `${requestURL.origin}/` ? requestURL.origin : requestURL.href;

    const failedRequestMatches: FailedHttpRequestMatch[] = [];
    let matchedSomeHandler = false;

    const parsedRequestsByRoute = new Map<string, HttpInterceptorRequest<string, HttpMethodSchema>>();

    const method = request.method as HttpMethod;
    const methodHandlers = this.httpHandlersByMethod[method];

    // Handlers can be added or cleared while a response is created, so the request is matched against a copy.
    for (const handler of methodHandlers.toReversed()) {
      if (!this.matchesHandlerRoute(requestURLAsString, handler)) {
        continue;
      }

      matchedSomeHandler = true;

      try {
        const parsedRequest = await this.parseRequestForHandlerRoute(request, handler, parsedRequestsByRoute);

        const requestMatch = await handler.implementation.matchesRequest(parsedRequest);

        if (requestMatch.success) {
          // An asynchronous match can outlive a clear, after which the handler does not handle the request, even if
          // redeclared. Older handlers are not tried.
          if (!this.isHandlerRegistered(method, handler)) {
            return { response: null, matchedSomeHandler };
          }

          handler.implementation.markRequestAsMatched(parsedRequest);

          const response = await handler.interceptor.handleMatchedRequest(
            handler.implementation,
            request,
            parsedRequest,
          );

          return { response, matchedSomeHandler };
        }

        failedRequestMatches.push({ handler, request: parsedRequest, requestMatch });
      } catch (error) {
        console.error(error);

        // A handler that threw may have already counted the request, such as toward its `times` limit, so older
        // handlers are not tried.
        return { response: null, matchedSomeHandler, error: true };
      }
    }

    this.markRequestAsUnhandled(failedRequestMatches);

    return { response: null, matchedSomeHandler };
  }

  // Parsing clones the request and reads its body, and the parsed path params depend only on the base URL and path of
  // the handler, so handlers on the same route share one parsed request.
  private async parseRequestForHandlerRoute(
    request: HttpRequest,
    handler: HttpHandler,
    parsedRequestsByRoute: Map<string, HttpInterceptorRequest<string, HttpMethodSchema>>,
  ) {
    const baseURL = handler.interceptor.baseURLAsString;
    const routeKey = JSON.stringify([baseURL, handler.implementation.path]);

    const cachedParsedRequest = parsedRequestsByRoute.get(routeKey);

    if (cachedParsedRequest) {
      return cachedParsedRequest;
    }

    const parsedRequest = await HttpInterceptorWorker.parseRawRequest(request, {
      baseURL,
      pathRegex: handler.pathRegex,
    });

    parsedRequestsByRoute.set(routeKey, parsedRequest);

    return parsedRequest;
  }

  // Clearing removes the entries of a handler, and redeclaring it registers a new entry.
  private isHandlerRegistered(method: HttpMethod, handler: HttpHandler) {
    return this.httpHandlersByMethod[method].includes(handler);
  }

  private matchesHandlerRoute(requestURL: string, handler: HttpHandler) {
    const baseURL = handler.interceptor.baseURLAsString;

    if (!isURLUnderBaseURL(requestURL, baseURL)) {
      return false;
    }

    const requestPath = requestURL.replace(baseURL, '');
    return handler.pathRegex.test(requestPath);
  }

  // Handlers that failed only on restrictions record their diffs. The newest handler that failed for any other cause,
  // such as exceeding its `times` limit, is still marked as matched to trigger a times check error.
  private markRequestAsUnhandled(failedRequestMatches: FailedHttpRequestMatch[]) {
    for (const { handler, request, requestMatch } of failedRequestMatches) {
      if (requestMatch.cause === 'unmatchedRestrictions') {
        handler.implementation.markRequestAsUnmatched(request, { diff: requestMatch.diff });
      } else {
        handler.implementation.markRequestAsMatched(request);
        break;
      }
    }
  }

  protected async logUnhandledRequestIfNecessary(
    request: Request,
    strategy: UnhandledRequestStrategy.Declaration | null,
  ) {
    if (strategy?.log) {
      await logUnhandledRequestWarning(request, strategy.action);
      return { wasLogged: true };
    }
    return { wasLogged: false };
  }

  protected async getUnhandledRequestStrategy(request: Request, interceptorType: HttpInterceptorType) {
    const candidates = await this.getUnhandledRequestStrategyCandidates(request, interceptorType);
    const strategy = this.reduceUnhandledRequestStrategyCandidates(candidates);
    return strategy;
  }

  private reduceUnhandledRequestStrategyCandidates(candidateStrategies: UnhandledRequestStrategy.Declaration[]) {
    if (candidateStrategies.length === 0) {
      return null;
    }

    // Prefer strategies from first to last, overriding undefined values with the next candidate.
    return candidateStrategies.reduce(
      (accumulatedStrategy, candidateStrategy): UnhandledRequestStrategy.Declaration => ({
        action: accumulatedStrategy.action,
        log: accumulatedStrategy.log ?? candidateStrategy.log,
      }),
    );
  }

  private async getUnhandledRequestStrategyCandidates(
    request: Request,
    interceptorType: HttpInterceptorType,
  ): Promise<UnhandledRequestStrategy.Declaration[]> {
    const globalDefaultStrategy = DEFAULT_UNHANDLED_REQUEST_STRATEGY[interceptorType];

    try {
      const interceptor = this.findInterceptorByRequestBaseURL(request);

      if (!interceptor) {
        return [];
      }

      const requestClone = request.clone();
      const interceptorStrategy = await this.getInterceptorUnhandledRequestStrategy(requestClone, interceptor);

      return [interceptorStrategy, globalDefaultStrategy].filter(isDefined);
    } catch (error) {
      console.error(error);

      return [globalDefaultStrategy];
    }
  }

  registerRunningInterceptor(interceptor: AnyHttpInterceptorImplementation): PossiblePromise<void> {
    this.runningInterceptors.push(interceptor);
  }

  unregisterRunningInterceptor(interceptor: AnyHttpInterceptorImplementation): PossiblePromise<void> {
    removeArrayElement(this.runningInterceptors, interceptor);
  }

  private findInterceptorByRequestBaseURL(request: Request) {
    const interceptor = this.runningInterceptors.findLast((interceptor) => {
      return isURLUnderBaseURL(request.url, interceptor.baseURLAsString);
    });

    return interceptor;
  }

  private async getInterceptorUnhandledRequestStrategy(
    request: Request,
    interceptor: AnyHttpInterceptorImplementation,
  ) {
    if (typeof interceptor.onUnhandledRequest === 'function') {
      const parsedRequest = await HttpInterceptorWorker.parseRawUnhandledRequest(request);
      return interceptor.onUnhandledRequest(parsedRequest);
    }

    return interceptor.onUnhandledRequest;
  }

  abstract clearHandlers<Schema extends HttpSchema>(options?: {
    interceptor?: HttpInterceptorImplementation<Schema>;
  }): void;

  static setResponseAction(response: Response, action: UnhandledRequestStrategy.Action) {
    Object.defineProperty(response, RESPONSE_ACTION_SYMBOL, {
      value: action,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }

  static getResponseAction(response: Response): UnhandledRequestStrategy.Action | undefined {
    if (!(RESPONSE_ACTION_SYMBOL in response)) {
      return undefined;
    }

    const action = response[RESPONSE_ACTION_SYMBOL];

    /* istanbul ignore if -- @preserve
     * This is just a type guard to ensure the value is valid. In practice, this condition should never be true. */
    if (action !== 'bypass' && action !== 'reject') {
      return undefined;
    }

    return action;
  }

  private createBypassedResponse() {
    const response = Response.redirect('about:blank', 302) as HttpResponse;
    HttpInterceptorWorker.setResponseAction(response, 'bypass');
    return response;
  }

  static isBypassedResponse(response: Response) {
    return this.getResponseAction(response) === 'bypass';
  }

  private createRejectedResponse() {
    const response = Response.error() as HttpResponse;
    HttpInterceptorWorker.setResponseAction(response, 'reject');
    return response;
  }

  static isRejectedResponse(response: Response) {
    return this.getResponseAction(response) === 'reject';
  }

  createResponseFromDeclaration(
    request: HttpRequest,
    declaration:
      { status: number; headers?: HttpHeadersInit; body?: HttpBody } | { action: UnhandledRequestStrategy.Action },
  ): PossiblePromise<HttpResponse | null> {
    if ('action' in declaration) {
      if (declaration.action === 'bypass') {
        return this.createBypassedResponse();
      } else {
        return this.createRejectedResponse();
      }
    }

    const headers = new HttpHeaders(declaration.headers);

    const canHaveBody = methodCanHaveResponseBody(request.method as HttpMethod) && declaration.status !== 204;

    if (!canHaveBody) {
      return new Response(null, { headers, status: declaration.status }) as HttpResponse;
    }

    if (
      typeof declaration.body === 'string' ||
      declaration.body === null ||
      declaration.body === undefined ||
      declaration.body instanceof FormData ||
      declaration.body instanceof URLSearchParams ||
      declaration.body instanceof Blob ||
      declaration.body instanceof ArrayBuffer ||
      declaration.body instanceof ReadableStream
    ) {
      return new Response(declaration.body ?? null, { headers, status: declaration.status }) as HttpResponse;
    }

    return Response.json(declaration.body, { headers, status: declaration.status }) as HttpResponse;
  }

  static async parseRawUnhandledRequest(request: Request) {
    return this.parseRawRequest<UnhandledHttpInterceptorRequestPath, UnhandledHttpInterceptorRequestMethodSchema>(
      request,
    );
  }

  static async parseRawRequest<Path extends string, MethodSchema extends HttpMethodSchema>(
    originalRawRequest: Request,
    options?: { baseURL: string; pathRegex: RegExp },
  ): Promise<HttpInterceptorRequest<Path, MethodSchema>> {
    const rawRequest = originalRawRequest.clone();
    const rawRequestClone = rawRequest.clone();

    type BodySchema = Default<Default<MethodSchema['request']>['body']>;

    const parsedBody = await parseHttpBody<BodySchema>(rawRequest).catch((error: unknown) => {
      logger.error('Failed to parse request body:', error);
      return null;
    });

    type HeadersSchema = Default<Default<MethodSchema['request']>['headers']>;
    const headers = new HttpHeaders<HeadersSchema>(rawRequest.headers);

    const pathParams = this.parseRawPathParams<Path>(rawRequest, options);

    const parsedURL = new URL(rawRequest.url);
    type SearchParamsSchema = Default<Default<MethodSchema['request']>['searchParams']>;
    const searchParams = new HttpSearchParams<SearchParamsSchema>(parsedURL.searchParams);

    const parsedRequest = new Proxy(rawRequest as unknown as HttpInterceptorRequest<Path, MethodSchema>, {
      has(target, property: keyof HttpInterceptorRequest<Path, MethodSchema>) {
        if (HttpInterceptorWorker.isHiddenRequestProperty(property)) {
          return false;
        }
        return Reflect.has(target, property);
      },

      get(target, property: keyof HttpInterceptorRequest<Path, MethodSchema>) {
        if (HttpInterceptorWorker.isHiddenRequestProperty(property)) {
          return undefined;
        }
        return Reflect.get(target, property, target) as unknown;
      },
    });

    Object.defineProperty(parsedRequest, 'body', {
      value: parsedBody,
      enumerable: true,
      configurable: false,
      writable: false,
    });

    Object.defineProperty(parsedRequest, 'headers', {
      value: headers,
      enumerable: true,
      configurable: false,
      writable: false,
    });

    Object.defineProperty(parsedRequest, 'pathParams', {
      value: pathParams,
      enumerable: true,
      configurable: false,
      writable: false,
    });

    Object.defineProperty(parsedRequest, 'searchParams', {
      value: searchParams,
      enumerable: true,
      configurable: false,
      writable: false,
    });

    Object.defineProperty(parsedRequest, 'raw', {
      value: rawRequestClone,
      enumerable: true,
      configurable: false,
      writable: false,
    });

    return parsedRequest;
  }

  private static isHiddenRequestProperty(property: string) {
    return HTTP_INTERCEPTOR_REQUEST_HIDDEN_PROPERTIES.has(property as never);
  }

  static async parseRawResponse<
    MethodSchema extends HttpMethodSchema,
    StatusCode extends HttpStatusCode = HttpStatusCode,
  >(originalRawResponse: Response): Promise<HttpInterceptorResponse<MethodSchema, StatusCode>> {
    const rawResponse = originalRawResponse.clone();
    const rawResponseClone = rawResponse.clone();

    type BodySchema = Default<Default<Default<MethodSchema['response']>[StatusCode]>['body']>;
    const parsedBody = await parseHttpBody<BodySchema>(rawResponse).catch((error: unknown) => {
      logger.error('Failed to parse response body:', error);
      return null;
    });

    type HeadersSchema = Default<Default<Default<MethodSchema['response']>[StatusCode]>['headers']>;
    const headers = new HttpHeaders<HeadersSchema>(rawResponse.headers);

    const parsedRequest = new Proxy(rawResponse as unknown as HttpInterceptorResponse<MethodSchema, StatusCode>, {
      has(target, property: keyof HttpInterceptorResponse<MethodSchema, StatusCode>) {
        if (HttpInterceptorWorker.isHiddenResponseProperty(property)) {
          return false;
        }
        return Reflect.has(target, property);
      },

      get(target, property: keyof HttpInterceptorResponse<MethodSchema, StatusCode>) {
        if (HttpInterceptorWorker.isHiddenResponseProperty(property)) {
          return undefined;
        }
        return Reflect.get(target, property, target) as unknown;
      },
    });

    Object.defineProperty(parsedRequest, 'body', {
      value: parsedBody,
      enumerable: true,
      configurable: false,
      writable: false,
    });

    Object.defineProperty(parsedRequest, 'headers', {
      value: headers,
      enumerable: true,
      configurable: false,
      writable: false,
    });

    Object.defineProperty(parsedRequest, 'raw', {
      value: rawResponseClone,
      enumerable: true,
      configurable: false,
      writable: false,
    });

    return parsedRequest;
  }

  private static isHiddenResponseProperty(property: string) {
    return HTTP_INTERCEPTOR_RESPONSE_HIDDEN_PROPERTIES.has(property as never);
  }

  static parseRawPathParams<Path extends string>(
    request: Request,
    options?: { baseURL: string; pathRegex: RegExp },
  ): InferPathParams<Path> {
    const requestPath = request.url.replace(options?.baseURL ?? '', '');
    const paramsMatch = options?.pathRegex.exec(requestPath);

    const params: Record<string, string | undefined> = {};

    for (const [paramName, paramValue] of Object.entries(paramsMatch?.groups ?? {})) {
      params[paramName] = typeof paramValue === 'string' ? decodeURIComponent(paramValue) : undefined;
    }

    return params as InferPathParams<Path>;
  }
}

export default HttpInterceptorWorker;
