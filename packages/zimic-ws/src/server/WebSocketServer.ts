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

  isRunning = false;

  constructor(options: WebSocketServerOptions) {
    this.server = options.server;
    this.socket = new ServerSocket({ server: options.server });
  }

  async open(options: { timeout?: number } = {}) {
    await openServerSocket(this.server, this.socket, options);
    this.isRunning = true;
  }

  async close(options: { timeout?: number } = {}) {
    try {
      await closeServerSocket(this.server, this.socket, options);
    } finally {
      this.isRunning = false;
    }
  }
}

export default WebSocketServer;
