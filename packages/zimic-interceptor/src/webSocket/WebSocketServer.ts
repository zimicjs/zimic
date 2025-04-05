import { PossiblePromise } from '@zimic/utils/types';
import { Server as HttpServer, IncomingMessage } from 'http';
import ClientSocket from 'isomorphic-ws';

import { closeServerSocket } from '@/utils/webSocket';

import { WebSocketControlMessage } from './constants';
import { WebSocketSchema } from './types';
import WebSocketHandler from './WebSocketHandler';

const { WebSocketServer: ServerSocket } = ClientSocket;

export type WebSocketServerAuthenticate = (
  socket: ClientSocket,
  request: IncomingMessage,
) => PossiblePromise<{ isValid: true } | { isValid: false; message: string }>;

interface WebSocketServerOptions {
  httpServer: HttpServer;
  socketTimeout?: number;
  messageTimeout?: number;
  authenticate?: WebSocketServerAuthenticate;
}

class WebSocketServer<Schema extends WebSocketSchema> extends WebSocketHandler<Schema> {
  private webSocketServer?: InstanceType<typeof ServerSocket>;

  private httpServer: HttpServer;
  private authenticate?: WebSocketServerOptions['authenticate'];

  constructor(options: WebSocketServerOptions) {
    super({
      socketTimeout: options.socketTimeout,
      messageTimeout: options.messageTimeout,
    });

    this.httpServer = options.httpServer;
    this.authenticate = options.authenticate;
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
      if (this.authenticate) {
        const result = await this.authenticate(socket, request);

        if (result.isValid) {
          socket.send('socket:authenticated' satisfies WebSocketControlMessage);
        } else {
          const unauthorizedData = JSON.stringify({ message: result.message });
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
