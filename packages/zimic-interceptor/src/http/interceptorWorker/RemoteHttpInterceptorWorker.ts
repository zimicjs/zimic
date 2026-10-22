import type { HttpBody, HttpHeadersInit, HttpMethod, HttpRequest, HttpSchema } from '@zimic/http';
import type { PossiblePromise } from '@zimic/utils/types';
import { validatePathParams } from '@zimic/utils/url';

import { INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER } from '@/interceptor/constants';
import UnsupportedResponseBypassError from '@/server/errors/UnsupportedResponseBypassError';
import { HttpHandlerCommit, HttpWorkerReset, InterceptorServerWebSocketSchema } from '@/server/types/schema';
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
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpResponseFactory, HttpResponseFactoryContext } from './types/http';
import { RemoteHttpInterceptorWorkerOptions } from './types/options';

interface HttpHandler {
  id: string;
  baseURL: string;
  method: HttpMethod;
  path: string;
  interceptor: AnyHttpInterceptorImplementation;
  createResponse: (context: HttpResponseFactoryContext) => PossiblePromise<Response | null>;
}

class RemoteHttpInterceptorWorker extends HttpInterceptorWorker {
  private httpHandlers = new Map<HttpHandler['id'], HttpHandler>();

  webSocketClient: WebSocketClient<InterceptorServerWebSocketSchema>;
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

      // Interceptors register before the worker connects, so the server learns about them once connected.
      await this.resetServerWorker();

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
    const { handlerId, request: serializedRequest } = message.data;

    const handler = this.httpHandlers.get(handlerId);
    const request = deserializeRequest(serializedRequest);

    try {
      const rawResponse = (await handler?.createResponse({ request })) ?? null;

      if (rawResponse) {
        const response = methodCanHaveResponseBody(request.method as HttpMethod)
          ? rawResponse
          : new Response(null, rawResponse);

        return { response: await serializeResponse(response) };
      }
    } catch (error) {
      console.error(error);
      return { response: null, error: true };
    }

    return { response: null };
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

      await this.clearHandlers();

      await this.webSocketClient.stop();

      this.isRunning = false;
    });
  }

  async use<Schema extends HttpSchema>(
    interceptor: HttpInterceptorImplementation<Schema>,
    method: HttpMethod,
    path: string,
    createResponse: HttpResponseFactory,
  ) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    validatePathParams(path);

    const handler: HttpHandler = {
      id: crypto.randomUUID(),
      baseURL: interceptor.baseURLAsString,
      method,
      path,
      interceptor,
      createResponse,
    };

    this.httpHandlers.set(handler.id, handler);

    const handlerCommits = this.getHandlerCommitsByInterceptorStartOrder();
    const lastHandlerCommit = handlerCommits.at(-1);

    if (lastHandlerCommit?.id === handler.id) {
      await this.webSocketClient.request('interceptors/http/workers/commit', lastHandlerCommit);
    } else {
      // The server tries handlers from the last committed to the first and appends new commits, so a handler of an
      // interceptor started before others is placed by recommitting all handlers in order.
      await this.webSocketClient.request('interceptors/http/workers/reset', this.createWorkerReset(handlerCommits));
    }
  }

  private createWorkerReset(handlers: HttpHandlerCommit[]): HttpWorkerReset {
    return {
      interceptorBaseURLs: this.runningInterceptors.map((interceptor) => interceptor.baseURLAsString),
      handlers,
    };
  }

  private async resetServerWorker() {
    if (!this.webSocketClient.isRunning) {
      return;
    }

    const reset = this.createWorkerReset(this.getHandlerCommitsByInterceptorStartOrder());

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

  private getHandlerCommitsByInterceptorStartOrder() {
    const handlers = this.sortHandlersByInterceptorStartOrder(this.httpHandlers.values());

    return handlers.map<HttpHandlerCommit>((handler) => ({
      id: handler.id,
      baseURL: handler.baseURL,
      method: handler.method,
      path: handler.path,
    }));
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

  async clearHandlers<Schema extends HttpSchema>(
    options: {
      interceptor?: HttpInterceptorImplementation<Schema>;
    } = {},
  ) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    if (options.interceptor === undefined) {
      this.httpHandlers.clear();
    } else {
      for (const handler of this.httpHandlers.values()) {
        if (handler.interceptor === options.interceptor) {
          this.httpHandlers.delete(handler.id);
        }
      }
    }

    await this.resetServerWorker();
  }

  get interceptorsWithHandlers() {
    const interceptors = Array.from(this.httpHandlers.values(), (handler) => handler.interceptor);
    return interceptors;
  }
}

export default RemoteHttpInterceptorWorker;
