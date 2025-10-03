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
  HttpFormData,
  HttpSearchParams,
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
import InvalidFormDataError from './errors/InvalidFormDataError';
import InvalidJSONError from './errors/InvalidJSONError';
import { MSWHttpResponseFactory } from './types/msw';
import { HttpInterceptorWorkerType } from './types/options';

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
    createResponse: MSWHttpResponseFactory,
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

  abstract clearHandlers(): PossiblePromise<void>;

  abstract clearInterceptorHandlers<Schema extends HttpSchema>(
    interceptor: HttpInterceptorClient<Schema>,
  ): PossiblePromise<void>;

  abstract get interceptorsWithHandlers(): AnyHttpInterceptorClient[];

  static createResponseFromDeclaration(
    request: Request,
    declaration: { status: number; headers?: HttpHeadersInit; body?: HttpBody },
  ): HttpResponse {
    const headers = new HttpHeaders(declaration.headers);
    const status = declaration.status;

    const canHaveBody = methodCanHaveResponseBody(request.method as HttpMethod) && status !== 204;

    if (!canHaveBody) {
      return new Response(null, { headers, status }) as HttpResponse;
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
      return new Response(declaration.body ?? null, { headers, status }) as HttpResponse;
    }

    return Response.json(declaration.body, { headers, status }) as HttpResponse;
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
    const parsedBody = await this.parseRawBody<BodySchema>(rawRequest);

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

  static async parseRawResponse<MethodSchema extends HttpMethodSchema, StatusCode extends HttpStatusCode>(
    originalRawResponse: Response,
  ): Promise<HttpInterceptorResponse<MethodSchema, StatusCode>> {
    const rawResponse = originalRawResponse.clone();
    const rawResponseClone = rawResponse.clone();

    type BodySchema = Default<Default<Default<MethodSchema['response']>[StatusCode]>['body']>;
    const parsedBody = await this.parseRawBody<BodySchema>(rawResponse);

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

  static async parseRawBody<Body extends HttpBody>(resource: Request | Response) {
    const contentType = resource.headers.get('content-type');

    try {
      if (contentType) {
        if (contentType.startsWith('application/json')) {
          return await this.parseRawBodyAsJSON<Body>(resource);
        }
        if (contentType.startsWith('multipart/form-data')) {
          return await this.parseRawBodyAsFormData<Body>(resource);
        }
        if (contentType.startsWith('application/x-www-form-urlencoded')) {
          return await this.parseRawBodyAsSearchParams<Body>(resource);
        }
        if (contentType.startsWith('text/') || contentType.startsWith('application/xml')) {
          return await this.parseRawBodyAsText<Body>(resource);
        }
        if (
          contentType.startsWith('application/') ||
          contentType.startsWith('image/') ||
          contentType.startsWith('audio/') ||
          contentType.startsWith('font/') ||
          contentType.startsWith('video/') ||
          contentType.startsWith('multipart/')
        ) {
          return await this.parseRawBodyAsBlob<Body>(resource);
        }
      }

      const resourceClone = resource.clone();

      try {
        return await this.parseRawBodyAsJSON<Body>(resource);
      } catch {
        return await this.parseRawBodyAsBlob<Body>(resourceClone);
      }
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  private static async parseRawBodyAsJSON<Body extends HttpBody>(resource: Request | Response) {
    const bodyAsText = await resource.text();

    if (!bodyAsText.trim()) {
      return null;
    }

    try {
      const bodyAsJSON = JSON.parse(bodyAsText) as Body;
      return bodyAsJSON;
    } catch {
      throw new InvalidJSONError(bodyAsText);
    }
  }

  private static async parseRawBodyAsSearchParams<Body extends HttpBody>(resource: Request | Response) {
    const bodyAsText = await resource.text();

    if (!bodyAsText.trim()) {
      return null;
    }

    const bodyAsSearchParams = new HttpSearchParams(bodyAsText);
    return bodyAsSearchParams as Body;
  }

  private static async parseRawBodyAsFormData<Body extends HttpBody>(resource: Request | Response) {
    const resourceClone = resource.clone();

    try {
      const bodyAsRawFormData = await resource.formData();

      const bodyAsFormData = new HttpFormData();
      for (const [key, value] of bodyAsRawFormData) {
        bodyAsFormData.append(key, value as string);
      }

      return bodyAsFormData as Body;
    } catch {
      const bodyAsText = await resourceClone.text();

      if (!bodyAsText.trim()) {
        return null;
      }

      throw new InvalidFormDataError(bodyAsText);
    }
  }

  private static async parseRawBodyAsBlob<Body extends HttpBody>(resource: Request | Response) {
    const bodyAsBlob = await resource.blob();
    return bodyAsBlob as Body;
  }

  private static async parseRawBodyAsText<Body extends HttpBody>(resource: Request | Response) {
    const bodyAsText = await resource.text();
    return (bodyAsText || null) as Body;
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
