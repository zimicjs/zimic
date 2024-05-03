import { Server as HttpServer } from 'http';
import ClientSocket from 'isomorphic-ws';

import { closeServerSocket } from '@/utils/webSocket';

import { WebSocket } from './types';
import WebSocketHandler from './WebSocketHandler';

const { WebSocketServer: ServerSocket } = ClientSocket;

interface WebSocketServerOptions {
  httpServer: HttpServer;
}

class WebSocketServer<Schema extends WebSocket.ServiceSchema> extends WebSocketHandler<Schema> {
  private webSocketServer?: InstanceType<typeof ServerSocket>;
  private httpServer: HttpServer;

  constructor(options: WebSocketServerOptions) {
    super();
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

    webSocketServer.on('error', this.handleWebSocketServerError);
    webSocketServer.on('connection', this.handleWebSocketServerConnection);

    this.webSocketServer = webSocketServer;
  }

  private handleWebSocketServerConnection = async (socket: InstanceType<typeof ClientSocket>) => {
    await super.registerSocket(socket);
  };

  private handleWebSocketServerError = (error: unknown) => {
    console.error(error);
  };

  async stop() {
    if (!this.webSocketServer || !this.isRunning()) {
      return;
    }

    await super.closeClientSockets();
    super.removeAllListeners();

    await closeServerSocket(this.webSocketServer);
    this.webSocketServer.removeAllListeners();
    this.webSocketServer = undefined;
  }
}

export default WebSocketServer;
