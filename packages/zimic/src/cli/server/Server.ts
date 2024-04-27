import { normalizeNodeRequest, sendNodeResponse } from '@whatwg-node/server';
import { createServer, Server as HttpServer } from 'http';
import type { WebSocket as Socket } from 'isomorphic-ws';

import { HttpMethod } from '@/http/types/schema';
import {
  createRegexFromURL,
  createURLIgnoringNonPathComponents,
  deserializeResponse,
  serializeRequest,
} from '@/utils/fetch';
import WebSocketServer from '@/websocket/WebSocketServer';

import { PERMISSIVE_ACCESS_CONTROL_HEADERS } from './constants';
import { PublicServer } from './types/public';
import { HttpHandlerCommit, ServerWebSocketSchema } from './types/schema';

export interface ServerOptions {
  hostname?: string;
  port?: number;
}

interface HttpHandler {
  id: string;
  url: { regex: RegExp };
  socket: Socket;
}

class Server implements PublicServer {
  private httpServer?: HttpServer;
  private webSocketServer?: WebSocketServer<ServerWebSocketSchema>;

  private _hostname: string;
  private _port?: number;

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
  }

  hostname() {
    return this._hostname;
  }

  port() {
    return this._port;
  }

  isRunning() {
    return !!this.httpServer?.listening && !!this.webSocketServer?.isRunning();
  }

  async start() {
    if (this.isRunning()) {
      return;
    }

    this.httpServer = createServer({
      keepAlive: true,
      joinDuplicateHeaders: true,
    });

    this.webSocketServer = new WebSocketServer({
      httpServer: this.httpServer,
    });

    const webSocketServerStartPromise = this.webSocketServer.start();
    await this.startHttpServer();
    await webSocketServerStartPromise;

    this.webSocketServer.onEvent('interceptors/workers/use/commit', (message, socket) => {
      const commit = message.data;
      this.registerHttpHandlerGroup(commit, socket);
      this.registerWorkerSocketIfUnknown(socket);
      return {};
    });

    this.webSocketServer.onEvent('interceptors/workers/use/reset', (message, socket) => {
      this.removeWorkerSocket(socket);

      const resetCommits = message.data ?? [];
      for (const commit of resetCommits) {
        this.registerHttpHandlerGroup(commit, socket);
      }

      this.registerWorkerSocketIfUnknown(socket);

      return {};
    });
  }

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

  private async startHttpServer() {
    await new Promise<void>((resolve, reject) => {
      const handleStartSuccess = () => {
        this.httpServer?.off('error', handleStartError); // eslint-disable-line @typescript-eslint/no-use-before-define
        resolve();
      };

      const handleStartError = (error: unknown) => {
        this.httpServer?.off('listening', handleStartSuccess);
        reject(error);
      };

      this.httpServer?.listen(this._port, this._hostname, handleStartSuccess);
      this.httpServer?.once('error', handleStartError);
    });

    const httpAddress = this.httpServer?.address();
    if (typeof httpAddress !== 'string') {
      this._port = httpAddress?.port;
    }

    this.httpServer?.on('request', async (nodeRequest, nodeResponse) => {
      const request = normalizeNodeRequest(nodeRequest, Request);
      const response = await this.handleHttpRequest(request);

      if (request.method === 'OPTIONS' && response === null) {
        const optionsResponse = new Response(null, { status: 200 });
        this.setDefaultAccessControlHeaders(optionsResponse);
        await sendNodeResponse(optionsResponse, nodeResponse, nodeRequest);
      }

      if (response === null) {
        nodeResponse.destroy();
        return;
      }

      this.setDefaultAccessControlHeaders(response);
      await sendNodeResponse(response, nodeResponse, nodeRequest);
    });
  }

  async stop() {
    if (!this.isRunning()) {
      return;
    }

    const webSocketServerStopPromise = this.webSocketServer?.stop();
    await this.stopHttpServer();
    await webSocketServerStopPromise;

    this.httpServer?.removeAllListeners();
    this.httpServer = undefined;
  }

  private async stopHttpServer() {
    await new Promise<void>((resolve, reject) => {
      this.httpServer?.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });

      this.httpServer?.closeAllConnections();
    });
  }

  private async handleHttpRequest(request: Request) {
    if (!this.webSocketServer) {
      return null;
    }

    const handlerGroup = this.httpHandlerGroups[request.method as HttpMethod];

    const normalizedURL = createURLIgnoringNonPathComponents(request.url).toString();
    const serializedRequest = await serializeRequest(request);

    for (let index = handlerGroup.length - 1; index >= 0; index--) {
      const handler = handlerGroup[index];

      const matchesHandlerURL = handler.url.regex.test(normalizedURL);
      if (!matchesHandlerURL) {
        continue;
      }

      const { response: serializedResponse } = await this.webSocketServer.request(
        'interceptors/responses/create',
        {
          handlerId: handler.id,
          request: serializedRequest,
        },
        { sockets: [handler.socket] },
      );

      if (serializedResponse) {
        const response = deserializeResponse(serializedResponse);
        this.setDefaultAccessControlHeaders(response);
        return response;
      }
    }

    return null;
  }

  private setDefaultAccessControlHeaders(response: Response) {
    for (const [key, value] of Object.entries(PERMISSIVE_ACCESS_CONTROL_HEADERS)) {
      if (!response.headers.has(key)) {
        response.headers.set(key, value);
      }
    }
  }
}

export default Server;
