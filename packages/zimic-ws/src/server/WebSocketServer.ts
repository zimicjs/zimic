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
    this.socket = new ServerSocket({ server: options.server });
  }

  get listening() {
    return this.server.listening;
  }

  async open(options: { timeout?: number } = {}) {
    await openServerSocket(this.server, this.socket, options);
  }

  async close(options: { timeout?: number } = {}) {
    await closeServerSocket(this.server, this.socket, options);
  }
}

export default WebSocketServer;
