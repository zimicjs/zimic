import { createServerAdapter } from '@whatwg-node/server';
import { createServer, Server as HttpServer } from 'http';

import { deserializeResponse, serializeRequest } from '@/utils/fetch';
import WebSocketServer from '@/websocket/WebSocketServer';

import { PublicServer } from './types/public';
import { RemoteHttpInterceptorWebSocketSchema } from './types/schema';

export interface ServerOptions {
  port: number;
  hostname?: string;
  ephemeral?: boolean;
  onReady?: () => Promise<void> | void;
}

class Server implements PublicServer {
  private httpServer: HttpServer;
  private websocketServer: WebSocketServer<RemoteHttpInterceptorWebSocketSchema>;

  private _port: number;
  private _hostname: string;
  private _ephemeral: boolean;
  private onReady?: () => Promise<void> | void;

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
    const serializedRequest = await serializeRequest(request);
    const { response: serializedResponse } = await this.websocketServer.request(
      'interceptors/requests/create-response',
      { request: serializedRequest },
    );
    const response = deserializeResponse(serializedResponse);
    return response;
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
