import {
  HttpHandler as MSWHttpHandler,
  HttpResponse as MSWHttpResponse,
  SharedOptions as MSWWorkerSharedOptions,
  StrictRequest as MSWStrictRequest,
  http,
  passthrough,
} from 'msw';

import HttpHeaders from '@/http/headers/HttpHeaders';
import { HttpHeadersInit, HttpHeadersSchema } from '@/http/headers/types';
import { HttpResponse, HttpRequest, DefaultBody } from '@/http/types/requests';
import { Default } from '@/types/utils';

import HttpSearchParams from '../../../http/searchParams/HttpSearchParams';
import { HttpInterceptor } from '../interceptor/types/public';
import {
  HttpInterceptorMethod,
  HttpInterceptorMethodSchema,
  HttpInterceptorResponseSchemaStatusCode,
  HttpInterceptorSchema,
} from '../interceptor/types/schema';
import {
  HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES,
  HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES,
  HttpInterceptorRequest,
  HttpInterceptorResponse,
} from '../requestTracker/types/requests';
import InvalidHttpInterceptorWorkerPlatform from './errors/InvalidHttpInterceptorWorkerPlatform';
import MismatchedHttpInterceptorWorkerPlatform from './errors/MismatchedHttpInterceptorWorkerPlatform';
import NotStartedHttpInterceptorWorkerError from './errors/NotStartedHttpInterceptorWorkerError';
import OtherHttpInterceptorWorkerRunningError from './errors/OtherHttpInterceptorWorkerRunningError';
import UnregisteredServiceWorkerError from './errors/UnregisteredServiceWorkerError';
import { HttpInterceptorWorkerOptions, HttpInterceptorWorkerPlatform } from './types/options';
import { HttpInterceptorWorker as PublicHttpInterceptorWorker } from './types/public';
import { BrowserHttpWorker, HttpRequestHandler, HttpWorker, NodeHttpWorker } from './types/requests';

class HttpInterceptorWorker implements PublicHttpInterceptorWorker {
  private static runningInstance?: HttpInterceptorWorker;

  private _platform: HttpInterceptorWorkerPlatform;
  private _internalWorker?: HttpWorker;
  private _isRunning = false;

  private httpHandlerGroups: {
    interceptor: HttpInterceptor<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    httpHandler: MSWHttpHandler;
  }[] = [];

  constructor(options: HttpInterceptorWorkerOptions) {
    this._platform = this.validatePlatform(options.platform);
  }

  private validatePlatform(platform: HttpInterceptorWorkerPlatform) {
    const platformOptions = Object.values(HttpInterceptorWorkerPlatform) as string[];
    if (!platformOptions.includes(platform)) {
      throw new InvalidHttpInterceptorWorkerPlatform(platform);
    }
    return platform;
  }

  internalWorkerOrThrow() {
    if (!this._internalWorker) {
      throw new NotStartedHttpInterceptorWorkerError();
    }
    return this._internalWorker;
  }

  async internalWorkerOrLoad() {
    if (!this._internalWorker) {
      this._internalWorker = await this.createInternalWorker();
    }
    return this._internalWorker;
  }

  private async createInternalWorker() {
    if (this._platform === 'browser') {
      const { setupWorker } = await import('msw/browser');

      if (typeof setupWorker === 'undefined') {
        throw new MismatchedHttpInterceptorWorkerPlatform(this._platform);
      }

      return setupWorker();
    } else {
      const { setupServer } = await import('msw/node');

      if (typeof setupServer === 'undefined') {
        throw new MismatchedHttpInterceptorWorkerPlatform(this._platform);
      }

      return setupServer();
    }
  }

  platform() {
    return this._platform;
  }

  isRunning() {
    return this._isRunning;
  }

  async start() {
    if (HttpInterceptorWorker.runningInstance && HttpInterceptorWorker.runningInstance !== this) {
      throw new OtherHttpInterceptorWorkerRunningError();
    }

    if (this._isRunning) {
      return;
    }

    const internalWorker = await this.internalWorkerOrLoad();
    const sharedOptions: MSWWorkerSharedOptions = { onUnhandledRequest: 'bypass' };

    if (this.isInternalBrowserWorker(internalWorker)) {
      await this.startInBrowser(internalWorker, sharedOptions);
    } else {
      this.startInNode(internalWorker, sharedOptions);
    }

    this._isRunning = true;
    HttpInterceptorWorker.runningInstance = this;
  }

  private async startInBrowser(internalWorker: BrowserHttpWorker, sharedOptions: MSWWorkerSharedOptions) {
    try {
      await internalWorker.start({ ...sharedOptions, quiet: true });
    } catch (error) {
      this.handleBrowserWorkerStartError(error);
    }
  }

  private handleBrowserWorkerStartError(error: unknown) {
    if (UnregisteredServiceWorkerError.matchesRawError(error)) {
      throw new UnregisteredServiceWorkerError();
    }
    throw error;
  }

  private startInNode(internalWorker: NodeHttpWorker, sharedOptions: MSWWorkerSharedOptions) {
    internalWorker.listen(sharedOptions);
  }

  async stop() {
    if (!this._isRunning) {
      return;
    }

    const internalWorker = await this.internalWorkerOrLoad();

    if (this.isInternalBrowserWorker(internalWorker)) {
      this.stopInBrowser(internalWorker);
    } else {
      this.stopInNode(internalWorker);
    }

    this.clearHandlers();

    this._isRunning = false;
    HttpInterceptorWorker.runningInstance = undefined;
  }

  private stopInBrowser(internalWorker: BrowserHttpWorker) {
    internalWorker.stop();
  }

  private stopInNode(internalWorker: NodeHttpWorker) {
    internalWorker.close();
  }

  private isInternalBrowserWorker(worker: HttpWorker): worker is BrowserHttpWorker {
    return 'start' in worker && 'stop' in worker;
  }

  hasInternalBrowserWorker() {
    return this.isInternalBrowserWorker(this.internalWorkerOrThrow());
  }

  hasInternalNodeWorker() {
    return !this.hasInternalBrowserWorker();
  }

  use<Schema extends HttpInterceptorSchema>(
    interceptor: HttpInterceptor<Schema>,
    method: HttpInterceptorMethod,
    url: string,
    handler: HttpRequestHandler,
  ) {
    const internalWorker = this.internalWorkerOrThrow();
    const lowercaseMethod = method.toLowerCase<typeof method>();

    const httpHandler = http[lowercaseMethod](url, async (context) => {
      const result = await handler({
        ...context,
        request: context.request as MSWStrictRequest<DefaultBody>,
      });

      if (result.bypass) {
        return passthrough();
      }
      return result.response;
    });

    internalWorker.use(httpHandler);

    this.httpHandlerGroups.push({ interceptor, httpHandler });
  }

  clearHandlers() {
    this._internalWorker?.resetHandlers();
    this.httpHandlerGroups = [];
  }

  clearInterceptorHandlers<Schema extends HttpInterceptorSchema>(interceptor: HttpInterceptor<Schema>) {
    const httpHandlerGroupsToKeep = this.httpHandlerGroups.filter((group) => group.interceptor !== interceptor);

    const httpHandlersToKeep = httpHandlerGroupsToKeep.map((group) => group.httpHandler);
    this._internalWorker?.resetHandlers(...httpHandlersToKeep);

    this.httpHandlerGroups = httpHandlerGroupsToKeep;
  }

  interceptorsWithHandlers() {
    return this.httpHandlerGroups.map((group) => group.interceptor);
  }

  static createResponseFromDeclaration<
    Declaration extends {
      status: number;
      headers?: HttpHeadersInit<HeadersSchema>;
      body?: DefaultBody;
    },
    HeadersSchema extends HttpHeadersSchema,
  >(responseDeclaration: Declaration) {
    const response = MSWHttpResponse.json(responseDeclaration.body, {
      headers: new HttpHeaders(responseDeclaration.headers),
      status: responseDeclaration.status,
    });

    return response as typeof response & HttpResponse<Declaration['body'], Declaration['status'], HeadersSchema>;
  }

  static async parseRawRequest<MethodSchema extends HttpInterceptorMethodSchema>(
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
    return (HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES as Set<string>).has(property);
  }

  static async parseRawResponse<
    MethodSchema extends HttpInterceptorMethodSchema,
    StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
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
    return (HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES as Set<string>).has(property);
  }

  static async parseRawBody<Body extends DefaultBody>(requestOrResponse: HttpRequest | HttpResponse) {
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
