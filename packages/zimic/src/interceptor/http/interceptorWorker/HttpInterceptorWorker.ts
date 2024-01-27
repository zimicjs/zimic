import { HttpResponse as MSWHttpResponse, SharedOptions, http, passthrough } from 'msw';

import { Default } from '@/types/utils';

import {
  HttpInterceptorMethod,
  HttpInterceptorMethodSchema,
  HttpInterceptorResponseSchemaStatusCode,
} from '../interceptor/types/schema';
import { HttpInterceptorRequest, HttpInterceptorResponse } from '../requestTracker/types/requests';
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
      await this._worker.start({ ...sharedOptions, quiet: true });
    } else {
      this._worker.listen(sharedOptions);
    }

    this._isRunning = true;
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

  createResponseFromDeclaration<Declaration extends { status: number; body?: DefaultBody }>(
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

  async parseRawRequest<MethodSchema extends HttpInterceptorMethodSchema>(
    request: HttpRequest,
  ): Promise<HttpInterceptorRequest<MethodSchema>> {
    const parsedBody = await this.parseRawBody(request);

    const proxyRequest = new Proxy(request as unknown as HttpInterceptorRequest<MethodSchema>, {
      get(target, property) {
        if (property === 'body') {
          return parsedBody;
        }
        return Reflect.get(target, property, target) as unknown;
      },
    });

    return proxyRequest;
  }

  async parseRawResponse<
    MethodSchema extends HttpInterceptorMethodSchema,
    StatusCode extends HttpInterceptorResponseSchemaStatusCode<Default<MethodSchema['response']>>,
  >(response: HttpResponse): Promise<HttpInterceptorResponse<MethodSchema, StatusCode>> {
    const parsedBody = await this.parseRawBody(response);

    const proxyRequest = new Proxy(response as unknown as HttpInterceptorResponse<MethodSchema, StatusCode>, {
      get(target, property) {
        if (property === 'body') {
          return parsedBody;
        }
        return Reflect.get(target, property, target) as unknown;
      },
    });

    return proxyRequest;
  }

  async parseRawBody<Body extends DefaultBody>(requestOrResponse: HttpRequest<Body> | HttpResponse<Body>) {
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
