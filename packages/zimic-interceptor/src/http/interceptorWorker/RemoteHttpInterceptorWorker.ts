import { HttpResponse, HttpMethod, HttpSchema } from '@zimic/http';
import * as mswBrowser from 'msw/browser';
import * as mswNode from 'msw/node';

import { HttpHandlerCommit, InterceptorServerWebSocketSchema } from '@/server/types/schema';
import { importCrypto } from '@/utils/crypto';
import { deserializeRequest, serializeResponse } from '@/utils/fetch';
import { createURL, ExtendedURL } from '@/utils/urls';
import { WebSocket } from '@/webSocket/types';
import WebSocketClient from '@/webSocket/WebSocketClient';

import NotStartedHttpInterceptorError from '../interceptor/errors/NotStartedHttpInterceptorError';
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
  readonly type: 'remote';

  private _webSocketClient: WebSocketClient<InterceptorServerWebSocketSchema>;
  private httpHandlers = new Map<HttpHandler['id'], HttpHandler>();

  constructor(options: RemoteHttpInterceptorWorkerOptions) {
    super();
    this.type = options.type;

    const webSocketServerURL = this.deriveWebSocketServerURL(options.serverURL);
    this._webSocketClient = new WebSocketClient({
      url: webSocketServerURL.toString(),
    });
  }

  private deriveWebSocketServerURL(serverURL: ExtendedURL) {
    const webSocketServerURL = createURL(serverURL);
    webSocketServerURL.protocol = serverURL.protocol.replace(/^http(s)?:$/, 'ws$1:');
    return webSocketServerURL;
  }

  webSocketClient() {
    return this._webSocketClient;
  }

  async start() {
    await super.sharedStart(async () => {
      await this._webSocketClient.start();

      this._webSocketClient.onEvent('interceptors/responses/create', this.createResponse);
      this._webSocketClient.onEvent('interceptors/responses/unhandled', this.handleUnhandledServerRequest);

      const platform = this.readPlatform();
      super.setPlatform(platform);
      super.setIsRunning(true);
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
    if (typeof mswNode.setupServer !== 'undefined') {
      return 'node';
    }

    /* istanbul ignore else -- @preserve */
    if (typeof mswBrowser.setupWorker !== 'undefined') {
      return 'browser';
    }

    /* istanbul ignore next -- @preserve
     * Ignoring because checking unknown platforms is not configured in our test setup. */
    throw new UnknownHttpInterceptorPlatformError();
  }

  async stop() {
    await super.sharedStop(async () => {
      await this.clearHandlers();

      this._webSocketClient.offEvent('interceptors/responses/create', this.createResponse);
      this._webSocketClient.offEvent('interceptors/responses/unhandled', this.handleUnhandledServerRequest);

      await this._webSocketClient.stop();

      super.setIsRunning(false);
    });
  }

  async use<Schema extends HttpSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    rawURL: string | URL,
    createResponse: HttpResponseFactory,
  ) {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorError();
    }

    const crypto = await importCrypto();

    const url = createURL(rawURL, {
      excludeNonPathParams: true,
      ensureUniquePathParams: true,
    });

    const handler: HttpHandler = {
      id: crypto.randomUUID(),
      url: {
        base: interceptor.baseURL().toString(),
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

    await this._webSocketClient.request('interceptors/workers/use/commit', {
      id: handler.id,
      url: handler.url,
      method,
    });
  }

  async clearHandlers() {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorError();
    }

    this.httpHandlers.clear();

    if (this._webSocketClient.isRunning()) {
      await this._webSocketClient.request('interceptors/workers/use/reset', undefined);
    }
  }

  async clearInterceptorHandlers<Schema extends HttpSchema>(interceptor: HttpInterceptorClient<Schema>) {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorError();
    }

    for (const handler of this.httpHandlers.values()) {
      if (handler.interceptor === interceptor) {
        this.httpHandlers.delete(handler.id);
      }
    }

    if (this._webSocketClient.isRunning()) {
      const groupsToRecommit = Array.from<HttpHandler, HttpHandlerCommit>(this.httpHandlers.values(), (handler) => ({
        id: handler.id,
        url: handler.url,
        method: handler.method,
      }));

      await this._webSocketClient.request('interceptors/workers/use/reset', groupsToRecommit);
    }
  }

  interceptorsWithHandlers() {
    const interceptors = Array.from(this.httpHandlers.values(), (handler) => handler.interceptor);
    return interceptors;
  }
}

export default RemoteHttpInterceptorWorker;
