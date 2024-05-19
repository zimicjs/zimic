import chalk from 'chalk';
import { HttpResponse as MSWHttpResponse } from 'msw';

import HttpHeaders from '@/http/headers/HttpHeaders';
import { HttpHeadersInit, HttpHeadersSchema } from '@/http/headers/types';
import { HttpResponse, HttpRequest, HttpBody } from '@/http/types/requests';
import {
  HttpMethod,
  HttpServiceMethodSchema,
  HttpServiceResponseSchemaStatusCode,
  HttpServiceSchema,
} from '@/http/types/schema';
import { Default, PossiblePromise } from '@/types/utils';
import { formatObjectToLog, logWithPrefix } from '@/utils/console';
import { createURL, excludeNonPathParams } from '@/utils/urls';

import HttpSearchParams from '../../../http/searchParams/HttpSearchParams';
import HttpInterceptorClient, { AnyHttpInterceptorClient } from '../interceptor/HttpInterceptorClient';
import { HttpInterceptorPlatform, UnhandledRequestStrategy } from '../interceptor/types/options';
import {
  HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES,
  HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES,
  HttpInterceptorRequest,
  HttpInterceptorResponse,
} from '../requestHandler/types/requests';
import UnhandledRequestError from './errors/UnhandledRequestError';
import { HttpResponseFactory } from './types/requests';

const DEFAULT_UNHANDLED_REQUEST_LOGGING_STRATEGY = process.env.DEFAULT_UNHANDLED_REQUEST_LOGGING_STRATEGY === 'true';

export const DEFAULT_UNHANDLED_REQUEST_STRATEGY: {
  local: Required<UnhandledRequestStrategy.LocalDeclaration>;
  remote: Required<UnhandledRequestStrategy.RemoteDeclaration>;
} = {
  local: { action: 'bypass', log: DEFAULT_UNHANDLED_REQUEST_LOGGING_STRATEGY },
  remote: { action: 'reject', log: DEFAULT_UNHANDLED_REQUEST_LOGGING_STRATEGY },
};

abstract class HttpInterceptorWorker {
  abstract readonly type: 'local' | 'remote';

  private _platform: HttpInterceptorPlatform | null = null;
  private _isRunning = false;
  private startingPromise?: Promise<void>;
  private stoppingPromise?: Promise<void>;

  private unhandledRequestStrategies: {
    baseURL: string;
    declarationOrFactory: UnhandledRequestStrategy;
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

    this.startingPromise = internalStart();
    await this.startingPromise;

    this.startingPromise = undefined;
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

  abstract use<Schema extends HttpServiceSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    url: string,
    createResponse: HttpResponseFactory,
  ): PossiblePromise<void>;

  protected async handleUnhandledRequest(request: Request, options: { throwOnRejected: boolean }) {
    const strategy = await this.getUnhandledRequestStrategy(request);

    if (strategy.log) {
      await HttpInterceptorWorker.warnUnhandledRequest(request, strategy.action);
    }
    if (strategy.action === 'reject' && options.throwOnRejected) {
      throw new UnhandledRequestError();
    }
  }

  onUnhandledRequest(baseURL: string, strategyOrFactory: UnhandledRequestStrategy) {
    this.unhandledRequestStrategies.push({
      baseURL,
      declarationOrFactory: strategyOrFactory,
    });
  }

  offUnhandledRequest(baseURL: string) {
    this.unhandledRequestStrategies = this.unhandledRequestStrategies.filter(
      (strategy) => strategy.baseURL !== baseURL,
    );
  }

  async getUnhandledRequestStrategy(
    request: HttpRequest,
  ): Promise<UnhandledRequestStrategy.LocalDeclaration | UnhandledRequestStrategy.RemoteDeclaration> {
    const requestURL = excludeNonPathParams(createURL(request.url)).toString();

    const { declarationOrFactory } =
      this.unhandledRequestStrategies.findLast((strategy) => requestURL.startsWith(strategy.baseURL)) ?? {};

    const strategy =
      typeof declarationOrFactory === 'function' ? await declarationOrFactory(request) : declarationOrFactory;

    const defaultStrategy = DEFAULT_UNHANDLED_REQUEST_STRATEGY[this.type];

    return {
      action: strategy?.action ?? defaultStrategy.action,
      log: strategy?.log ?? defaultStrategy.log,
    };
  }

  abstract clearHandlers(): PossiblePromise<void>;

  abstract clearInterceptorHandlers<Schema extends HttpServiceSchema>(
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
  >(request: HttpRequest, responseDeclaration: Declaration) {
    const headers = new HttpHeaders(responseDeclaration.headers);
    const status = responseDeclaration.status;

    const canHaveBody = request.method !== 'HEAD' && status !== 204;

    const response = canHaveBody
      ? MSWHttpResponse.json(responseDeclaration.body, { headers, status })
      : new Response(null, { headers, status });

    return response as typeof response & HttpResponse<Declaration['body'], Declaration['status'], HeadersSchema>;
  }

  static async parseRawRequest<MethodSchema extends HttpServiceMethodSchema>(
    originalRawRequest: HttpRequest,
  ): Promise<HttpInterceptorRequest<MethodSchema>> {
    const rawRequest = originalRawRequest.clone();
    const rawRequestClone = rawRequest.clone();

    type BodySchema = Default<Default<MethodSchema['request']>['body']>;
    const parsedBody = await this.parseRawBody<BodySchema>(rawRequest);

    type HeadersSchema = Default<Default<MethodSchema['request']>['headers']>;
    const headers = new HttpHeaders<HeadersSchema>(rawRequest.headers);

    const parsedURL = createURL(rawRequest.url);
    type SearchParamsSchema = Default<Default<MethodSchema['request']>['searchParams']>;
    const searchParams = new HttpSearchParams<SearchParamsSchema>(parsedURL.searchParams);

    const parsedRequest = new Proxy(rawRequest as unknown as HttpInterceptorRequest<MethodSchema>, {
      has(target, property: keyof HttpInterceptorRequest<MethodSchema>) {
        if (HttpInterceptorWorker.isHiddenRequestProperty(property)) {
          return false;
        }
        return Reflect.has(target, property);
      },

      get(target, property: keyof HttpInterceptorRequest<MethodSchema>) {
        if (HttpInterceptorWorker.isHiddenRequestProperty(property)) {
          return undefined;
        }
        if (property === ('body' satisfies keyof HttpInterceptorRequest<MethodSchema>)) {
          return parsedBody;
        }
        if (property === ('headers' satisfies keyof HttpInterceptorRequest<MethodSchema>)) {
          return headers;
        }
        if (property === ('searchParams' satisfies keyof HttpInterceptorRequest<MethodSchema>)) {
          return searchParams;
        }
        if (property === ('raw' satisfies keyof HttpInterceptorRequest<MethodSchema>)) {
          return rawRequestClone;
        }
        return Reflect.get(target, property, target) as unknown;
      },
    });

    return parsedRequest;
  }

  private static isHiddenRequestProperty(property: string) {
    return HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES.has(property);
  }

  static async parseRawResponse<
    MethodSchema extends HttpServiceMethodSchema,
    StatusCode extends HttpServiceResponseSchemaStatusCode<Default<MethodSchema['response']>>,
  >(originalRawResponse: HttpResponse): Promise<HttpInterceptorResponse<MethodSchema, StatusCode>> {
    const rawResponse = originalRawResponse.clone();
    const rawResponseClone = rawResponse.clone();

    type BodySchema = Default<Default<MethodSchema['response']>[StatusCode]['body']>;
    const parsedBody = await this.parseRawBody<BodySchema>(rawResponse);

    type HeadersSchema = Default<Default<MethodSchema['response']>[StatusCode]['headers']>;
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
    return HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES.has(property);
  }

  static async parseRawBody<Body extends HttpBody>(requestOrResponse: HttpRequest | HttpResponse) {
    const bodyAsText = await requestOrResponse.text();

    try {
      const jsonParsedBody = JSON.parse(bodyAsText) as Body;
      return jsonParsedBody;
    } catch {
      return bodyAsText || null;
    }
  }

  static async warnUnhandledRequest(rawRequest: HttpRequest, action: UnhandledRequestStrategy.Action) {
    const request = await this.parseRawRequest(rawRequest);

    logWithPrefix(
      [
        `${action === 'bypass' ? 'Warning:' : 'Error:'} Request did not match any handlers and was ` +
          `${action === 'bypass' ? chalk.yellow('bypassed') : chalk.red('rejected')}:\n\n `,
        `${request.method} ${request.url}\n`,
        '   Headers:',
        `${formatObjectToLog(Object.fromEntries(request.headers))}\n`,
        '   Search params:',
        `${formatObjectToLog(Object.fromEntries(request.searchParams))}\n`,
        '   Body:',
        `${formatObjectToLog(request.body)}\n\n`,
        'To handle this request, use an interceptor to create a handler for it.\n',
        'If you are using restrictions, make sure that they match the content of the request.',
      ],
      { method: action === 'bypass' ? 'warn' : 'error' },
    );
  }
}

export default HttpInterceptorWorker;
