import { HttpResponse, HttpMethod, HttpSchema } from '@zimic/http';
import excludeURLParams from '@zimic/utils/url/excludeURLParams';
import validateURLPathParams from '@zimic/utils/url/validateURLPathParams';

import { HttpHandlerCommit, InterceptorServerWebSocketSchema } from '@/server/types/schema';
import { importCrypto } from '@/utils/crypto';
import { isClientSide, isServerSide } from '@/utils/environment';
import { deserializeRequest, serializeResponse } from '@/utils/fetch';
import { WebSocket } from '@/webSocket/types';
import WebSocketClient from '@/webSocket/WebSocketClient';

import NotRunningHttpInterceptorError from '../interceptor/errors/NotRunningHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from '../interceptor/errors/UnknownHttpInterceptorPlatformError';
import HttpInterceptorClient, { AnyHttpInterceptorClient } from '../interceptor/HttpInterceptorClient';
import { HttpInterceptorPlatform } from '../interceptor/types/options';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { RemoteHttpInterceptorWorkerOptions } from './types/options';
import { HttpResponseFactory, HttpResponseFactoryContext } from './types/requests';

interface HttpHandler {
  id: string;
  url: { base: string; full: string };
  method: HttpMethod;
  interceptor: AnyHttpInterceptorClient;
  createResponse: (context: HttpResponseFactoryContext) => Promise<HttpResponse | null>;
}

class RemoteHttpInterceptorWorker extends HttpInterceptorWorker {
  webSocketClient: WebSocketClient<InterceptorServerWebSocketSchema>;

  private httpHandlers = new Map<HttpHandler['id'], HttpHandler>();

  constructor(options: RemoteHttpInterceptorWorkerOptions) {
    super();

    const webSocketServerURL = this.deriveWebSocketServerURL(options.serverURL);
    this.webSocketClient = new WebSocketClient({
      url: webSocketServerURL.toString(),
    });
  }

  get type() {
    return 'remote' as const;
  }

  private deriveWebSocketServerURL(serverURL: URL) {
    const webSocketServerURL = new URL(serverURL);
    webSocketServerURL.protocol = serverURL.protocol.replace(/^http(s)?:$/, 'ws$1:');
    return webSocketServerURL;
  }

  async start() {
    await super.sharedStart(async () => {
      await this.webSocketClient.start();

      this.webSocketClient.onEvent('interceptors/responses/create', this.createResponse);
      this.webSocketClient.onEvent('interceptors/responses/unhandled', this.handleUnhandledServerRequest);

      this.platform = this.readPlatform();
      this.isRunning = true;
    });
  }

  private createResponse = async (
    message: WebSocket.ServiceEventMessage<InterceptorServerWebSocketSchema, 'interceptors/responses/create'>,
  ) => {
    const { handlerId, request: serializedRequest } = message.data;

    const handler = this.httpHandlers.get(handlerId);
    const request = deserializeRequest(serializedRequest);

    try {
      const rawResponse = (await handler?.createResponse({ request })) ?? null;
      const response = rawResponse && request.method === 'HEAD' ? new Response(null, rawResponse) : rawResponse;

      if (response) {
        return { response: await serializeResponse(response) };
      }
    } catch (error) {
      console.error(error);
    }

    const strategy = await super.getUnhandledRequestStrategy(request, 'remote');
    await super.logUnhandledRequestIfNecessary(request, strategy);

    return { response: null };
  };

  private handleUnhandledServerRequest = async (
    message: WebSocket.ServiceEventMessage<InterceptorServerWebSocketSchema, 'interceptors/responses/unhandled'>,
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
      await this.clearHandlers();

      this.webSocketClient.offEvent('interceptors/responses/create', this.createResponse);
      this.webSocketClient.offEvent('interceptors/responses/unhandled', this.handleUnhandledServerRequest);

      await this.webSocketClient.stop();

      this.isRunning = false;
    });
  }

  async use<Schema extends HttpSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    rawURL: string | URL,
    createResponse: HttpResponseFactory,
  ) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    const crypto = await importCrypto();

    const url = new URL(rawURL);
    excludeURLParams(url);
    validateURLPathParams(url);

    const handler: HttpHandler = {
      id: crypto.randomUUID(),
      url: {
        base: interceptor.baseURLAsString,
        full: url.toString(),
      },
      method,
      interceptor,
      async createResponse(context) {
        const response = await createResponse(context);
        return response;
      },
    };

    this.httpHandlers.set(handler.id, handler);

    await this.webSocketClient.request('interceptors/workers/use/commit', {
      id: handler.id,
      url: handler.url,
      method,
    });
  }

  async clearHandlers() {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    this.httpHandlers.clear();

    if (this.webSocketClient.isRunning) {
      await this.webSocketClient.request('interceptors/workers/use/reset', undefined);
    }
  }

  async clearInterceptorHandlers<Schema extends HttpSchema>(interceptor: HttpInterceptorClient<Schema>) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    for (const handler of this.httpHandlers.values()) {
      if (handler.interceptor === interceptor) {
        this.httpHandlers.delete(handler.id);
      }
    }

    if (this.webSocketClient.isRunning) {
      const groupsToRecommit = Array.from<HttpHandler, HttpHandlerCommit>(this.httpHandlers.values(), (handler) => ({
        id: handler.id,
        url: handler.url,
        method: handler.method,
      }));

      await this.webSocketClient.request('interceptors/workers/use/reset', groupsToRecommit);
    }
  }

  get interceptorsWithHandlers() {
    const interceptors = Array.from(this.httpHandlers.values(), (handler) => handler.interceptor);
    return interceptors;
  }
}

export default RemoteHttpInterceptorWorker;
