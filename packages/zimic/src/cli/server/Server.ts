import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http';

import WebsocketServer from '@/cli/server/websocket/WebsocketServer';

import { PublicServer } from './types/public';

export interface ServerOptions {
  port: number;
  hostname?: string;
  ephemeral?: boolean;
  onReady?: () => Promise<void> | void;
}

class Server implements PublicServer {
  private httpServer: HttpServer;
  private websocketServer: WebsocketServer<{}>;

  private _port: number;
  private _hostname: string;
  private _ephemeral: boolean;
  private onReady?: () => Promise<void> | void;

  constructor(options: ServerOptions) {
    this.httpServer = createServer({ joinDuplicateHeaders: true }, (request, response) => {
      this.handleHttpRequest(request, response);
    });

    this.websocketServer = new WebsocketServer({
      httpServer: this.httpServer,
    });

    this._port = options.port;
    this._hostname = options.hostname ?? '0.0.0.0';
    this._ephemeral = options.ephemeral ?? false;
    this.onReady = options.onReady;
  }

  private handleHttpRequest(_request: IncomingMessage, response: ServerResponse) {
    response.statusCode = 404;
    response.end();
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
