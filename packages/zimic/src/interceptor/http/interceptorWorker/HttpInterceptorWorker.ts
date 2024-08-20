import chalk from 'chalk';

import InvalidJSONError from '@/errors/InvalidJSONError';
import InvalidFormDataError from '@/http/errors/InvalidFormDataError';
import HttpFormData from '@/http/formData/HttpFormData';
import HttpHeaders from '@/http/headers/HttpHeaders';
import { HttpHeadersInit, HttpHeadersSchema } from '@/http/headers/types';
import { HttpBody, HttpRequest, HttpResponse } from '@/http/types/requests';
import {
  HttpMethod,
  HttpMethodSchema,
  HttpResponseSchemaStatusCode,
  HttpSchema,
  InferPathParams,
} from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';
import { formatObjectToLog, logWithPrefix } from '@/utils/console';
import { isClientSide } from '@/utils/environment';
import { methodCanHaveResponseBody } from '@/utils/http';
import { createURL, excludeNonPathParams } from '@/utils/urls';

import HttpSearchParams from '../../../http/searchParams/HttpSearchParams';
import HttpInterceptorClient, { AnyHttpInterceptorClient } from '../interceptor/HttpInterceptorClient';
import { HttpInterceptorPlatform, UnhandledRequestStrategy } from '../interceptor/types/options';
import {
  HTTP_INTERCEPTOR_REQUEST_HIDDEN_REQUEST_PROPERTIES,
  HTTP_INTERCEPTOR_RESPONSE_HIDDEN_REQUEST_PROPERTIES,
  HttpInterceptorRequest,
  HttpInterceptorResponse,
} from '../requestHandler/types/requests';
import HttpInterceptorWorkerStore from './HttpInterceptorWorkerStore';
import { HttpResponseFactory } from './types/requests';

abstract class HttpInterceptorWorker {
  abstract readonly type: 'local' | 'remote';

  private _platform: HttpInterceptorPlatform | null = null;
  private _isRunning = false;
  private startingPromise?: Promise<void>;
  private stoppingPromise?: Promise<void>;

  private store = new HttpInterceptorWorkerStore();

  private unhandledRequestStrategies: {
    baseURL: string;
    declarationOrHandler: UnhandledRequestStrategy;
  }[] = [];

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

  protected async sharedStop(internalStop: () => Promise<void>) {
    if (!this.isRunning()) {
      return;
    }
    if (this.stoppingPromise) {
      return this.stoppingPromise;
    }

    this.stoppingPromise = internalStop();
    await this.stoppingPromise;

    this.stoppingPromise = undefined;
  }

  abstract use<Schema extends HttpSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    url: string,
    createResponse: HttpResponseFactory,
  ): PossiblePromise<void>;

  protected async handleUnhandledRequest(request: Request) {
    const requestURL = excludeNonPathParams(createURL(request.url)).toString();

    const defaultDeclarationOrHandler = this.store.defaultUnhandledRequestStrategy();

    const declarationOrHandler = this.unhandledRequestStrategies.findLast((strategy) => {
      return requestURL.startsWith(strategy.baseURL);
    })?.declarationOrHandler;

    const action: UnhandledRequestStrategy.Action = this.type === 'local' ? 'bypass' : 'reject';

    if (typeof declarationOrHandler === 'function') {
      await HttpInterceptorWorker.logUnhandledRequestWithHandler(request, declarationOrHandler, action);
    } else if (declarationOrHandler?.log !== undefined) {
      await HttpInterceptorWorker.logUnhandledRequestWithStaticStrategy(
        request,
        { log: declarationOrHandler.log },
        action,
      );
    } else if (typeof defaultDeclarationOrHandler === 'function') {
      await HttpInterceptorWorker.logUnhandledRequestWithHandler(request, defaultDeclarationOrHandler, action);
    } else {
      await HttpInterceptorWorker.logUnhandledRequestWithStaticStrategy(request, defaultDeclarationOrHandler, action);
    }
  }

  static async logUnhandledRequestWithHandler(
    request: Request,
    handler: UnhandledRequestStrategy.Handler,
    action: UnhandledRequestStrategy.Action,
  ) {
    const requestClone = request.clone();

    try {
      await handler(request, {
        async log() {
          await HttpInterceptorWorker.logUnhandledRequest(requestClone, action);
        },
      });
    } catch (error) {
      console.error(error);
    }
  }

  static async logUnhandledRequestWithStaticStrategy(
    request: Request,
    declaration: Required<UnhandledRequestStrategy.Declaration>,
    action: UnhandledRequestStrategy.Action,
  ) {
    if (declaration.log) {
      await HttpInterceptorWorker.logUnhandledRequest(request, action);
    }
  }

  onUnhandledRequest(baseURL: string, strategyOrFactory: UnhandledRequestStrategy) {
    this.unhandledRequestStrategies.push({
      baseURL,
      declarationOrHandler: strategyOrFactory,
    });
  }

  offUnhandledRequest(baseURL: string) {
    this.unhandledRequestStrategies = this.unhandledRequestStrategies.filter(
      (strategy) => strategy.baseURL !== baseURL,
    );
  }

  abstract clearHandlers(): PossiblePromise<void>;

  abstract clearInterceptorHandlers<Schema extends HttpSchema>(
    interceptor: HttpInterceptorClient<Schema>,
  ): PossiblePromise<void>;

  abstract interceptorsWithHandlers(): AnyHttpInterceptorClient[];

  static createResponseFromDeclaration<
    Declaration extends {
      status: number;
      headers?: HttpHeadersInit<HeadersSchema>;
      body?: HttpBody;
    },
    HeadersSchema extends HttpHeadersSchema,
  >(request: HttpRequest, declaration: Declaration) {
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
    return HTTP_INTERCEPTOR_REQUEST_HIDDEN_REQUEST_PROPERTIES.has(property as never);
  }

  static async parseRawResponse<
    MethodSchema extends HttpMethodSchema,
    StatusCode extends HttpResponseSchemaStatusCode<Default<MethodSchema['response']>>,
  >(originalRawResponse: HttpResponse): Promise<HttpInterceptorResponse<MethodSchema, StatusCode>> {
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
    return HTTP_INTERCEPTOR_RESPONSE_HIDDEN_REQUEST_PROPERTIES.has(property as never);
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

  static async logUnhandledRequest(rawRequest: HttpRequest, action: UnhandledRequestStrategy.Action) {
    const request = await this.parseRawRequest(rawRequest);

    logWithPrefix(
      [
        `${action === 'bypass' ? 'Warning:' : 'Error:'} Request was not handled and was ` +
          `${action === 'bypass' ? chalk.yellow('bypassed') : chalk.red('rejected')}.\n\n `,
        `${request.method} ${request.url}`,
        '\n    Headers:',
        await formatObjectToLog(Object.fromEntries(request.headers)),
        '\n    Search params:',
        await formatObjectToLog(Object.fromEntries(request.searchParams)),
        '\n    Body:',
        await formatObjectToLog(request.body),
        '\n\nLearn more: https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#unhandled-requests',
      ],
      { method: action === 'bypass' ? 'warn' : 'error' },
    );
  }
}

export default HttpInterceptorWorker;
