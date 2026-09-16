import { PossiblePromise } from '@zimic/utils/types';
import { Server as HttpServer, IncomingMessage } from 'http';
import ClientSocket from 'isomorphic-ws';

import { closeServerSocket } from '@/utils/webSocket';

import { WEB_SOCKET_CLOSE_CODES, WebSocketControlMessage } from './constants';
import { WebSocketSchema } from './types';
import WebSocketHandler from './WebSocketHandler';

const { WebSocketServer: ServerSocket } = ClientSocket;

export type WebSocketServerAuthenticate = (
  socket: ClientSocket,
  request: IncomingMessage,
) => PossiblePromise<{ isValid: true } | { isValid: false; message: string }>;

export type WebSocketServerConnectionHandler = (
  socket: ClientSocket,
  request: IncomingMessage,
) => PossiblePromise<{ handled: boolean }>;

interface WebSocketServerOptions {
  httpServer: HttpServer;
  socketTimeout?: number;
  messageTimeout?: number;
  authenticate?: WebSocketServerAuthenticate;
  handleConnection?: WebSocketServerConnectionHandler;
}

class WebSocketServer<Schema extends WebSocketSchema> extends WebSocketHandler<Schema> {
  private webSocketServer?: InstanceType<typeof ServerSocket>;

  private httpServer: HttpServer;
  private authenticate?: WebSocketServerOptions['authenticate'];
  private handleConnection?: WebSocketServerOptions['handleConnection'];

  constructor(options: WebSocketServerOptions) {
    super({
      socketTimeout: options.socketTimeout,
      messageTimeout: options.messageTimeout,
    });

    this.httpServer = options.httpServer;
    this.authenticate = options.authenticate;
    this.handleConnection = options.handleConnection;
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
      socket.pause();

      try {
        if (this.authenticate) {
          const result = await this.authenticate(socket, request);

          if (socket.readyState !== socket.OPEN) {
            return;
          }

          if (!result.isValid) {
            socket.resume();
            socket.close(WEB_SOCKET_CLOSE_CODES.POLICY_VIOLATION, result.message);
            return;
          }
        }

        const connectionResult = await this.handleConnection?.(socket, request);

        if (socket.readyState !== socket.OPEN) {
          return;
        }

        if (connectionResult?.handled) {
          return;
        }

        await super.registerSocket(socket);

        socket.resume();
        socket.send('socket:auth:valid' satisfies WebSocketControlMessage);
      } catch (error) {
        socket.resume();
        socket.close(WEB_SOCKET_CLOSE_CODES.INTERNAL_ERROR);

        webSocketServer.emit('error', error);
      }
    });

    this.webSocketServer = webSocketServer;
  }

  async stop() {
    if (!this.webSocketServer || !this.isRunning) {
      return;
    }

    super.offAny();
    await super.closeClientSockets();

    await closeServerSocket(this.webSocketServer, { timeout: this.socketTimeout });

    this.webSocketServer = undefined;
  }
}

export default WebSocketServer;
