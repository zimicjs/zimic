import chalk from 'chalk';

import InvalidJSONError from '@/errors/InvalidJSONError';
import { HttpHeadersInit } from '@/http';
import InvalidFormDataError from '@/http/errors/InvalidFormDataError';
import HttpFormData from '@/http/formData/HttpFormData';
import HttpHeaders from '@/http/headers/HttpHeaders';
import { HttpBody, HttpRequest, HttpResponse } from '@/http/types/requests';
import { HttpMethod, HttpMethodSchema, HttpSchema, HttpStatusCode, InferPathParams } from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';
import { removeArrayElement } from '@/utils/arrays';
import { formatValueToLog, logWithPrefix } from '@/utils/console';
import { isDefined } from '@/utils/data';
import { isClientSide } from '@/utils/environment';
import { methodCanHaveResponseBody } from '@/utils/http';
import { createURL } from '@/utils/urls';

import HttpSearchParams from '../../../http/searchParams/HttpSearchParams';
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
import HttpInterceptorWorkerStore from './HttpInterceptorWorkerStore';
import { HttpResponseFactory } from './types/requests';

abstract class HttpInterceptorWorker {
  abstract readonly type: 'local' | 'remote';

  private _platform: HttpInterceptorPlatform | null = null;
  private _isRunning = false;
  private startingPromise?: Promise<void>;
  private stoppingPromise?: Promise<void>;

  private store = new HttpInterceptorWorkerStore();

  private runningInterceptors: AnyHttpInterceptorClient[] = [];

  platform() {
    return this._platform;
  }

  protected setPlatform(platform: HttpInterceptorPlatform) {
    this._platform = platform;
  }

  isRunning() {
    return this._isRunning;
  }

  protected setIsRunning(isRunning: boolean) {
    this._isRunning = isRunning;
  }

  abstract start(): Promise<void>;

  protected async sharedStart(internalStart: () => Promise<void>) {
    if (this.isRunning()) {
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
    if (!this.isRunning()) {
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
    url: string,
    createResponse: HttpResponseFactory,
  ): PossiblePromise<void>;

  protected async logUnhandledRequestIfNecessary(
    request: HttpRequest,
    strategy: UnhandledRequestStrategy.Declaration | null,
  ) {
    if (strategy?.log) {
      await HttpInterceptorWorker.logUnhandledRequestWarning(request, strategy.action);
      return { wasLogged: true };
    }
    return { wasLogged: false };
  }

  protected async getUnhandledRequestStrategy(request: HttpRequest, interceptorType: HttpInterceptorType) {
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
    request: HttpRequest,
    interceptorType: HttpInterceptorType,
  ): Promise<UnhandledRequestStrategy.Declaration[]> {
    const globalDefaultStrategy = this.getGlobalDefaultUnhandledRequestStrategy(interceptorType);

    try {
      const interceptor = this.findInterceptorByRequestBaseURL(request);

      if (!interceptor) {
        return [];
      }

      const requestClone = request.clone();

      const [defaultStrategy, interceptorStrategy] = await Promise.all([
        this.getDefaultUnhandledRequestStrategy(request, interceptorType),
        this.getInterceptorUnhandledRequestStrategy(requestClone, interceptor),
      ]);

      const candidatesOrPromises = [interceptorStrategy, defaultStrategy, globalDefaultStrategy];
      const candidateStrategies = await Promise.all(candidatesOrPromises.filter(isDefined));
      return candidateStrategies;
    } catch (error) {
      console.error(error);

      const candidateStrategies = [globalDefaultStrategy];
      return candidateStrategies;
    }
  }

  registerRunningInterceptor(interceptor: AnyHttpInterceptorClient) {
    this.runningInterceptors.push(interceptor);
  }

  unregisterRunningInterceptor(interceptor: AnyHttpInterceptorClient) {
    removeArrayElement(this.runningInterceptors, interceptor);
  }

  private findInterceptorByRequestBaseURL(request: HttpRequest) {
    const interceptor = this.runningInterceptors.findLast((interceptor) => {
      const baseURL = interceptor.baseURL().toString();
      return request.url.startsWith(baseURL);
    });

    return interceptor;
  }

  private getGlobalDefaultUnhandledRequestStrategy(interceptorType: HttpInterceptorType) {
    return DEFAULT_UNHANDLED_REQUEST_STRATEGY[interceptorType];
  }

  private async getDefaultUnhandledRequestStrategy(request: HttpRequest, interceptorType: HttpInterceptorType) {
    const defaultStrategyOrFactory = this.store.defaultOnUnhandledRequest(interceptorType);

    if (typeof defaultStrategyOrFactory === 'function') {
      const parsedRequest = await HttpInterceptorWorker.parseRawUnhandledRequest(request);
      return defaultStrategyOrFactory(parsedRequest);
    }

    return defaultStrategyOrFactory;
  }

  private async getInterceptorUnhandledRequestStrategy(request: HttpRequest, interceptor: AnyHttpInterceptorClient) {
    const interceptorStrategyOrFactory = interceptor.onUnhandledRequest();

    if (typeof interceptorStrategyOrFactory === 'function') {
      const parsedRequest = await HttpInterceptorWorker.parseRawUnhandledRequest(request);
      return interceptorStrategyOrFactory(parsedRequest);
    }

    return interceptorStrategyOrFactory;
  }

  abstract clearHandlers(): PossiblePromise<void>;

  abstract clearInterceptorHandlers<Schema extends HttpSchema>(
    interceptor: HttpInterceptorClient<Schema>,
  ): PossiblePromise<void>;

  abstract interceptorsWithHandlers(): AnyHttpInterceptorClient[];

  static createResponseFromDeclaration(
    request: HttpRequest,
    declaration: {
      status: number;
      headers?: HttpHeadersInit;
      body?: HttpBody;
    },
  ): Response {
    const headers = new HttpHeaders(declaration.headers);
    const status = declaration.status;

    const canHaveBody = methodCanHaveResponseBody(request.method as HttpMethod) && status !== 204;

    if (!canHaveBody) {
      return new Response(null, { headers, status });
    }

    if (
      typeof declaration.body === 'string' ||
      declaration.body === undefined ||
      declaration.body instanceof FormData ||
      declaration.body instanceof URLSearchParams ||
      declaration.body instanceof Blob ||
      declaration.body instanceof ArrayBuffer
    ) {
      return new Response(declaration.body ?? null, { headers, status });
    }

    return Response.json(declaration.body, { headers, status });
  }

  static async parseRawUnhandledRequest(request: HttpRequest) {
    return this.parseRawRequest<UnhandledHttpInterceptorRequestPath, UnhandledHttpInterceptorRequestMethodSchema>(
      request,
    );
  }

  static async parseRawRequest<Path extends string, MethodSchema extends HttpMethodSchema>(
    originalRawRequest: HttpRequest,
    options: { urlRegex?: RegExp } = {},
  ): Promise<HttpInterceptorRequest<Path, MethodSchema>> {
    const rawRequest = originalRawRequest.clone();
    const rawRequestClone = rawRequest.clone();

    type BodySchema = Default<Default<MethodSchema['request']>['body']>;
    const parsedBody = await this.parseRawBody<BodySchema>(rawRequest);

    type HeadersSchema = Default<Default<MethodSchema['request']>['headers']>;
    const headers = new HttpHeaders<HeadersSchema>(rawRequest.headers);

    const pathParams = options.urlRegex ? this.parseRawPathParams<Path>(options.urlRegex, rawRequest) : {};

    const parsedURL = createURL(rawRequest.url);
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
        if (property === ('body' satisfies keyof HttpInterceptorRequest<Path, MethodSchema>)) {
          return parsedBody;
        }
        if (property === ('headers' satisfies keyof HttpInterceptorRequest<Path, MethodSchema>)) {
          return headers;
        }
        if (property === ('pathParams' satisfies keyof HttpInterceptorRequest<Path, MethodSchema>)) {
          return pathParams;
        }
        if (property === ('searchParams' satisfies keyof HttpInterceptorRequest<Path, MethodSchema>)) {
          return searchParams;
        }
        if (property === ('raw' satisfies keyof HttpInterceptorRequest<Path, MethodSchema>)) {
          return rawRequestClone;
        }
        return Reflect.get(target, property, target) as unknown;
      },
    });

    return parsedRequest;
  }

  private static isHiddenRequestProperty(property: string) {
    return HTTP_INTERCEPTOR_REQUEST_HIDDEN_PROPERTIES.has(property as never);
  }

  static async parseRawResponse<MethodSchema extends HttpMethodSchema, StatusCode extends HttpStatusCode>(
    originalRawResponse: HttpResponse,
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
        if (property === ('headers' satisfies keyof HttpInterceptorResponse<MethodSchema, StatusCode>)) {
          return headers;
        }
        if (property === ('body' satisfies keyof HttpInterceptorResponse<MethodSchema, StatusCode>)) {
          return parsedBody;
        }
        if (property === ('raw' satisfies keyof HttpInterceptorResponse<MethodSchema, StatusCode>)) {
          return rawResponseClone;
        }
        return Reflect.get(target, property, target) as unknown;
      },
    });

    return parsedRequest;
  }

  private static isHiddenResponseProperty(property: string) {
    return HTTP_INTERCEPTOR_RESPONSE_HIDDEN_PROPERTIES.has(property as never);
  }

  static parseRawPathParams<Path extends string>(matchedURLRegex: RegExp, request: HttpRequest): InferPathParams<Path> {
    const match = request.url.match(matchedURLRegex);
    const pathParams = { ...match?.groups };
    return pathParams as InferPathParams<Path>;
  }

  static async parseRawBody<Body extends HttpBody>(resource: HttpRequest | HttpResponse) {
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
        return await this.parseRawBodyAsText<Body>(resourceClone);
      }
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  private static async parseRawBodyAsJSON<Body extends HttpBody>(resource: HttpRequest | HttpResponse) {
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

  private static async parseRawBodyAsSearchParams<Body extends HttpBody>(resource: HttpRequest | HttpResponse) {
    const bodyAsText = await resource.text();

    if (!bodyAsText.trim()) {
      return null;
    }

    const bodyAsSearchParams = new HttpSearchParams(bodyAsText);
    return bodyAsSearchParams as Body;
  }

  private static async parseRawBodyAsFormData<Body extends HttpBody>(resource: HttpRequest | HttpResponse) {
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

  private static async parseRawBodyAsBlob<Body extends HttpBody>(resource: HttpRequest | HttpResponse) {
    const bodyAsBlob = await resource.blob();
    return bodyAsBlob as Body;
  }

  private static async parseRawBodyAsText<Body extends HttpBody>(resource: HttpRequest | HttpResponse) {
    const bodyAsText = await resource.text();
    return (bodyAsText || null) as Body;
  }

  static async logUnhandledRequestWarning(rawRequest: HttpRequest, action: UnhandledRequestStrategy.Action) {
    const request = await this.parseRawRequest(rawRequest);

    const [formattedHeaders, formattedSearchParams, formattedBody] = await Promise.all([
      formatValueToLog(request.headers.toObject()),
      formatValueToLog(request.searchParams.toObject()),
      formatValueToLog(request.body),
    ]);

    logWithPrefix(
      [
        `${action === 'bypass' ? 'Warning:' : 'Error:'} Request was not handled and was ` +
          `${action === 'bypass' ? chalk.yellow('bypassed') : chalk.red('rejected')}.\n\n `,
        `${request.method} ${request.url}`,
        '\n    Headers:',
        formattedHeaders,
        '\n    Search params:',
        formattedSearchParams,
        '\n    Body:',
        formattedBody,
        '\n\nLearn more: https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests',
      ],
      { method: action === 'bypass' ? 'warn' : 'error' },
    );
  }
}

export default HttpInterceptorWorker;
