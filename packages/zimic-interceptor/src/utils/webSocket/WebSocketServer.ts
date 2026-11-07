import { PossiblePromise } from '@zimic/utils/types';
import { closeWebSocketServer } from '@zimic/utils/ws';
import { Server as HttpServer, IncomingMessage } from 'http';
import ClientSocket from 'isomorphic-ws';

import { WEB_SOCKET_CLOSE_CODES, WebSocketControlMessage } from './constants';
import { WebSocketSchema } from './types';
import WebSocketHandler from './WebSocketHandler';

const { WebSocketServer: ServerSocket } = ClientSocket;

function isSocketOpen(socket: ClientSocket) {
  return socket.readyState === socket.OPEN;
}

export type WebSocketServerAuthenticate = (
  socket: ClientSocket,
  request: IncomingMessage,
) => PossiblePromise<{ isValid: true } | { isValid: false; message: string }>;

export type WebSocketServerConnectionHandler = (
  socket: ClientSocket,
  request: IncomingMessage,
) => PossiblePromise<{ handled: boolean }>;

// Resolves with whether to complete the handshake of an upgrade request, before the socket is created.
export type WebSocketServerUpgradeVerifier = (request: IncomingMessage) => Promise<boolean>;

// Browsers and `ws` clients fail connections with any status other than 101, so the status only informs clients
// that read it.
const REFUSED_UPGRADE_STATUS_CODE = 403;
const FAILED_UPGRADE_STATUS_CODE = 500;

interface WebSocketServerOptions {
  httpServer: HttpServer;
  socketTimeout?: number;
  messageTimeout?: number;
  authenticate?: WebSocketServerAuthenticate;
  handleConnection?: WebSocketServerConnectionHandler;
  verifyUpgrade?: WebSocketServerUpgradeVerifier;
}

class WebSocketServer<Schema extends WebSocketSchema> extends WebSocketHandler<Schema> {
  private webSocketServer?: InstanceType<typeof ServerSocket>;
  private isStopping = false;

  private httpServer: HttpServer;
  private authenticate?: WebSocketServerOptions['authenticate'];
  private handleConnection?: WebSocketServerOptions['handleConnection'];
  private verifyUpgrade: WebSocketServerOptions['verifyUpgrade'];

  constructor(options: WebSocketServerOptions) {
    super({
      socketTimeout: options.socketTimeout,
      messageTimeout: options.messageTimeout,
    });

    this.httpServer = options.httpServer;
    this.authenticate = options.authenticate;
    this.handleConnection = options.handleConnection;
    this.verifyUpgrade = options.verifyUpgrade;
  }

  get isRunning() {
    return this.webSocketServer !== undefined;
  }

  start() {
    if (this.isRunning) {
      return;
    }

    const { verifyUpgrade } = this;

    const webSocketServer = new ServerSocket({
      server: this.httpServer,
      verifyClient:
        verifyUpgrade &&
        ((info: { req: IncomingMessage }, completeVerification: (isAccepted: boolean, code: number) => void) => {
          void verifyUpgrade(info.req).then(
            (isAccepted) => {
              completeVerification(isAccepted, REFUSED_UPGRADE_STATUS_CODE);
            },
            (error: unknown) => {
              completeVerification(false, FAILED_UPGRADE_STATUS_CODE);
              webSocketServer.emit('error', error);
            },
          );
        }),
    });

    webSocketServer.on('error', (error) => {
      console.error(error);
    });

    webSocketServer.on('connection', async (socket, request) => {
      socket.pause();

      try {
        if (this.authenticate) {
          const result = await this.authenticate(socket, request);

          if (!isSocketOpen(socket)) {
            return;
          }

          if (!result.isValid) {
            socket.resume();
            socket.close(WEB_SOCKET_CLOSE_CODES.POLICY_VIOLATION, result.message);
            return;
          }
        }

        const connectionResult = await this.handleConnection?.(socket, request);

        if (!isSocketOpen(socket)) {
          return;
        }

        if (connectionResult?.handled) {
          return;
        }

        const unregisterSocket = await super.registerSocket(socket);

        if (this.isStopping || !isSocketOpen(socket)) {
          unregisterSocket();
          return;
        }

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

    this.isStopping = true;

    try {
      super.offAny();
      await super.closeClientSockets();

      await closeWebSocketServer(this.webSocketServer, { timeout: this.socketTimeout, terminateClients: true });

      this.webSocketServer = undefined;
    } finally {
      this.isStopping = false;
    }
  }
}

export default WebSocketServer;
