import { HttpResponse as MSWHttpResponse, SharedOptions, http, passthrough } from 'msw';

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
import UnregisteredServiceWorkerError from './errors/UnregisteredServiceWorkerError';
import {
  DefaultBody,
  BrowserHttpWorker,
  HttpRequestHandler,
  HttpWorker,
  HttpInterceptorWorkerOptions,
  HttpResponse,
  HttpRequest,
} from './types';

abstract class HttpInterceptorWorker<Worker extends HttpWorker = HttpWorker> {
  private _baseURL: string;
  private _isRunning = false;

  protected constructor(
    private _worker: Worker,
    options: HttpInterceptorWorkerOptions,
  ) {
    this._baseURL = options.baseURL;
  }

  worker() {
    return this._worker;
  }

  baseURL() {
    return this._baseURL;
  }

  isRunning() {
    return this._isRunning;
  }

  async start() {
    if (this._isRunning) {
      return;
    }

    const sharedOptions: SharedOptions = { onUnhandledRequest: 'bypass' };

    if (this.isBrowserWorker(this._worker)) {
      try {
        await this._worker.start({ ...sharedOptions, quiet: true });
      } catch (error) {
        this.handleBrowserWorkerStartError(error);
      }
    } else {
      this._worker.listen(sharedOptions);
    }

    this._isRunning = true;
  }

  private handleBrowserWorkerStartError(error: unknown) {
    if (UnregisteredServiceWorkerError.matchesRawError(error)) {
      throw new UnregisteredServiceWorkerError();
    }
    throw error;
  }

  stop() {
    if (!this._isRunning) {
      return;
    }

    if (this.isBrowserWorker(this._worker)) {
      this._worker.stop();
    } else {
      this._worker.close();
    }

    this._isRunning = false;
  }

  private isBrowserWorker(worker: HttpWorker): worker is BrowserHttpWorker {
    return 'start' in worker && 'stop' in worker;
  }

  use(method: HttpInterceptorMethod, path: string, handler: HttpRequestHandler) {
    const lowercaseMethod = method.toLowerCase<typeof method>();

    const pathWithBaseURL = this.applyBaseURL(path);

    this._worker.use(
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
    this._worker.resetHandlers();
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
      get(target, property: keyof HttpInterceptorRequest<MethodSchema>) {
        const isHiddenProperty = (HTTP_INTERCEPTOR_REQUEST_HIDDEN_BODY_PROPERTIES as Set<string>).has(property);
        if (isHiddenProperty) {
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

  static async parseRawResponse<
    MethodSchema extends HttpInterceptorMethodSchema,
    StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
  >(rawResponse: HttpResponse): Promise<HttpInterceptorResponse<MethodSchema, StatusCode>> {
    const rawResponseClone = rawResponse.clone();
    const parsedBody = await this.parseRawBody(rawResponse);

    const parsedRequest = new Proxy(rawResponse as unknown as HttpInterceptorResponse<MethodSchema, StatusCode>, {
      get(target, property: keyof HttpInterceptorResponse<MethodSchema, StatusCode>) {
        const isHiddenProperty = (HTTP_INTERCEPTOR_RESPONSE_HIDDEN_BODY_PROPERTIES as Set<string>).has(property);
        if (isHiddenProperty) {
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

export default HttpInterceptorWorker;
