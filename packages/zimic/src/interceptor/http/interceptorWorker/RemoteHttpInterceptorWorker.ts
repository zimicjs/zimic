import { HttpResponse } from '@/http/types/requests';
import { HttpMethod, HttpServiceSchema } from '@/http/types/schema';
import { HttpHandlerCommit, InterceptorServerWebSocketSchema } from '@/interceptor/server/types/schema';
import { importCrypto, IsomorphicCrypto } from '@/utils/crypto';
import { deserializeRequest, serializeResponse } from '@/utils/fetch';
import { importMSWBrowser, importMSWNode } from '@/utils/msw';
import { createURL, ensureUniquePathParams, excludeNonPathParams, ExtendedURL } from '@/utils/urls';
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
  url: string;
  method: HttpMethod;
  interceptor: AnyHttpInterceptorClient;
  createResponse: (context: HttpResponseFactoryContext) => Promise<HttpResponse | null>;
}

class RemoteHttpInterceptorWorker extends HttpInterceptorWorker {
  readonly type: 'remote';

  private _crypto?: IsomorphicCrypto;

  private webSocketClient: WebSocketClient<InterceptorServerWebSocketSchema>;
  private httpHandlers = new Map<HttpHandler['id'], HttpHandler>();

  constructor(options: RemoteHttpInterceptorWorkerOptions) {
    super();
    this.type = options.type;

    const webSocketServerURL = this.deriveWebSocketServerURL(options.serverURL);
    this.webSocketClient = new WebSocketClient({
      url: webSocketServerURL.toString(),
    });
  }

  private deriveWebSocketServerURL(serverURL: ExtendedURL) {
    const webSocketServerURL = createURL(serverURL);
    webSocketServerURL.protocol = serverURL.protocol.replace(/^http(s)?:$/, 'ws$1:');
    return webSocketServerURL;
  }

  private async crypto() {
    if (!this._crypto) {
      this._crypto = await importCrypto();
    }
    return this._crypto;
  }

  async start() {
    await super.sharedStart(async () => {
      await this.webSocketClient.start();
      this.webSocketClient.onEvent('interceptors/responses/create', this.createResponse);

      const platform = await this.readPlatform();
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
      } else {
        await super.handleUnhandledRequest(request);
        return { response: null };
      }
    } catch (error) {
      console.error(error);
      await super.handleUnhandledRequest(request);
      return { response: null };
    }
  };

  private async readPlatform(): Promise<HttpInterceptorPlatform> {
    const { setupServer } = await importMSWNode();
    if (typeof setupServer !== 'undefined') {
      return 'node';
    }

    const { setupWorker } = await importMSWBrowser();
    /* istanbul ignore else -- @preserve */
    if (typeof setupWorker !== 'undefined') {
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
      await this.webSocketClient.stop();

      super.setIsRunning(false);
    });
  }

  async use<Schema extends HttpServiceSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    rawURL: string | URL,
    createResponse: HttpResponseFactory,
  ) {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorError();
    }

    const crypto = await this.crypto();
    const url = excludeNonPathParams(createURL(rawURL)).toString();
    ensureUniquePathParams(url);

    const handler: HttpHandler = {
      id: crypto.randomUUID(),
      url,
      method,
      interceptor,
      async createResponse(context) {
        const result = await createResponse(context);
        return result.bypass ? null : result.response;
      },
    };

    this.httpHandlers.set(handler.id, handler);

    await this.webSocketClient.request('interceptors/workers/use/commit', {
      id: handler.id,
      url,
      method,
    });
  }

  async clearHandlers() {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorError();
    }

    this.httpHandlers.clear();

    await this.webSocketClient.request('interceptors/workers/use/reset', undefined);
  }

  async clearInterceptorHandlers<Schema extends HttpServiceSchema>(interceptor: HttpInterceptorClient<Schema>) {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorError();
    }

    for (const handler of this.httpHandlers.values()) {
      if (handler.interceptor === interceptor) {
        this.httpHandlers.delete(handler.id);
      }
    }

    const groupsToRecommit = Array.from<HttpHandler, HttpHandlerCommit>(this.httpHandlers.values(), (handler) => ({
      id: handler.id,
      url: handler.url,
      method: handler.method,
    }));

    await this.webSocketClient.request('interceptors/workers/use/reset', groupsToRecommit);
  }

  interceptorsWithHandlers() {
    const interceptors = Array.from(this.httpHandlers.values(), (handler) => handler.interceptor);
    return interceptors;
  }
}

export default RemoteHttpInterceptorWorker;
