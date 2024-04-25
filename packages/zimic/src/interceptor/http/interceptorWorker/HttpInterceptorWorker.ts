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
import { Default } from '@/types/utils';

import HttpSearchParams from '../../../http/searchParams/HttpSearchParams';
import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import {
  HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES,
  HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES,
  HttpInterceptorRequest,
  HttpInterceptorResponse,
} from '../requestTracker/types/requests';
import OtherHttpInterceptorWorkerRunningError from './errors/OtherHttpInterceptorWorkerRunningError';
import { HttpInterceptorWorkerPlatform } from './types/options';
import { HttpRequestHandler } from './types/requests';

abstract class HttpInterceptorWorker {
  private static runningInstance?: HttpInterceptorWorker;

  private _platform: HttpInterceptorWorkerPlatform | null = null;
  private _isRunning = false;

  platform() {
    return this._platform;
  }

  protected setPlatform(platform: HttpInterceptorWorkerPlatform) {
    this._platform = platform;
  }

  isRunning() {
    return this._isRunning;
  }

  protected setIsRunning(isRunning: boolean) {
    this._isRunning = isRunning;
  }

  abstract start(): Promise<void>;

  protected ensureEmptyRunningInstance() {
    if (HttpInterceptorWorker.runningInstance && HttpInterceptorWorker.runningInstance !== this) {
      throw new OtherHttpInterceptorWorkerRunningError();
    }
  }

  protected markAsRunningInstance() {
    HttpInterceptorWorker.runningInstance = this;
  }

  protected clearRunningInstance() {
    HttpInterceptorWorker.runningInstance = undefined;
  }

  abstract stop(): Promise<void>;

  abstract use<Schema extends HttpServiceSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    url: string,
    handler: HttpRequestHandler,
  ): Promise<void> | void;

  abstract clearHandlers(): Promise<void> | void;

  abstract clearInterceptorHandlers<Schema extends HttpServiceSchema>(
    interceptor: HttpInterceptorClient<Schema>,
  ): Promise<void> | void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract interceptorsWithHandlers(): HttpInterceptorClient<any>[];

  static createResponseFromDeclaration<
    Declaration extends {
      status: number;
      headers?: HttpHeadersInit<HeadersSchema>;
      body?: HttpBody;
    },
    HeadersSchema extends HttpHeadersSchema,
  >(responseDeclaration: Declaration) {
    const response = MSWHttpResponse.json(responseDeclaration.body, {
      headers: new HttpHeaders(responseDeclaration.headers),
      status: responseDeclaration.status,
    });

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

    const parsedURL = new URL(rawRequest.url);
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
}

export default HttpInterceptorWorker;
