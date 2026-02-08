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
  private isSocketOpen: boolean;

  constructor(options: WebSocketServerOptions) {
    this.server = options.server;
    this.socket = new ServerSocket({ server: options.server });
    this.isSocketOpen = options.server.listening;
  }

  get isRunning() {
    return this.server.listening && this.isSocketOpen;
  }

  async start(options: { timeout?: number } = {}) {
    if (this.isSocketOpen) {
      return;
    }

    await openServerSocket(this.server, this.socket, options);

    this.isSocketOpen = true;
  }

  async stop(options: { timeout?: number } = {}) {
    if (!this.isSocketOpen) {
      return;
    }

    try {
      await closeServerSocket(this.server, this.socket, options);
    } finally {
      this.isSocketOpen = false;
    }
  }
}

export default WebSocketServer;
