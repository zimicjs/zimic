import { ServerWebSocketSchema } from '@/cli/server/types/schema';
import { HttpResponse } from '@/http/types/requests';
import { HttpMethod, HttpServiceSchema } from '@/http/types/schema';
import {
  createURLIgnoringNonPathComponents,
  createRegexFromURL,
  deserializeRequest,
  serializeResponse,
} from '@/utils/fetch';
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
  url: { original: string; regex: RegExp };
  interceptor: AnyHttpInterceptorClient;
  httpHandler: HttpHandler;
}

class RemoteHttpInterceptorWorker extends HttpInterceptorWorker implements PublicRemoteHttpInterceptorWorker {
  readonly type = 'remote';

  private _serverURL: URL;
  private webSocketClient: WebSocketClient<ServerWebSocketSchema>;

  private httpHandlers: {
    [Method in HttpMethod]: HttpHandlerGroup[];
  } = {
    GET: [],
    POST: [],
    PATCH: [],
    PUT: [],
    DELETE: [],
    HEAD: [],
    OPTIONS: [],
  };

  constructor(options: RemoteHttpInterceptorWorkerOptions) {
    super();

    this._serverURL = new URL(options.serverURL);

    const webSocketServerURL = new URL(this._serverURL);
    webSocketServerURL.protocol = 'ws';

    this.webSocketClient = new WebSocketClient({
      url: webSocketServerURL.toString(),
    });
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

    this.webSocketClient.onEvent('interceptors/responses/create', async (message) => {
      const { request: serializedRequest } = message.data;

      const request = deserializeRequest(serializedRequest);
      const method = request.method as HttpMethod;
      const handlerGroup = this.httpHandlers[method].findLast((group) => group.url.regex.test(request.url));

      if (!handlerGroup) {
        return { response: null };
      }

      const { httpHandler } = handlerGroup;

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

    const handlerGroups = this.httpHandlers[method];

    const normalizedURL = createURLIgnoringNonPathComponents(url);
    const normalizedURLAsString = normalizedURL.toString();

    handlerGroups.push({
      url: {
        original: normalizedURLAsString,
        regex: createRegexFromURL(normalizedURLAsString),
      },
      interceptor,
      async httpHandler(context) {
        const result = await handler(context);
        return result.bypass ? null : result.response;
      },
    });

    await this.webSocketClient.request('interceptors/workers/use/commit', {
      url: normalizedURLAsString,
      method,
    });
  }

  async clearHandlers() {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorWorkerError();
    }

    for (const methodHandlers of Object.values(this.httpHandlers)) {
      methodHandlers.length = 0;
    }
    await this.webSocketClient.request('interceptors/workers/use/reset', undefined);
  }

  async clearInterceptorHandlers<Schema extends HttpServiceSchema>(interceptor: HttpInterceptorClient<Schema>) {
    if (!super.isRunning()) {
      throw new NotStartedHttpInterceptorWorkerError();
    }

    for (const handlerGroups of Object.values(this.httpHandlers)) {
      const handlerGroupIndexToRemove = handlerGroups.findIndex((group) => group.interceptor === interceptor);

      if (handlerGroupIndexToRemove !== -1) {
        handlerGroups.splice(handlerGroupIndexToRemove, 1);
      }
    }

    const groupsToRecommit = Object.entries(this.httpHandlers).flatMap(([method, handlerGroups]) => {
      return handlerGroups.map(({ url }) => ({
        url: url.original,
        method,
      }));
    });

    await this.webSocketClient.request('interceptors/workers/use/reset', groupsToRecommit);
  }

  interceptorsWithHandlers() {
    const interceptors = Object.values(this.httpHandlers).flatMap<AnyHttpInterceptorClient>((methodHandlerGroups) => {
      return methodHandlerGroups.map((group) => group.interceptor);
    });

    return interceptors;
  }
}

export default RemoteHttpInterceptorWorker;
