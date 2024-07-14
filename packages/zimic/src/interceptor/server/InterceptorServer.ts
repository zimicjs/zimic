import { normalizeNodeRequest, sendNodeResponse } from '@whatwg-node/server';
import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import type { WebSocket as Socket } from 'isomorphic-ws';

import { HttpMethod } from '@/http/types/schema';
import { UnhandledRequestStrategy } from '@/interceptor/http/interceptor/types/options';
import HttpInterceptorWorker from '@/interceptor/http/interceptorWorker/HttpInterceptorWorker';
import HttpInterceptorWorkerStore from '@/interceptor/http/interceptorWorker/HttpInterceptorWorkerStore';
import { deserializeResponse, serializeRequest } from '@/utils/fetch';
import { getHttpServerPort, startHttpServer, stopHttpServer } from '@/utils/http';
import { createRegexFromURL, createURL, excludeNonPathParams } from '@/utils/urls';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import { WebSocket } from '@/webSocket/types';
import WebSocketServer from '@/webSocket/WebSocketServer';

import { DEFAULT_ACCESS_CONTROL_HEADERS, DEFAULT_PREFLIGHT_STATUS_CODE } from './constants';
import NotStartedInterceptorServerError from './errors/NotStartedInterceptorServerError';
import { InterceptorServerOptions } from './types/options';
import { InterceptorServer as PublicInterceptorServer } from './types/public';
import { HttpHandlerCommit, InterceptorServerWebSocketSchema } from './types/schema';

interface HttpHandler {
  id: string;
  url: { regex: RegExp };
  socket: Socket;
}

class InterceptorServer implements PublicInterceptorServer {
  private _httpServer?: HttpServer;
  private _webSocketServer?: WebSocketServer<InterceptorServerWebSocketSchema>;

  private _hostname: string;
  private _port?: number;

  private onUnhandledRequest?: UnhandledRequestStrategy.Declaration;
  private workerStore = new HttpInterceptorWorkerStore();

  private httpHandlerGroups: {
    [Method in HttpMethod]: HttpHandler[];
  } = {
    GET: [],
    POST: [],
    PATCH: [],
    PUT: [],
    DELETE: [],
    HEAD: [],
    OPTIONS: [],
  };

  private knownWorkerSockets = new Set<Socket>();

  constructor(options: InterceptorServerOptions) {
    this._hostname = options.hostname ?? 'localhost';
    this._port = options.port;
    this.onUnhandledRequest = options.onUnhandledRequest;
  }

  hostname() {
    return this._hostname;
  }

  port() {
    return this._port;
  }

  httpURL() {
    if (this._port === undefined) {
      return undefined;
    }
    return `http://${this._hostname}:${this._port}`;
  }

  isRunning() {
    return !!this._httpServer?.listening && !!this._webSocketServer?.isRunning();
  }

  private httpServer() {
    /* istanbul ignore if -- @preserve
     * The HTTP server is initialized before using this method in normal conditions. */
    if (!this._httpServer) {
      throw new NotStartedInterceptorServerError();
    }
    return this._httpServer;
  }

  private webSocketServer() {
    /* istanbul ignore if -- @preserve
     * The web socket server is initialized before using this method in normal conditions. */
    if (!this._webSocketServer) {
      throw new NotStartedInterceptorServerError();
    }
    return this._webSocketServer;
  }

  async start() {
    if (this.isRunning()) {
      return;
    }

    this._httpServer = createServer({
      keepAlive: true,
      joinDuplicateHeaders: true,
    });
    await this.startHttpServer();

    this._webSocketServer = new WebSocketServer({
      httpServer: this._httpServer,
    });
    this.startWebSocketServer();
  }

  private async startHttpServer() {
    const httpServer = this.httpServer();

    await startHttpServer(httpServer, {
      hostname: this._hostname,
      port: this._port,
    });
    this._port = getHttpServerPort(httpServer);

    httpServer.on('request', this.handleHttpRequest);
  }

  private startWebSocketServer() {
    const webSocketServer = this.webSocketServer();

    webSocketServer.start();
    webSocketServer.onEvent('interceptors/workers/use/commit', this.commitWorker);
    webSocketServer.onEvent('interceptors/workers/use/reset', this.resetWorker);
  }

  private commitWorker = (
    message: WebSocket.ServiceEventMessage<InterceptorServerWebSocketSchema, 'interceptors/workers/use/commit'>,
    socket: Socket,
  ) => {
    const commit = message.data;
    this.registerHttpHandlerGroup(commit, socket);
    this.registerWorkerSocketIfUnknown(socket);
    return {};
  };

  private resetWorker = (
    message: WebSocket.ServiceEventMessage<InterceptorServerWebSocketSchema, 'interceptors/workers/use/reset'>,
    socket: Socket,
  ) => {
    this.removeHttpHandlerGroupsBySocket(socket);

    const handlersToResetTo = message.data;
    const isWorkerNoLongerCommitted = handlersToResetTo === undefined;

    if (isWorkerNoLongerCommitted) {
      // When a worker is no longer committed, we should abort all requests that were using it.
      // This ensures that we only wait for responses from committed worker sockets.
      this.webSocketServer().abortSocketMessages([socket]);
    } else {
      for (const handler of handlersToResetTo) {
        this.registerHttpHandlerGroup(handler, socket);
      }
    }

    this.registerWorkerSocketIfUnknown(socket);

    return {};
  };

  private registerHttpHandlerGroup({ id, url: rawURL, method }: HttpHandlerCommit, socket: Socket) {
    const handlerGroups = this.httpHandlerGroups[method];

    const url = excludeNonPathParams(createURL(rawURL)).toString();

    handlerGroups.push({
      id,
      url: { regex: createRegexFromURL(url) },
      socket,
    });
  }

  private registerWorkerSocketIfUnknown(socket: Socket) {
    if (this.knownWorkerSockets.has(socket)) {
      return;
    }

    socket.addEventListener('close', () => {
      this.removeHttpHandlerGroupsBySocket(socket);
      this.knownWorkerSockets.delete(socket);
    });

    this.knownWorkerSockets.add(socket);
  }

  private removeHttpHandlerGroupsBySocket(socket: Socket) {
    for (const [method, handlerGroups] of Object.entries(this.httpHandlerGroups)) {
      this.httpHandlerGroups[method] = handlerGroups.filter((handlerGroup) => handlerGroup.socket !== socket);
    }
  }

  stop = async () => {
    if (!this.isRunning()) {
      return;
    }

    await this.stopWebSocketServer();
    await this.stopHttpServer();
  };

  private async stopHttpServer() {
    const httpServer = this.httpServer();

    await stopHttpServer(httpServer);
    httpServer.removeAllListeners();

    this._httpServer = undefined;
  }

  private async stopWebSocketServer() {
    const webSocketServer = this.webSocketServer();

    webSocketServer.offEvent('interceptors/workers/use/commit', this.commitWorker);
    webSocketServer.offEvent('interceptors/workers/use/reset', this.resetWorker);
    await webSocketServer.stop();

    this._webSocketServer = undefined;
  }

  private handleHttpRequest = async (nodeRequest: IncomingMessage, nodeResponse: ServerResponse) => {
    const request = normalizeNodeRequest(nodeRequest, Request);

    try {
      const { response, matchedAnyInterceptor } = await this.createResponseForRequest(request);

      if (response) {
        this.setDefaultAccessControlHeaders(response, ['access-control-allow-origin', 'access-control-expose-headers']);
        await sendNodeResponse(response, nodeResponse, nodeRequest);
        return;
      }

      const isUnhandledPreflightResponse = request.method === 'OPTIONS';

      if (isUnhandledPreflightResponse) {
        const defaultPreflightResponse = new Response(null, { status: DEFAULT_PREFLIGHT_STATUS_CODE });
        this.setDefaultAccessControlHeaders(defaultPreflightResponse);
        await sendNodeResponse(defaultPreflightResponse, nodeResponse, nodeRequest);
      }

      const shouldWarnUnhandledRequest = !isUnhandledPreflightResponse && !matchedAnyInterceptor;
      if (shouldWarnUnhandledRequest) {
        await this.logUnhandledRequest(request);
      }

      nodeResponse.destroy();
    } catch (error) {
      const isMessageAbortError = error instanceof WebSocketMessageAbortError;

      if (!isMessageAbortError) {
        console.error(error);
        await this.logUnhandledRequest(request);
      }

      nodeResponse.destroy();
    }
  };

  private async createResponseForRequest(request: Request) {
    const webSocketServer = this.webSocketServer();
    const handlerGroup = this.httpHandlerGroups[request.method as HttpMethod];

    const url = excludeNonPathParams(createURL(request.url)).toString();
    const serializedRequest = await serializeRequest(request);

    let matchedAnyInterceptor = false;

    for (let index = handlerGroup.length - 1; index >= 0; index--) {
      const handler = handlerGroup[index];

      const matchesHandlerURL = handler.url.regex.test(url);
      if (!matchesHandlerURL) {
        continue;
      }

      matchedAnyInterceptor = true;

      const { response: serializedResponse } = await webSocketServer.request(
        'interceptors/responses/create',
        { handlerId: handler.id, request: serializedRequest },
        { sockets: [handler.socket] },
      );

      if (serializedResponse) {
        const response = deserializeResponse(serializedResponse);
        return { response, matchedAnyInterceptor };
      }
    }

    return { response: null, matchedAnyInterceptor };
  }

  private setDefaultAccessControlHeaders(
    response: Response,
    headersToSet = Object.keys(DEFAULT_ACCESS_CONTROL_HEADERS),
  ) {
    for (const key of headersToSet) {
      if (response.headers.has(key)) {
        continue;
      }

      const value = DEFAULT_ACCESS_CONTROL_HEADERS[key];
      /* istanbul ignore else -- @preserve
       * This is always true during tests because we force max-age=0 to disable CORS caching. */
      if (value) {
        response.headers.set(key, value);
      }
    }
  }

  private async logUnhandledRequest(request: Request) {
    const action: UnhandledRequestStrategy.Action = 'reject';

    const declaration = this.onUnhandledRequest;
    const defaultDeclarationOrHandler = this.workerStore.defaultUnhandledRequestStrategy();

    if (declaration?.log !== undefined) {
      await HttpInterceptorWorker.logUnhandledRequestWithStaticStrategy(request, { log: declaration.log }, action);
    } else if (typeof defaultDeclarationOrHandler === 'function') {
      await HttpInterceptorWorker.logUnhandledRequestWithHandler(request, defaultDeclarationOrHandler, action);
    } else {
      await HttpInterceptorWorker.logUnhandledRequestWithStaticStrategy(request, defaultDeclarationOrHandler, action);
    }
  }
}

export default InterceptorServer;
