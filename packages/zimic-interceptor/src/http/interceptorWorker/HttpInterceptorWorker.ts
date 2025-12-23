import {
  HttpHeadersInit,
  HttpHeaders,
  HttpBody,
  HttpResponse,
  HttpMethod,
  HttpMethodSchema,
  HttpSchema,
  HttpStatusCode,
  InferPathParams,
  parseHttpBody,
  HttpSearchParams,
  HttpRequest,
} from '@zimic/http';
import isDefined from '@zimic/utils/data/isDefined';
import { Default, PossiblePromise } from '@zimic/utils/types';
import color from 'picocolors';

import { removeArrayElement } from '@/utils/arrays';
import { isClientSide } from '@/utils/environment';
import { methodCanHaveResponseBody } from '@/utils/http';
import { formatValueToLog, logger } from '@/utils/logging';

import HttpInterceptorClient, { AnyHttpInterceptorClient } from '../interceptor/HttpInterceptorClient';
import { HttpInterceptorPlatform, HttpInterceptorType, UnhandledRequestStrategy } from '../interceptor/types/options';
import {
  UnhandledHttpInterceptorRequestPath,
  UnhandledHttpInterceptorRequestMethodSchema,
} from '../interceptor/types/requests';
import {
  HTTP_INTERCEPTOR_REQUEST_HIDDEN_PROPERTIES,
  HTTP_INTERCEPTOR_RESPONSE_HIDDEN_PROPERTIES,
  HttpInterceptorRequest,
  HttpInterceptorResponse,
} from '../requestHandler/types/requests';
import { DEFAULT_UNHANDLED_REQUEST_STRATEGY } from './constants';
import { HttpResponseFactory } from './types/http';
import { HttpInterceptorWorkerType } from './types/options';

const RESPONSE_ACTION_SYMBOL = Symbol.for('HttpResponse.action');

abstract class HttpInterceptorWorker {
  abstract get type(): HttpInterceptorWorkerType;

  platform: HttpInterceptorPlatform | null = null;
  isRunning = false;

  private startingPromise?: Promise<void>;
  private stoppingPromise?: Promise<void>;

  private runningInterceptors: AnyHttpInterceptorClient[] = [];

  abstract start(): Promise<void>;

  protected async sharedStart(internalStart: () => Promise<void>) {
    if (this.isRunning) {
      return;
    }

    if (this.startingPromise) {
      return this.startingPromise;
    }

    try {
      this.startingPromise = internalStart();
      await this.startingPromise;

      this.startingPromise = undefined;
    } catch (error) {
      // In server side (e.g. Node.js), we need to manually log the error because this will be treated as an unhandled
      // promise rejection. If we don't log it, the output won't contain details about the error. In the browser,
      // uncaught promise rejections are automatically logged.
      if (!isClientSide()) {
        console.error(error);
      }

      await this.stop();
      throw error;
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

    if (stoppingResult instanceof Promise) {
      this.stoppingPromise = stoppingResult;
      await this.stoppingPromise;
    }

    this.stoppingPromise = undefined;
  }

  abstract use<Schema extends HttpSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    path: string,
    createResponse: HttpResponseFactory,
  ): PossiblePromise<void>;

  protected async logUnhandledRequestIfNecessary(
    request: Request,
    strategy: UnhandledRequestStrategy.Declaration | null,
  ) {
    if (strategy?.log) {
      await HttpInterceptorWorker.logUnhandledRequestWarning(request, strategy.action);
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

  registerRunningInterceptor(interceptor: AnyHttpInterceptorClient) {
    this.runningInterceptors.push(interceptor);
  }

  unregisterRunningInterceptor(interceptor: AnyHttpInterceptorClient) {
    removeArrayElement(this.runningInterceptors, interceptor);
  }

  private findInterceptorByRequestBaseURL(request: Request) {
    const interceptor = this.runningInterceptors.findLast((interceptor) => {
      return request.url.startsWith(interceptor.baseURLAsString);
    });

    return interceptor;
  }

  private async getInterceptorUnhandledRequestStrategy(request: Request, interceptor: AnyHttpInterceptorClient) {
    if (typeof interceptor.onUnhandledRequest === 'function') {
      const parsedRequest = await HttpInterceptorWorker.parseRawUnhandledRequest(request);
      return interceptor.onUnhandledRequest(parsedRequest);
    }

    return interceptor.onUnhandledRequest;
  }

  abstract clearHandlers<Schema extends HttpSchema>(options?: {
    interceptor?: HttpInterceptorClient<Schema>;
  }): PossiblePromise<void>;

  abstract get interceptorsWithHandlers(): AnyHttpInterceptorClient[];

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
      | { status: number; headers?: HttpHeadersInit; body?: HttpBody }
      | { action: UnhandledRequestStrategy.Action },
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

  static async logUnhandledRequestWarning(rawRequest: Request, action: UnhandledRequestStrategy.Action) {
    const request = await this.parseRawRequest(rawRequest);

    const [formattedHeaders, formattedSearchParams, formattedBody] = await Promise.all([
      formatValueToLog(request.headers.toObject()),
      formatValueToLog(request.searchParams.toObject()),
      formatValueToLog(request.body),
    ]);

    logger[action === 'bypass' ? 'warn' : 'error'](
      `${action === 'bypass' ? 'Warning:' : 'Error:'} Request was not handled and was ` +
        `${action === 'bypass' ? color.yellow('bypassed') : color.red('rejected')}.\n\n `,
      `${request.method} ${request.url}`,
      '\n    Headers:',
      formattedHeaders,
      '\n    Search params:',
      formattedSearchParams,
      '\n    Body:',
      formattedBody,
      '\n\nLearn more: https://zimic.dev/docs/interceptor/guides/http/unhandled-requests',
    );
  }
}

export default HttpInterceptorWorker;
