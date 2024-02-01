import { HttpResponse as MSWHttpResponse, SharedOptions as MSWWorkerSharedOptions, http, passthrough } from 'msw';

import { Default } from '@/types/utils';

import {
  HttpInterceptorMethod,
  HttpInterceptorMethodSchema,
  HttpInterceptorResponseSchemaStatusCode,
} from '../interceptor/types/schema';
import {
  HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES,
  HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES,
  HttpInterceptorRequest,
  HttpInterceptorResponse,
} from '../requestTracker/types/requests';
import InvalidHttpInterceptorWorkerPlatform from './errors/InvalidHttpInterceptorWorkerPlatform';
import NotStartedHttpInterceptorWorkerError from './errors/NotStartedHttpInterceptorWorkerError';
import UnregisteredServiceWorkerError from './errors/UnregisteredServiceWorkerError';
import { HttpInterceptorWorkerOptions, HttpInterceptorWorkerPlatform } from './types/options';
import { HttpInterceptorWorker } from './types/public';
import {
  DefaultBody,
  BrowserHttpWorker,
  HttpRequestHandler,
  HttpWorker,
  HttpResponse,
  HttpRequest,
  NodeHttpWorker,
} from './types/requests';

class InternalHttpInterceptorWorker implements HttpInterceptorWorker {
  private _baseURL: string;
  private _platform: HttpInterceptorWorkerPlatform;
  private _internalWorker?: HttpWorker;
  private _isRunning = false;

  constructor(options: HttpInterceptorWorkerOptions) {
    this._baseURL = options.baseURL;
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
      return setupWorker();
    } else {
      const { setupServer } = await import('msw/node');
      return setupServer();
    }
  }

  baseURL() {
    return this._baseURL;
  }

  platform() {
    return this._platform;
  }

  isRunning() {
    return this._isRunning;
  }

  async start() {
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

  use(method: HttpInterceptorMethod, path: string, handler: HttpRequestHandler) {
    const internalWorker = this.internalWorkerOrThrow();
    const lowercaseMethod = method.toLowerCase<typeof method>();
    const pathWithBaseURL = this.applyBaseURL(path);

    internalWorker.use(
      http[lowercaseMethod](pathWithBaseURL, async (context) => {
        const result = await handler(context);
        if (result.bypass) {
          return passthrough();
        }
        return result.response;
      }),
    );
  }

  private applyBaseURL(path: string) {
    const baseURLWithoutTrailingSlash = this._baseURL.replace(/\/$/, '');
    const pathWithoutLeadingSlash = path.replace(/^\//, '');
    return `${baseURLWithoutTrailingSlash}/${pathWithoutLeadingSlash}`;
  }

  clearHandlers() {
    this._internalWorker?.resetHandlers();
  }

  static createResponseFromDeclaration<Declaration extends { status: number; body?: DefaultBody }>(
    responseDeclaration: Declaration,
  ): HttpResponse<Declaration['body'], Declaration['status']> {
    const response = MSWHttpResponse.json(responseDeclaration.body, {
      status: responseDeclaration.status,
    });
    return response as typeof response & {
      status: Declaration['status'];
      body: Declaration['body'];
    };
  }

  static async parseRawRequest<MethodSchema extends HttpInterceptorMethodSchema>(
    rawRequest: HttpRequest,
  ): Promise<HttpInterceptorRequest<MethodSchema>> {
    const rawRequestClone = rawRequest.clone();

    const parsedBody = await this.parseRawBody(rawRequest);

    const parsedRequest = new Proxy(rawRequest as unknown as HttpInterceptorRequest<MethodSchema>, {
      has(target, property: keyof HttpInterceptorRequest<MethodSchema>) {
        if (InternalHttpInterceptorWorker.isHiddenRequestProperty(property)) {
          return false;
        }
        return Reflect.has(target, property);
      },

      get(target, property: keyof HttpInterceptorRequest<MethodSchema>) {
        if (InternalHttpInterceptorWorker.isHiddenRequestProperty(property)) {
          return undefined;
        }
        if (property === 'body') {
          return parsedBody;
        }
        if (property === 'raw') {
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
  >(rawResponse: HttpResponse): Promise<HttpInterceptorResponse<MethodSchema, StatusCode>> {
    const rawResponseClone = rawResponse.clone();
    const parsedBody = await this.parseRawBody(rawResponse);

    const parsedRequest = new Proxy(rawResponse as unknown as HttpInterceptorResponse<MethodSchema, StatusCode>, {
      has(target, property: keyof HttpInterceptorResponse<MethodSchema, StatusCode>) {
        if (InternalHttpInterceptorWorker.isHiddenResponseProperty(property)) {
          return false;
        }
        return Reflect.has(target, property);
      },

      get(target, property: keyof HttpInterceptorResponse<MethodSchema, StatusCode>) {
        if (InternalHttpInterceptorWorker.isHiddenResponseProperty(property)) {
          return undefined;
        }
        if (property === 'body') {
          return parsedBody;
        }
        if (property === 'raw') {
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

  static async parseRawBody<Body extends DefaultBody>(requestOrResponse: HttpRequest<Body> | HttpResponse<Body>) {
    const bodyAsText = await requestOrResponse.text();

    try {
      const jsonParsedBody = JSON.parse(bodyAsText) as Body;
      return jsonParsedBody;
    } catch {
      return bodyAsText || null;
    }
  }
}

export default InternalHttpInterceptorWorker;
