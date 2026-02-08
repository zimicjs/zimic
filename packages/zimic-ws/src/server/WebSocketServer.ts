import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';

import { ServerSocket } from './ServerSocket';
import { closeServerSocket, openServerSocket } from './utils/lifecycle';

export interface WebSocketServerOptions {
  server: HttpServer | HttpsServer;
}

class WebSocketServer {
  private server: HttpServer | HttpsServer;
  private socket: ServerSocket;

  constructor(options: WebSocketServerOptions) {
    this.server = options.server;
    this.socket = new ServerSocket({ server: this.server });
  }

  get isRunning() {
    return this.server.listening;
  }

  async start(options: { timeout?: number } = {}) {
    if (this.isRunning) {
      return;
    }

    await openServerSocket(this.server, this.socket, options);
  }

  async stop(options: { timeout?: number } = {}) {
    if (!this.isRunning) {
      return;
    }

    await closeServerSocket(this.server, this.socket, options);
  }
}

export default WebSocketServer;
