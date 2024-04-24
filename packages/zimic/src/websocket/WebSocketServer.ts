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

  async start() {
    if (this.isRunning()) {
      return;
    }

    const webSocketServer = new ServerSocket({
      server: this.httpServer,
    });

    const startPromise = new Promise<void>((resolve, reject) => {
      function handleServerListening() {
        webSocketServer.off('error', handleServerError); // eslint-disable-line @typescript-eslint/no-use-before-define
        resolve();
      }

      function handleServerError(error: unknown) {
        webSocketServer.off('listening', handleServerListening);
        reject(error);
      }

      webSocketServer.once('listening', handleServerListening);
      webSocketServer.once('error', handleServerError);
    });

    webSocketServer.on('connection', this.handleWebSocketServerConnection);
    await startPromise;
    webSocketServer.on('error', this.handleWebSocketServerError);

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

    await new Promise<void>((resolve, reject) => {
      const handleServerClose = () => {
        this.webSocketServer?.off('error', handleServerError); // eslint-disable-line @typescript-eslint/no-use-before-define
        resolve();
      };

      const handleServerError = (error: unknown) => {
        this.webSocketServer?.off('close', handleServerClose);
        reject(error);
      };

      this.webSocketServer?.once('close', handleServerClose);
      this.webSocketServer?.once('error', handleServerError);
      this.webSocketServer?.close();
    });

    super.removeAllListeners();

    this.webSocketServer?.off('connection', this.handleWebSocketServerConnection);
    this.webSocketServer?.off('error', this.handleWebSocketServerError);

    this.webSocketServer = undefined;
  }
}

export default WebSocketServer;
