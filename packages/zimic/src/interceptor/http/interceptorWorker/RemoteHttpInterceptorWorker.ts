import { ServerWebSocketSchema } from '@/cli/server/types/schema';
import { HttpResponse } from '@/http/types/requests';
import { HttpMethod, HttpServiceSchema } from '@/http/types/schema';
import { deserializeRequest, serializeResponse } from '@/utils/fetch';
import WebSocketClient from '@/websocket/WebSocketClient';

import HttpInterceptorClient, { AnyHttpInterceptorClient } from '../interceptor/HttpInterceptorClient';
import NotStartedHttpInterceptorWorkerError from './errors/NotStartedHttpInterceptorWorkerError';
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
  private webSocketClient: WebSocketClient<ServerWebSocketSchema>;

  private httpHandlers: {
    [Method in HttpMethod]: Map<string, HttpHandlerGroup[]>;
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

    this.webSocketClient = new WebSocketClient({
      url: webSocketServerURL.toString(),
    });
  }

  mockServerURL() {
    return this._httpServerURL.toString();
  }

  async start() {
    if (super.isRunning()) {
      return;
    }

    super.ensureEmptyRunningInstance();

    await this.webSocketClient.start();

    this.webSocketClient.onEvent('interceptors/responses/create', async (message) => {
      const { request: serializedRequest } = message.data;

      const request = deserializeRequest(serializedRequest);
      const method = request.method as HttpMethod;
      const httpHandlerGroup = this.httpHandlers[method].get(request.url)?.at(-1);

      if (!httpHandlerGroup) {
        return { response: null };
      }

      const { httpHandler } = httpHandlerGroup;

      const rawResponse = await httpHandler({ request });
      const response = rawResponse && method === 'HEAD' ? new Response(null, rawResponse) : rawResponse;

      const serializedResponse = response ? await serializeResponse(response) : null;
      return { response: serializedResponse };
    });

    super.setPlatform(await this.readPlatform());
    super.markAsRunningInstance();
    super.setIsRunning(true);
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
    if (!super.isRunning()) {
      return;
    }

    await this.clearHandlers();
    await this.webSocketClient.stop();

    super.setIsRunning(false);
    super.clearRunningInstance();
  }

  async use<Schema extends HttpServiceSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    url: string,
    handler: HttpRequestHandler,
  ) {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorWorkerError();
    }

    const normalizedURL = super.normalizeUseURL(url);

    const httpHandlerGroups = this.httpHandlers[method].get(normalizedURL) ?? [];

    httpHandlerGroups.push({
      interceptor,
      async httpHandler(context) {
        const result = await handler(context);
        return result.bypass ? null : result.response;
      },
    });

    this.httpHandlers[method].set(normalizedURL, httpHandlerGroups);

    await this.webSocketClient.send('interceptors/workers/use/commit', {
      url: normalizedURL,
      method,
    });
  }

  async clearHandlers() {
    for (const methodHandlers of Object.values(this.httpHandlers)) {
      methodHandlers.clear();
    }
    await this.webSocketClient.send('interceptors/workers/use/uncommit', undefined);
  }

  async clearInterceptorHandlers<Schema extends HttpServiceSchema>(interceptor: HttpInterceptorClient<Schema>) {
    const groupsToUncommit: { url: string; method: HttpMethod }[] = [];

    for (const [method, methodHandlers] of Object.entries(this.httpHandlers)) {
      for (const [url, httpHandlerGroups] of methodHandlers) {
        const interceptorIndex = httpHandlerGroups.findIndex((group) => group.interceptor === interceptor);

        if (interceptorIndex !== -1) {
          httpHandlerGroups.splice(interceptorIndex, 1);
        }

        if (httpHandlerGroups.length === 0) {
          groupsToUncommit.push({ url, method });
        }
      }
    }

    if (groupsToUncommit.length > 0) {
      await this.webSocketClient.send('interceptors/workers/use/uncommit', groupsToUncommit);
    }
  }

  interceptorsWithHandlers() {
    const interceptors: AnyHttpInterceptorClient[] = [];

    for (const methodHandlerGroups of Object.values(this.httpHandlers)) {
      for (const groups of methodHandlerGroups.values()) {
        for (const group of groups) {
          interceptors.push(group.interceptor);
        }
      }
    }

    return Array.from(interceptors);
  }
}

export default RemoteHttpInterceptorWorker;
