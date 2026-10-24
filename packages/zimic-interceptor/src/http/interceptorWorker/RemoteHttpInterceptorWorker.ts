import type {
  HttpBody,
  HttpHeadersInit,
  HttpMethod,
  HttpRequest,
  HttpSchema,
  HttpSchemaMethod,
  HttpSchemaPath,
  HttpStatusCode,
} from '@zimic/http';
import { createRegexFromPath, validatePathParams } from '@zimic/utils/url';

import { INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER } from '@/interceptor/constants';
import UnsupportedResponseBypassError from '@/server/errors/UnsupportedResponseBypassError';
import { HttpWorkerReset, InterceptorServerWebSocketSchema } from '@/server/types/schema';
import { isClientSide, isServerSide } from '@/utils/environment';
import { deserializeRequest, serializeResponse } from '@/utils/fetch';
import { methodCanHaveResponseBody } from '@/utils/http';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import { WebSocketEventMessage } from '@/utils/webSocket/types';
import WebSocketClient from '@/utils/webSocket/WebSocketClient';

import NotRunningHttpInterceptorError from '../interceptor/errors/NotRunningHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from '../interceptor/errors/UnknownHttpInterceptorPlatformError';
import HttpInterceptorImplementation, {
  AnyHttpInterceptorImplementation,
} from '../interceptor/HttpInterceptorImplementation';
import { HttpInterceptorPlatform, UnhandledRequestStrategy } from '../interceptor/types/options';
import type HttpRequestHandlerImplementation from '../requestHandler/HttpRequestHandlerImplementation';
import HttpInterceptorWorker, { HttpHandler } from './HttpInterceptorWorker';
import { RemoteHttpInterceptorWorkerOptions } from './types/options';

class RemoteHttpInterceptorWorker extends HttpInterceptorWorker {
  private httpHandlersByMethod: {
    [Method in HttpMethod]: HttpHandler[];
  } = {
    GET: [],
    POST: [],
    PATCH: [],
    PUT: [],
    DELETE: [],
    HEAD: [],
    OPTIONS: [],
  };

  webSocketClient: WebSocketClient<InterceptorServerWebSocketSchema>;
  private isConnectedToServer = false;
  private auth?: RemoteHttpInterceptorWorkerOptions['auth'];

  constructor(options: RemoteHttpInterceptorWorkerOptions) {
    super();

    this.webSocketClient = new WebSocketClient({
      url: this.getWebSocketServerURL(options.serverURL).toString(),
    });

    this.auth = options.auth;
  }

  get type() {
    return 'remote' as const;
  }

  private getWebSocketServerURL(serverURL: URL) {
    const webSocketServerURL = new URL(serverURL);
    webSocketServerURL.protocol = serverURL.protocol.replace(/^http(s)?:$/, 'ws$1:');
    return webSocketServerURL;
  }

  async start() {
    await super.sharedStart(async () => {
      this.webSocketClient.onChannel('event', 'interceptors/http/responses/create', this.createResponse);

      this.webSocketClient.onChannel(
        'event',
        'interceptors/http/responses/unhandled',
        this.handleUnhandledServerRequest,
      );

      await this.webSocketClient.start({
        parameters: {
          [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
          ...(this.auth ? { token: this.auth.token } : {}),
        },
        waitForAuthentication: true,
      });

      // Resets are sent only from here on, because the socket opens before the server authenticates it and messages
      // sent in between are never answered. This first reset includes the interceptors registered until now.
      this.isConnectedToServer = true;

      try {
        await this.resetServerWorker();
      } catch (error) {
        // Stopping returns early while the worker is not running, so the connection is closed here.
        await this.disconnectFromServer();
        throw error;
      }

      this.platform = this.readPlatform();
      this.isRunning = true;
    });
  }

  async registerRunningInterceptor(interceptor: AnyHttpInterceptorImplementation) {
    await super.registerRunningInterceptor(interceptor);
    await this.resetServerWorker();
  }

  async unregisterRunningInterceptor(interceptor: AnyHttpInterceptorImplementation) {
    await super.unregisterRunningInterceptor(interceptor);
    await this.resetServerWorker();
  }

  private createResponse = async (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/http/responses/create'>,
  ) => {
    const request = deserializeRequest(message.data.request);

    const methodHandlers = this.httpHandlersByMethod[request.method as HttpMethod];
    const {
      response: rawResponse,
      matchedSomeHandler,
      error,
    } = await this.createResponseWithHandlers(request, methodHandlers);

    if (!rawResponse) {
      return { response: null, matchedSomeHandler, error };
    }

    const response = methodCanHaveResponseBody(request.method as HttpMethod)
      ? rawResponse
      : new Response(null, rawResponse);

    return { response: await serializeResponse(response), matchedSomeHandler };
  };

  private handleUnhandledServerRequest = async (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/http/responses/unhandled'>,
  ) => {
    const { request: serializedRequest } = message.data;
    const request = deserializeRequest(serializedRequest);

    const strategy = await super.getUnhandledRequestStrategy(request, 'remote');
    const { wasLogged } = await super.logUnhandledRequestIfNecessary(request, strategy);

    return { wasLogged };
  };

  private readPlatform(): HttpInterceptorPlatform {
    if (isServerSide()) {
      return 'node';
    }
    /* istanbul ignore else -- @preserve */
    if (isClientSide()) {
      return 'browser';
    }
    /* istanbul ignore next -- @preserve
     * Ignoring because checking unknown platforms is not configured in our test setup. */
    throw new UnknownHttpInterceptorPlatformError();
  }

  async stop() {
    await super.sharedStop(async () => {
      this.webSocketClient.offChannel('event', 'interceptors/http/responses/create', this.createResponse);

      this.webSocketClient.offChannel(
        'event',
        'interceptors/http/responses/unhandled',
        this.handleUnhandledServerRequest,
      );

      this.clearHandlers();

      await this.disconnectFromServer();

      this.isRunning = false;
    });
  }

  private async disconnectFromServer() {
    this.isConnectedToServer = false;

    // Stopping the client also removes its channel listeners.
    await this.webSocketClient.stop();
  }

  use<
    Schema extends HttpSchema,
    Method extends HttpSchemaMethod<Schema>,
    Path extends HttpSchemaPath<Schema, Method>,
    StatusCode extends HttpStatusCode,
  >(
    interceptor: HttpInterceptorImplementation<Schema>,
    handler: HttpRequestHandlerImplementation<Schema, Method, Path, StatusCode>,
  ) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    validatePathParams(handler.path);

    this.httpHandlersByMethod[handler.method].push({
      interceptor,
      implementation: handler,
      pathRegex: createRegexFromPath(handler.path),
    });
  }

  private async resetServerWorker() {
    if (!this.isConnectedToServer || !this.webSocketClient.isRunning) {
      return;
    }

    const reset: HttpWorkerReset = {
      interceptorBaseURLs: this.runningInterceptors.map((interceptor) => interceptor.baseURLAsString),
    };

    try {
      await this.webSocketClient.request('interceptors/http/workers/reset', reset);
    } catch (error) {
      /* istanbul ignore next -- @preserve
       *
       * If the socket is closed before receiving a response, the message is aborted with an error. This can happen if
       * we send a request message and the interceptor server closes the socket before sending a response. In this case,
       * we can safely ignore the error because we know that the server is shutting down and resetting is no longer
       * necessary.
       *
       * Due to the rare nature of this edge case, we can't reliably reproduce it in tests. */
      const isMessageAbortError = error instanceof WebSocketMessageAbortError;

      /* istanbul ignore next -- @preserve */
      if (!isMessageAbortError) {
        throw error;
      }
    }
  }

  async createResponseFromDeclaration(
    request: HttpRequest,
    declaration:
      { status: number; headers?: HttpHeadersInit; body?: HttpBody } | { action: UnhandledRequestStrategy.Action },
  ) {
    const response = await super.createResponseFromDeclaration(request, declaration);

    if (response && HttpInterceptorWorker.isBypassedResponse(response)) {
      throw new UnsupportedResponseBypassError();
    }

    if (response && HttpInterceptorWorker.isRejectedResponse(response)) {
      return response;
    }

    return response;
  }

  clearHandlers<Schema extends HttpSchema>(
    options: {
      interceptor?: HttpInterceptorImplementation<Schema>;
    } = {},
  ) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    if (options.interceptor === undefined) {
      for (const handlers of Object.values(this.httpHandlersByMethod)) {
        handlers.length = 0;
      }
    } else {
      for (const [method, handlers] of Object.entries(this.httpHandlersByMethod)) {
        this.httpHandlersByMethod[method] = handlers.filter((handler) => handler.interceptor !== options.interceptor);
      }
    }
  }
}

export default RemoteHttpInterceptorWorker;
