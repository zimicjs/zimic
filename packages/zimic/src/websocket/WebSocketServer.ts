import { Server as HttpServer } from 'http';
import ClientSocket from 'isomorphic-ws';

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
    if (!this.isRunning()) {
      return;
    }

    await super.closeSockets();
    super.removeAllListeners();

    await new Promise<void>((resolve, reject) => {
      const handleServerError = (error: unknown) => {
        this.webSocketServer?.off('close', handleServerClose); // eslint-disable-line @typescript-eslint/no-use-before-define
        reject(error);
      };

      const handleServerClose = () => {
        this.webSocketServer?.off('error', handleServerError);
        resolve();
      };

      this.webSocketServer?.once('error', handleServerError);
      this.webSocketServer?.once('close', handleServerClose);
      this.webSocketServer?.close();
    });

    this.webSocketServer?.removeAllListeners();
    this.webSocketServer = undefined;
  }
}

export default WebSocketServer;
