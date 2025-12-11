import { HttpMethod, HttpSchema } from '@zimic/http';
import validatePathParams from '@zimic/utils/url/validatePathParams';

import { HttpHandlerCommit, InterceptorServerWebSocketSchema } from '@/server/types/schema';
import { importCrypto } from '@/utils/crypto';
import { isClientSide, isServerSide } from '@/utils/environment';
import { deserializeRequest, serializeResponse } from '@/utils/fetch';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import { WebSocketEventMessage } from '@/webSocket/types';
import WebSocketClient from '@/webSocket/WebSocketClient';

import NotRunningHttpInterceptorError from '../interceptor/errors/NotRunningHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from '../interceptor/errors/UnknownHttpInterceptorPlatformError';
import HttpInterceptorClient, { AnyHttpInterceptorClient } from '../interceptor/HttpInterceptorClient';
import { HttpInterceptorPlatform } from '../interceptor/types/options';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpHandlerActionResult, HttpResponseFactoryContext } from './types/http';
import { MSWHttpResponseFactory } from './types/msw';
import { RemoteHttpInterceptorWorkerOptions } from './types/options';

interface HttpHandler {
  id: string;
  baseURL: string;
  method: HttpMethod;
  path: string;
  interceptor: AnyHttpInterceptorClient;
  createResponse: (context: HttpResponseFactoryContext) => Promise<Response | HttpHandlerActionResult>;
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
      this.webSocketClient.onChannel('event', 'interceptors/responses/create', this.createResponse);
      this.webSocketClient.onChannel('event', 'interceptors/responses/unhandled', this.handleUnhandledServerRequest);

      await this.webSocketClient.start({
        parameters: this.auth ? { token: this.auth.token } : undefined,
        waitForAuthentication: true,
      });

      this.platform = this.readPlatform();
      this.isRunning = true;
    });
  }

  private createResponse = async (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/responses/create'>,
  ) => {
    const { handlerId, request: serializedRequest } = message.data;

    const handler = this.httpHandlers.get(handlerId);
    const request = deserializeRequest(serializedRequest);

    try {
      const rawResponse = (await handler?.createResponse({ request })) ?? null;

      // Check if the response is an action (bypass or reject)
      if (this.isActionResponse(rawResponse)) {
        // For remote interceptors, only reject is allowed
        if (rawResponse.action === 'reject') {
          return { response: null, action: 'reject' as const };
        }
        // Note: 'bypass' should not be reachable due to type safety, but handle it gracefully
        // Fall through to unhandled request handling
      } else if (rawResponse) {
        // At this point, rawResponse is guaranteed to be a Response
        const response = request.method === 'HEAD' ? new Response(null, rawResponse) : rawResponse;

        return { response: await serializeResponse(response) };
      }
    } catch (error) {
      console.error(error);
    }

    const strategy = await super.getUnhandledRequestStrategy(request, 'remote');
    await super.logUnhandledRequestIfNecessary(request, strategy);

    return { response: null };
  };

  private isActionResponse(value: unknown): value is { action: 'bypass' | 'reject' } {
    if (value === null || typeof value !== 'object') {
      return false;
    }
    const action = (value as { action?: string }).action;
    return action === 'bypass' || action === 'reject';
  }

  private handleUnhandledServerRequest = async (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/responses/unhandled'>,
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
      this.webSocketClient.offChannel('event', 'interceptors/responses/create', this.createResponse);
      this.webSocketClient.offChannel('event', 'interceptors/responses/unhandled', this.handleUnhandledServerRequest);

      await this.clearHandlers();

      await this.webSocketClient.stop();

      this.isRunning = false;
    });
  }

  async use<Schema extends HttpSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    path: string,
    createResponse: MSWHttpResponseFactory,
  ) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    validatePathParams(path);

    const crypto = await importCrypto();

    const handler: HttpHandler = {
      id: crypto.randomUUID(),
      baseURL: interceptor.baseURLAsString,
      method,
      path,
      interceptor,
      async createResponse(context) {
        const response = await createResponse(context);
        return response;
      },
    };

    this.httpHandlers.set(handler.id, handler);

    await this.webSocketClient.request('interceptors/workers/commit', {
      id: handler.id,
      baseURL: handler.baseURL,
      method: handler.method,
      path: handler.path,
    });
  }

  async clearHandlers<Schema extends HttpSchema>(
    options: {
      interceptor?: HttpInterceptorClient<Schema>;
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

    if (!this.webSocketClient.isRunning) {
      return;
    }

    const handlersToRecommit = Array.from<HttpHandler, HttpHandlerCommit>(this.httpHandlers.values(), (handler) => ({
      id: handler.id,
      baseURL: handler.baseURL,
      method: handler.method,
      path: handler.path,
    }));

    try {
      await this.webSocketClient.request('interceptors/workers/reset', handlersToRecommit);
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

  get interceptorsWithHandlers() {
    const interceptors = Array.from(this.httpHandlers.values(), (handler) => handler.interceptor);
    return interceptors;
  }
}

export default RemoteHttpInterceptorWorker;
