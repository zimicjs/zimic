import { ServerWebSocketSchema } from '@/cli/server/types/schema';
import { HttpResponse } from '@/http/types/requests';
import { HttpMethod, HttpServiceSchema } from '@/http/types/schema';
import { deserializeRequest, serializeResponse } from '@/utils/fetch';
import WebSocketClient from '@/websocket/WebSocketClient';

import HttpInterceptorClient, { AnyHttpInterceptorClient } from '../interceptor/HttpInterceptorClient';
import UnknownHttpInterceptorWorkerPlatform from './errors/UnknownHttpInterceptorWorkerPlatform';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpInterceptorWorkerPlatform, RemoteHttpInterceptorWorkerOptions } from './types/options';
import { PublicRemoteHttpInterceptorWorker } from './types/public';
import { HttpRequestHandler, HttpRequestHandlerContext } from './types/requests';

type HttpHandler = (context: HttpRequestHandlerContext) => Promise<HttpResponse | null>;

interface HttpHandlerGroup {
  interceptor: AnyHttpInterceptorClient;
  httpHandler: HttpHandler;
}

class RemoteHttpInterceptorWorker extends HttpInterceptorWorker implements PublicRemoteHttpInterceptorWorker {
  readonly type = 'remote';

  private _httpServerURL: URL;
  private websocketClient: WebSocketClient<ServerWebSocketSchema>;

  private httpHandlers: {
    [Method in HttpMethod]: Map<string, HttpHandlerGroup>;
  } = {
    GET: new Map(),
    POST: new Map(),
    PATCH: new Map(),
    PUT: new Map(),
    DELETE: new Map(),
    HEAD: new Map(),
    OPTIONS: new Map(),
  };

  constructor(options: RemoteHttpInterceptorWorkerOptions) {
    super();

    this._httpServerURL = new URL(options.mockServerURL);

    const webSocketServerURL = new URL(this._httpServerURL);
    webSocketServerURL.protocol = 'ws';

    this.websocketClient = new WebSocketClient({
      url: webSocketServerURL.toString(),
    });
  }

  mockServerURL() {
    return this._httpServerURL.toString();
  }

  async start() {
    await this.websocketClient.start();

    this.websocketClient.onEvent('interceptors/responses/create', async (message) => {
      const { request: serializedRequest } = message.data;

      const request = deserializeRequest(serializedRequest);
      const method = request.method as HttpMethod;
      const httpHandlerGroup = this.httpHandlers[method].get(request.url);

      if (!httpHandlerGroup) {
        return { response: null };
      }

      const { httpHandler } = httpHandlerGroup;
      const response = await httpHandler({ request });
      const serializedResponse = response ? await serializeResponse(response) : null;
      return { response: serializedResponse };
    });

    this.setPlatform(await this.readPlatform());

    this.setIsRunning(true);
  }

  private async readPlatform(): Promise<HttpInterceptorWorkerPlatform> {
    const { setupServer } = await import('msw/node');
    if (typeof setupServer !== 'undefined') {
      return 'node';
    }

    const { setupWorker } = await import('msw/browser');
    if (typeof setupWorker !== 'undefined') {
      return 'browser';
    }

    throw new UnknownHttpInterceptorWorkerPlatform();
  }

  async stop() {
    await this.websocketClient.stop();
    this.setIsRunning(false);
  }

  async use<Schema extends HttpServiceSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    url: string,
    handler: HttpRequestHandler,
  ) {
    const normalizedURL = super.normalizeUseURL(url);

    this.httpHandlers[method].set(normalizedURL, {
      interceptor,
      httpHandler: async (context) => {
        const result = await handler(context);
        return result.bypass ? null : result.response;
      },
    });

    await this.websocketClient.send('interceptors/workers/commit/use', {
      url: normalizedURL,
      method,
    });
  }

  async clearHandlers() {
    for (const methodHandlers of Object.values(this.httpHandlers)) {
      methodHandlers.clear();
    }
    await this.websocketClient.send('interceptors/workers/uncommit/use', undefined);
  }

  async clearInterceptorHandlers<Schema extends HttpServiceSchema>(interceptor: HttpInterceptorClient<Schema>) {
    const groupsToUncommit: { url: string; method: HttpMethod }[] = [];

    for (const [method, methodHandlers] of Object.entries(this.httpHandlers)) {
      for (const [url, httpHandlerGroup] of methodHandlers) {
        if (httpHandlerGroup.interceptor === interceptor) {
          groupsToUncommit.push({ url, method });
          methodHandlers.delete(url);
        }
      }
    }

    const uncommitPromises = groupsToUncommit.map(async ({ url, method }) => {
      await this.websocketClient.send('interceptors/workers/uncommit/use', { url, method });
    });
    await Promise.all(uncommitPromises);
  }

  interceptorsWithHandlers() {
    const interceptors = new Set<AnyHttpInterceptorClient>();

    for (const methodHandlers of Object.values(this.httpHandlers)) {
      for (const { interceptor } of methodHandlers.values()) {
        interceptors.add(interceptor);
      }
    }

    return Array.from(interceptors);
  }
}

export default RemoteHttpInterceptorWorker;
