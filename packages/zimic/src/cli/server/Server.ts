import { normalizeNodeRequest, sendNodeResponse } from '@whatwg-node/server';
import { createServer, Server as HttpServer } from 'http';
import { WebSocket as Socket } from 'isomorphic-ws';

import { HttpMethod } from '@/http/types/schema';
import {
  createRegexFromURL,
  createURLIgnoringNonPathComponents,
  deserializeResponse,
  serializeRequest,
} from '@/utils/fetch';
import WebSocketServer from '@/websocket/WebSocketServer';

import { PublicServer } from './types/public';
import { ServerWebSocketSchema } from './types/schema';

export interface ServerOptions {
  hostname: string;
  port?: number;
}

interface HttpHandlerGroup {
  url: { regex: RegExp };
  socket: Socket;
}

class Server implements PublicServer {
  private httpServer: HttpServer;
  private webSocketServer: WebSocketServer<ServerWebSocketSchema>;

  private _hostname: string;
  private _port?: number;

  private httpHandlerGroups: {
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

  private knownWorkerSockets = new Set<Socket>();

  constructor(options: ServerOptions) {
    this.httpServer = createServer({ joinDuplicateHeaders: true }, async (nodeRequest, nodeResponse) => {
      const request = normalizeNodeRequest(nodeRequest, Request);
      const response = await this.handleHttpRequest(request);

      if (response === null) {
        nodeResponse.destroy();
        return;
      }

      await sendNodeResponse(response, nodeResponse, nodeRequest);
    });

    this.webSocketServer = new WebSocketServer({
      httpServer: this.httpServer,
    });

    this._hostname = options.hostname;
    this._port = options.port;
  }

  private async handleHttpRequest(request: Request) {
    const handlerGroup = this.httpHandlerGroups[request.method as HttpMethod];
    const serializedRequest = await serializeRequest(request);

    for (let index = handlerGroup.length - 1; index >= 0; index--) {
      const handler = handlerGroup[index];

      const matchesHandlerURL = handler.url.regex.test(request.url);
      if (!matchesHandlerURL) {
        continue;
      }

      const { response: serializedResponse } = await this.webSocketServer.request(
        'interceptors/responses/create',
        { request: serializedRequest },
        { sockets: [handler.socket] },
      );

      if (serializedResponse) {
        const response = deserializeResponse(serializedResponse);
        return response;
      }
    }

    return null;
  }

  hostname() {
    return this._hostname;
  }

  port() {
    return this._port;
  }

  isRunning() {
    return this.httpServer.listening && this.webSocketServer.isRunning();
  }

  async start() {
    if (this.isRunning()) {
      return;
    }

    const webSocketServerStartPromise = this.webSocketServer.start();
    await this.startHttpServer();
    await webSocketServerStartPromise;

    this.webSocketServer.onEvent('interceptors/workers/use/commit', (message, socket) => {
      const { url, method } = message.data;
      this.registerHttpHandlerGroup(url, method, socket);
      this.registerWorkerSocketIfUnknown(socket);
    });

    this.webSocketServer.onEvent('interceptors/workers/use/reset', (message, socket) => {
      this.removeWorkerSocket(socket);

      const groupsToRecommit = message.data ?? [];
      for (const { url, method } of groupsToRecommit) {
        this.registerHttpHandlerGroup(url, method, socket);
      }

      this.registerWorkerSocketIfUnknown(socket);
    });
  }

  private registerHttpHandlerGroup(url: string, method: HttpMethod, socket: Socket) {
    const handlerGroups = this.httpHandlerGroups[method];

    const normalizedURL = createURLIgnoringNonPathComponents(url);
    const normalizedURLAsString = normalizedURL.toString();

    handlerGroups.push({
      url: { regex: createRegexFromURL(normalizedURLAsString) },
      socket,
    });
  }

  private registerWorkerSocketIfUnknown(socket: Socket) {
    if (!this.knownWorkerSockets.has(socket)) {
      socket.once('close', () => {
        this.removeWorkerSocket(socket);
      });

      this.knownWorkerSockets.add(socket);
    }
  }

  private removeWorkerSocket(socketToRemove: Socket) {
    for (const [method, handlerGroups] of Object.entries(this.httpHandlerGroups)) {
      this.httpHandlerGroups[method] = handlerGroups.filter((handlerGroup) => handlerGroup.socket !== socketToRemove);
    }
  }

  private async startHttpServer() {
    await new Promise<void>((resolve, reject) => {
      this.httpServer.once('error', reject);
      this.httpServer.listen(this._port, this._hostname, () => {
        this.httpServer.off('error', reject);
        resolve();
      });
    });

    const httpAddress = this.httpServer.address();
    if (typeof httpAddress !== 'string') {
      this._port = httpAddress?.port;
    }
  }

  async stop() {
    if (!this.isRunning()) {
      return;
    }

    const webSocketServerStopPromise = this.webSocketServer.stop();
    await this.stopHttpServer();
    await webSocketServerStopPromise;
  }

  private async stopHttpServer() {
    await new Promise<void>((resolve, reject) => {
      this.httpServer.closeAllConnections();
      this.httpServer.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

export default Server;
