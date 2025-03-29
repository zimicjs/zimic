import { PossiblePromise } from '@zimic/utils/types';
import { Server as HttpServer, IncomingMessage } from 'http';
import ClientSocket from 'isomorphic-ws';

import { closeServerSocket } from '@/utils/webSocket';

import { WebSocketSchema } from './types';
import WebSocketHandler from './WebSocketHandler';

const { WebSocketServer: ServerSocket } = ClientSocket;

interface WebSocketServerOptions {
  httpServer: HttpServer;
  socketTimeout?: number;
  messageTimeout?: number;
  authenticateConnection?: (socket: ClientSocket, request: IncomingMessage) => PossiblePromise<boolean>;
}

class WebSocketServer<Schema extends WebSocketSchema> extends WebSocketHandler<Schema> {
  private webSocketServer?: InstanceType<typeof ServerSocket>;

  private httpServer: HttpServer;
  private authenticateConnection?: WebSocketServerOptions['authenticateConnection'];

  constructor(options: WebSocketServerOptions) {
    super({
      socketTimeout: options.socketTimeout,
      messageTimeout: options.messageTimeout,
    });

    this.httpServer = options.httpServer;
    this.authenticateConnection = options.authenticateConnection;
  }

  get isRunning() {
    return this.webSocketServer !== undefined;
  }

  start() {
    if (this.isRunning) {
      return;
    }

    const webSocketServer = new ServerSocket({ server: this.httpServer });

    webSocketServer.on('error', (error) => {
      console.error(error);
    });

    webSocketServer.on('connection', async (socket, request) => {
      if (this.authenticateConnection) {
        const isValidConnection = await this.authenticateConnection(socket, request);

        if (!isValidConnection) {
          const unauthorizedData = JSON.stringify({ message: 'Unauthorized' });
          socket.close(1008, unauthorizedData);
          return;
        }
      }

      try {
        await super.registerSocket(socket);
      } catch (error) {
        webSocketServer.emit('error', error);
      }
    });

    this.webSocketServer = webSocketServer;
  }

  async stop() {
    if (!this.webSocketServer || !this.isRunning) {
      return;
    }

    super.removeAllChannelListeners();
    super.abortSocketMessages();
    await super.closeClientSockets();

    await closeServerSocket(this.webSocketServer, { timeout: this.socketTimeout });
    this.webSocketServer.removeAllListeners();
    this.webSocketServer = undefined;
  }
}

export default WebSocketServer;
