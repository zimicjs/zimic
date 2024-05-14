import { HttpResponse } from '@/http/types/requests';
import { HttpMethod, HttpServiceSchema } from '@/http/types/schema';
import { HttpHandlerCommit, ServerWebSocketSchema } from '@/server/types/schema';
import { getCrypto, IsomorphicCrypto } from '@/utils/crypto';
import { deserializeRequest, serializeResponse } from '@/utils/fetch';
import { excludeNonPathParams, ExtendedURL, ensureUniquePathParams } from '@/utils/urls';
import { WebSocket } from '@/webSocket/types';
import WebSocketClient from '@/webSocket/WebSocketClient';

import NotStartedHttpInterceptorError from '../interceptor/errors/NotStartedHttpInterceptorError';
import UnknownHttpInterceptorPlatform from '../interceptor/errors/UnknownHttpInterceptorPlatform';
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

  private webSocketClient: WebSocketClient<ServerWebSocketSchema>;

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
    const webSocketServerURL = new URL(serverURL);
    webSocketServerURL.protocol = serverURL.protocol.replace(/^http(s)?:$/, 'ws$1:');
    return webSocketServerURL;
  }

  private async crypto() {
    if (!this._crypto) {
      this._crypto = await getCrypto();
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
    message: WebSocket.ServiceEventMessage<ServerWebSocketSchema, 'interceptors/responses/create'>,
  ) => {
    const { handlerId, request: serializedRequest } = message.data;

    const handler = this.httpHandlers.get(handlerId);
    const request = deserializeRequest(serializedRequest);
    const rawResponse = (await handler?.createResponse({ request })) ?? null;
    const response = rawResponse && request.method === 'HEAD' ? new Response(null, rawResponse) : rawResponse;

    const serializedResponse = response ? await serializeResponse(response) : null;
    return { response: serializedResponse };
  };

  private async readPlatform(): Promise<HttpInterceptorPlatform> {
    const { setupServer } = await import('msw/node');
    if (typeof setupServer !== 'undefined') {
      return 'node';
    }

    const { setupWorker } = await import('msw/browser');
    /* istanbul ignore else -- @preserve */
    if (typeof setupWorker !== 'undefined') {
      return 'browser';
    }

    /* istanbul ignore next -- @preserve
     * Ignoring because checking unknown platforms is currently not possible in our Vitest setup. */
    throw new UnknownHttpInterceptorPlatform();
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
    const url = excludeNonPathParams(new URL(rawURL)).toString();
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
