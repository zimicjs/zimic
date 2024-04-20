import { ServerWebSocketSchema } from '@/cli/server/types/schema';
import { HttpResponse } from '@/http/types/requests';
import { HttpMethod, HttpServiceSchema } from '@/http/types/schema';
import { deserializeRequest, serializeResponse } from '@/utils/fetch';
import WebSocketClient from '@/websocket/WebSocketClient';

import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import UnknownHttpInterceptorWorkerPlatform from './errors/UnknownHttpInterceptorWorkerPlatform';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpInterceptorWorkerPlatform, RemoteHttpInterceptorWorkerOptions } from './types/options';
import { PublicRemoteHttpInterceptorWorker } from './types/public';
import { HttpRequestHandler, HttpRequestHandlerContext } from './types/requests';

type HttpHandler = (context: HttpRequestHandlerContext) => Promise<HttpResponse | null>;

class RemoteHttpInterceptorWorker extends HttpInterceptorWorker implements PublicRemoteHttpInterceptorWorker {
  readonly type = 'remote';

  private _httpURL: URL;
  private websocketClient: WebSocketClient<ServerWebSocketSchema>;

  private httpHandlers: {
    [Method in HttpMethod]: Map<
      string,
      {
        interceptor: HttpInterceptorClient<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
        httpHandler: HttpHandler;
      }
    >;
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

    this._httpURL = new URL(options.mockServerURL);

    const webSocketURL = new URL(this._httpURL);
    webSocketURL.protocol = 'ws';

    this.websocketClient = new WebSocketClient({
      url: webSocketURL.toString(),
    });
  }

  mockServerURL() {
    return this._httpURL.toString();
  }

  async start() {
    this.setPlatform(await this.readPlatform());

    await this.websocketClient.start();

    this.websocketClient.onEvent('interceptors/responses/create', async (message) => {
      const { request: serializedRequest } = message.data;
      const request = deserializeRequest(serializedRequest);

      const httpHandlerGroup = this.httpHandlers[request.method as HttpMethod].get(request.url);

      if (!httpHandlerGroup) {
        return { response: null };
      }

      const { httpHandler } = httpHandlerGroup;
      const response = await httpHandler({ request });
      const serializedResponse = response ? await serializeResponse(response) : null;
      return { response: serializedResponse };
    });

    this.setIsRunning(true);
  }

  private async readPlatform() {
    const { setupServer } = await import('msw/node');
    if (typeof setupServer !== 'undefined') {
      return 'node' satisfies HttpInterceptorWorkerPlatform;
    }

    const { setupWorker } = await import('msw/browser');
    if (typeof setupWorker !== 'undefined') {
      return 'browser' satisfies HttpInterceptorWorkerPlatform;
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
    const interceptors = new Set<HttpInterceptorClient<any>>(); // eslint-disable-line @typescript-eslint/no-explicit-any

    for (const methodHandlers of Object.values(this.httpHandlers)) {
      for (const { interceptor } of methodHandlers.values()) {
        interceptors.add(interceptor);
      }
    }

    return Array.from(interceptors);
  }
}

export default RemoteHttpInterceptorWorker;
