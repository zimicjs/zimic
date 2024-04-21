import { createServerAdapter } from '@whatwg-node/server';
import { createServer, Server as HttpServer } from 'http';
import { WebSocket as Socket } from 'isomorphic-ws';

import { HttpMethod } from '@/http/types/schema';
import { deserializeResponse, serializeRequest } from '@/utils/fetch';
import WebSocketServer from '@/websocket/WebSocketServer';

import { PublicServer } from './types/public';
import { ServerWebSocketSchema } from './types/schema';

export interface ServerOptions {
  hostname: string;
  port?: number;
}

class Server implements PublicServer {
  private httpServer: HttpServer;
  private websocketServer: WebSocketServer<ServerWebSocketSchema>;

  private _hostname: string;
  private _port?: number;

  private workerSockets: {
    [Method in HttpMethod]: Map<string, Socket[]>;
  } = {
    GET: new Map(),
    POST: new Map(),
    PATCH: new Map(),
    PUT: new Map(),
    DELETE: new Map(),
    HEAD: new Map(),
    OPTIONS: new Map(),
  };

  constructor(options: ServerOptions) {
    this.httpServer = createServer(
      { joinDuplicateHeaders: true },
      createServerAdapter((request) => this.handleHttpRequest(request)),
    );

    this.websocketServer = new WebSocketServer({
      httpServer: this.httpServer,
    });

    this._hostname = options.hostname;
    this._port = options.port;
  }

  private async handleHttpRequest(request: Request) {
    const workerSockets = this.workerSockets[request.method as HttpMethod].get(request.url) ?? [];
    const serializedRequest = await serializeRequest(request);

    for (let index = workerSockets.length - 1; index >= 0; index--) {
      const socket = workerSockets[index];

      const { response: serializedResponse } = await this.websocketServer.request(
        'interceptors/responses/create',
        { request: serializedRequest },
        { sockets: [socket] },
      );

      if (serializedResponse) {
        const response = deserializeResponse(serializedResponse);
        return response;
      }
    }

    return new Response('Request bypassed', { status: 501 });
  }

  hostname() {
    return this._hostname;
  }

  port() {
    return this._port;
  }

  isRunning() {
    return this.httpServer.listening && this.websocketServer.isRunning();
  }

  async start() {
    await this.startHttpServer();
    await this.websocketServer.start();

    this.websocketServer.onEvent('interceptors/workers/use/commit', (message, socket) => {
      const { method, url } = message.data;

      const sockets = this.workerSockets[method].get(url) ?? [];
      if (!sockets.includes(socket)) {
        sockets.push(socket);
      }

      this.workerSockets[method].set(url, sockets);

      socket.once('close', () => {
        this.removeWorkerSocket(socket);
      });
    });

    this.websocketServer.onEvent('interceptors/workers/use/uncommit', (message, socket) => {
      if (!message.data) {
        this.removeWorkerSocket(socket);
        return;
      }

      const groupsToUncommit = message.data;
      for (const { method, url } of groupsToUncommit) {
        this.removeWorkerSocketByURLAndMethod(socket, url, method);
      }
    });
  }

  private removeWorkerSocket(socketToRemove: Socket) {
    for (const [method, methodSockets] of Object.entries(this.workerSockets)) {
      for (const url of methodSockets.keys()) {
        this.removeWorkerSocketByURLAndMethod(socketToRemove, url, method);
      }
    }
  }

  private removeWorkerSocketByURLAndMethod(socketToRemove: Socket, url: string, method: HttpMethod) {
    const sockets = this.workerSockets[method].get(url);
    if (sockets) {
      const filteredSockets = sockets.filter((socket) => socket !== socketToRemove);
      this.workerSockets[method].set(url, filteredSockets);
    }
  }

  private async startHttpServer() {
    await new Promise<void>((resolve, reject) => {
      this.httpServer.once('listening', resolve);
      this.httpServer.once('error', reject);
      this.httpServer.listen(this._port, this._hostname);
    });

    const httpAddress = this.httpServer.address();
    if (typeof httpAddress !== 'string') {
      this._port = httpAddress?.port;
    }
  }

  async stop() {
    await this.websocketServer.stop();
    await this.stopHttpServer();
  }

  private async stopHttpServer() {
    await new Promise<void>((resolve, reject) => {
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
