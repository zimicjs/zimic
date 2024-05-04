import { normalizeNodeRequest, sendNodeResponse } from '@whatwg-node/server';
import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import type { WebSocket as Socket } from 'isomorphic-ws';

import { HttpMethod } from '@/http/types/schema';
import {
  createRegexFromURL,
  createURLIgnoringNonPathComponents,
  deserializeResponse,
  serializeRequest,
} from '@/utils/fetch';
import { getHttpServerPort, startHttpServer, stopHttpServer } from '@/utils/http';
import { WebSocket } from '@/webSocket/types';
import WebSocketServer from '@/webSocket/WebSocketServer';

import { DEFAULT_ACCESS_CONTROL_HEADERS, DEFAULT_PREFLIGHT_STATUS_CODE } from './constants';
import NotStartedServerError from './errors/NotStartedServerError';
import { PublicServer } from './types/public';
import { HttpHandlerCommit, ServerWebSocketSchema } from './types/schema';

export interface ServerOptions {
  hostname?: string;
  port?: number;
  lifeCycleTimeout?: number;
}

interface HttpHandler {
  id: string;
  url: { regex: RegExp };
  socket: Socket;
}

class Server implements PublicServer {
  private _httpServer?: HttpServer;
  private _webSocketServer?: WebSocketServer<ServerWebSocketSchema>;

  private _hostname: string;
  private _port?: number;
  private _lifeCycleTimeout?: number;

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

  constructor(options: ServerOptions = {}) {
    this._hostname = options.hostname ?? 'localhost';
    this._port = options.port;
    this._lifeCycleTimeout = options.lifeCycleTimeout;
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

  private httpServerOrThrow() {
    /* istanbul ignore if -- @preserve
     * The HTTP server is initialized before using this method in normal conditions. */
    if (!this._httpServer) {
      throw new NotStartedServerError();
    }
    return this._httpServer;
  }

  private webSocketServerOrThrow() {
    /* istanbul ignore if -- @preserve
     * The web socket server is initialized before using this method in normal conditions. */
    if (!this._webSocketServer) {
      throw new NotStartedServerError();
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

    this._webSocketServer = new WebSocketServer({ httpServer: this._httpServer });
    this.startWebSocketServer();
  }

  private async startHttpServer() {
    const httpServer = this.httpServerOrThrow();

    await startHttpServer(httpServer, {
      hostname: this._hostname,
      port: this._port,
      timeout: this._lifeCycleTimeout,
    });
    this._port = getHttpServerPort(httpServer);

    httpServer.on('request', this.handleHttpRequest);
  }

  private startWebSocketServer() {
    const webSocketServer = this.webSocketServerOrThrow();

    webSocketServer.start();
    webSocketServer.onEvent('interceptors/workers/use/commit', this.commitWorker);
    webSocketServer.onEvent('interceptors/workers/use/reset', this.resetWorker);
  }

  private commitWorker = (
    message: WebSocket.ServiceEventMessage<ServerWebSocketSchema, 'interceptors/workers/use/commit'>,
    socket: Socket,
  ) => {
    const commit = message.data;
    this.registerHttpHandlerGroup(commit, socket);
    this.registerWorkerSocketIfUnknown(socket);
    return {};
  };

  private resetWorker = (
    message: WebSocket.ServiceEventMessage<ServerWebSocketSchema, 'interceptors/workers/use/reset'>,
    socket: Socket,
  ) => {
    this.removeWorkerSocket(socket);

    const resetCommits = message.data ?? [];
    for (const commit of resetCommits) {
      this.registerHttpHandlerGroup(commit, socket);
    }

    this.registerWorkerSocketIfUnknown(socket);

    return {};
  };

  private registerHttpHandlerGroup({ id, url, method }: HttpHandlerCommit, socket: Socket) {
    const handlerGroups = this.httpHandlerGroups[method];

    const normalizedURL = createURLIgnoringNonPathComponents(url).toString();

    handlerGroups.push({
      id,
      url: { regex: createRegexFromURL(normalizedURL) },
      socket,
    });
  }

  private registerWorkerSocketIfUnknown(socket: Socket) {
    if (this.knownWorkerSockets.has(socket)) {
      return;
    }

    socket.addEventListener('close', () => {
      this.removeWorkerSocket(socket);
      this.knownWorkerSockets.delete(socket);
    });

    this.knownWorkerSockets.add(socket);
  }

  private removeWorkerSocket(socketToRemove: Socket) {
    for (const [method, handlerGroups] of Object.entries(this.httpHandlerGroups)) {
      this.httpHandlerGroups[method] = handlerGroups.filter((handlerGroup) => handlerGroup.socket !== socketToRemove);
    }
  }

  async stop() {
    if (!this.isRunning()) {
      return;
    }

    await this.stopHttpServer();
    await this.stopWebSocketServer();
  }

  private async stopHttpServer() {
    const httpServer = this.httpServerOrThrow();

    await stopHttpServer(httpServer, {
      timeout: this._lifeCycleTimeout,
    });
    httpServer.removeAllListeners();

    this._httpServer = undefined;
  }

  private async stopWebSocketServer() {
    const webSocketServer = this.webSocketServerOrThrow();

    webSocketServer.offEvent('interceptors/workers/use/commit', this.commitWorker);
    webSocketServer.offEvent('interceptors/workers/use/reset', this.resetWorker);
    await webSocketServer.stop();

    this._webSocketServer = undefined;
  }

  private handleHttpRequest = async (nodeRequest: IncomingMessage, nodeResponse: ServerResponse) => {
    const request = normalizeNodeRequest(nodeRequest, Request);
    const response = await this.createResponseForRequest(request);

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

    nodeResponse.destroy();
  };

  private async createResponseForRequest(request: Request) {
    const webSocketServer = this.webSocketServerOrThrow();
    const handlerGroup = this.httpHandlerGroups[request.method as HttpMethod];

    const normalizedURL = createURLIgnoringNonPathComponents(request.url).toString();
    const serializedRequest = await serializeRequest(request);

    for (let index = handlerGroup.length - 1; index >= 0; index--) {
      const handler = handlerGroup[index];

      const matchesHandlerURL = handler.url.regex.test(normalizedURL);
      if (!matchesHandlerURL) {
        continue;
      }

      const { response: serializedResponse } = await webSocketServer.request(
        'interceptors/responses/create',
        {
          handlerId: handler.id,
          request: serializedRequest,
        },
        { sockets: [handler.socket] },
      );

      if (serializedResponse) {
        const response = deserializeResponse(serializedResponse);
        return response;
      }
    }

    return null;
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
}

export default Server;
