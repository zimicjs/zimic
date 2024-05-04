import { Server as HttpServer } from 'http';
import ClientSocket from 'isomorphic-ws';

import { closeServerSocket } from '@/utils/webSocket';

import { WebSocket } from './types';
import WebSocketHandler from './WebSocketHandler';

const { WebSocketServer: ServerSocket } = ClientSocket;

interface WebSocketServerOptions {
  httpServer: HttpServer;
  socketTimeout?: number;
  messageTimeout?: number;
}

class WebSocketServer<Schema extends WebSocket.ServiceSchema> extends WebSocketHandler<Schema> {
  private webSocketServer?: InstanceType<typeof ServerSocket>;
  private httpServer: HttpServer;

  constructor(options: WebSocketServerOptions) {
    super({
      socketTimeout: options.socketTimeout,
      messageTimeout: options.messageTimeout,
    });

    this.httpServer = options.httpServer;
  }

  isRunning() {
    return this.webSocketServer !== undefined;
  }

  start() {
    if (this.isRunning()) {
      return;
    }

    const webSocketServer = new ServerSocket({ server: this.httpServer });

    webSocketServer.on('error', (error) => {
      console.error(error);
    });

    webSocketServer.on('connection', async (socket) => {
      try {
        await super.registerSocket(socket);
      } catch (error) {
        webSocketServer.emit('error', error);
      }
    });

    this.webSocketServer = webSocketServer;
  }

  async stop() {
    if (!this.webSocketServer || !this.isRunning()) {
      return;
    }

    await super.closeClientSockets();
    super.removeAllListeners();

    await closeServerSocket(this.webSocketServer, { timeout: this.socketTimeout });
    this.webSocketServer.removeAllListeners();
    this.webSocketServer = undefined;
  }
}

export default WebSocketServer;
