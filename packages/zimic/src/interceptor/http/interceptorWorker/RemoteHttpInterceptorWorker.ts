import { HttpResponse } from '@/http/types/requests';
import { HttpMethod, HttpServiceSchema } from '@/http/types/schema';
import { HttpHandlerCommit, ServerWebSocketSchema } from '@/server/types/schema';
import { getCrypto, IsomorphicCrypto } from '@/utils/crypto';
import { createURLIgnoringNonPathComponents, deserializeRequest, serializeResponse, validatedURL } from '@/utils/fetch';
import { WebSocket } from '@/websocket/types';
import WebSocketClient from '@/websocket/WebSocketClient';

import HttpInterceptorClient, { AnyHttpInterceptorClient } from '../interceptor/HttpInterceptorClient';
import NotStartedHttpInterceptorWorkerError from './errors/NotStartedHttpInterceptorWorkerError';
import UnknownHttpInterceptorWorkerPlatform from './errors/UnknownHttpInterceptorWorkerPlatform';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpInterceptorWorkerPlatform, RemoteHttpInterceptorWorkerOptions } from './types/options';
import { PublicRemoteHttpInterceptorWorker } from './types/public';
import { HttpResponseFactory, HttpResponseFactoryContext } from './types/requests';

export const SUPPORTED_BASE_URL_PROTOCOLS = ['http', 'https'];

interface HttpHandler {
  id: string;
  url: string;
  method: HttpMethod;
  interceptor: AnyHttpInterceptorClient;
  createResponse: (context: HttpResponseFactoryContext) => Promise<HttpResponse | null>;
}

class RemoteHttpInterceptorWorker extends HttpInterceptorWorker implements PublicRemoteHttpInterceptorWorker {
  readonly type = 'remote';

  private _crypto?: IsomorphicCrypto;

  private _serverURL: string;
  private webSocketClient: WebSocketClient<ServerWebSocketSchema>;

  private httpHandlers = new Map<HttpHandler['id'], HttpHandler>();

  constructor(options: RemoteHttpInterceptorWorkerOptions) {
    super();

    this._serverURL = validatedURL(options.serverURL, { protocols: SUPPORTED_BASE_URL_PROTOCOLS });

    const webSocketServerURL = new URL(this._serverURL);
    webSocketServerURL.protocol = 'ws:';

    this.webSocketClient = new WebSocketClient({
      url: webSocketServerURL.toString(),
    });
  }

  private async crypto() {
    if (!this._crypto) {
      this._crypto = await getCrypto();
    }
    return this._crypto;
  }

  serverURL() {
    return this._serverURL.toString();
  }

  async start() {
    if (super.isRunning()) {
      return;
    }

    super.ensureEmptyRunningInstance();

    await this.webSocketClient.start();
    this.webSocketClient.onEvent('interceptors/responses/create', this.createResponse);

    super.setPlatform(await this.readPlatform());
    super.markAsRunningInstance();
    super.setIsRunning(true);
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

  private async readPlatform(): Promise<HttpInterceptorWorkerPlatform> {
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
     * Ignoring because checking unknown platforms is currently not possible in Vitest */
    throw new UnknownHttpInterceptorWorkerPlatform();
  }

  async stop() {
    if (!super.isRunning()) {
      return;
    }

    await this.clearHandlers();
    this.webSocketClient.offEvent('interceptors/responses/create', this.createResponse);
    await this.webSocketClient.stop();

    super.setIsRunning(false);
    super.clearRunningInstance();
  }

  async use<Schema extends HttpServiceSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    url: string,
    createResponse: HttpResponseFactory,
  ) {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorWorkerError();
    }

    const crypto = await this.crypto();
    const normalizedURL = createURLIgnoringNonPathComponents(url).toString();

    const handler: HttpHandler = {
      id: crypto.randomUUID(),
      url: normalizedURL,
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
      url: normalizedURL,
      method,
    });
  }

  async clearHandlers() {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorWorkerError();
    }

    this.httpHandlers.clear();

    await this.webSocketClient.request('interceptors/workers/use/reset', undefined);
  }

  async clearInterceptorHandlers<Schema extends HttpServiceSchema>(interceptor: HttpInterceptorClient<Schema>) {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorWorkerError();
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
