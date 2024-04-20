import { createServerAdapter } from '@whatwg-node/server';
import { createServer, Server as HttpServer } from 'http';
import { WebSocket as Socket } from 'isomorphic-ws';

import { HttpMethod } from '@/http/types/schema';
import { deserializeResponse, serializeRequest } from '@/utils/fetch';
import WebSocketServer from '@/websocket/WebSocketServer';

import { PublicServer } from './types/public';
import { ServerWebSocketSchema } from './types/schema';

export interface ServerOptions {
  port: number;
  hostname?: string;
  ephemeral?: boolean;
  onReady?: () => Promise<void> | void;
}

class Server implements PublicServer {
  private httpServer: HttpServer;
  private websocketServer: WebSocketServer<ServerWebSocketSchema>;

  private _port: number;
  private _hostname: string;
  private _ephemeral: boolean;
  private onReady?: () => Promise<void> | void;

  private workerSockets: {
    [Method in HttpMethod]: Map<string, Set<Socket>>;
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

    this._port = options.port;
    this._hostname = options.hostname ?? '0.0.0.0';
    this._ephemeral = options.ephemeral ?? false;
    this.onReady = options.onReady;
  }

  private async handleHttpRequest(request: Request) {
    const workerSockets = this.workerSockets[request.method as HttpMethod].get(request.url) ?? [];
    const serializedRequest = await serializeRequest(request);

    for (const socket of workerSockets) {
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

    return new Response('Request bypassed', { status: 503 });
  }

  port() {
    return this._port;
  }

  hostname() {
    return this._hostname;
  }

  ephemeral() {
    return this._ephemeral;
  }

  isRunning() {
    return this.httpServer.listening && this.websocketServer.isRunning();
  }

  async start() {
    await this.startHttpServer();
    await this.websocketServer.start();

    this.websocketServer.onEvent('interceptors/workers/commit/use', (message, socket) => {
      const { method, url } = message.data;

      const sockets = this.workerSockets[method].get(url) ?? new Set();
      sockets.add(socket);
      this.workerSockets[method].set(url, sockets);
    });

    this.websocketServer.onEvent('interceptors/workers/uncommit/use', (message, socket) => {
      if (message.data) {
        const { method, url } = message.data;

        const sockets = this.workerSockets[method].get(url);
        sockets?.delete(socket);
      } else {
        for (const methodSockets of Object.values(this.workerSockets)) {
          for (const sockets of methodSockets.values()) {
            sockets.delete(socket);
          }
        }
      }
    });

    if (this._ephemeral) {
      await this.onReady?.();
      await this.stop();
    }
  }

  private async startHttpServer() {
    await new Promise<void>((resolve, reject) => {
      this.httpServer.once('listening', resolve);
      this.httpServer.once('error', reject);
      this.httpServer.listen(this._port, this._hostname);
    });
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
