import { Server as HttpServer } from 'http';
import { WebSocketServer as ServerSocket } from 'isomorphic-ws';

import { WebSocket } from './types';
import WebSocketHandler from './WebSocketHandler';

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

  async start() {
    const webSocketServer = new ServerSocket({
      server: this.httpServer,
    });

    const startPromise = new Promise((resolve, reject) => {
      webSocketServer.once('listening', resolve);
      webSocketServer.once('error', reject);
    });

    webSocketServer.on('connection', async (socket) => {
      await super.registerSocket(socket);
    });

    await startPromise;

    webSocketServer.on('error', (error) => {
      console.error(error);
    });

    this.webSocketServer = webSocketServer;
  }

  async stop() {
    await super.closeSockets();

    await new Promise<void>((resolve, reject) => {
      this.webSocketServer?.once('close', resolve);
      this.webSocketServer?.once('error', reject);
      this.webSocketServer?.close();
    });

    this.webSocketServer = undefined;
  }
}

export default WebSocketServer;
