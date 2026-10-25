import { excludeNonPathParams } from '@zimic/utils/url';
import { closeWebSocketClient } from '@zimic/utils/ws';
import type { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import type { IncomingMessage } from 'http';
import type { WebSocket as Socket } from 'isomorphic-ws';
import { WebSocket as ClientSocket } from 'ws';
import * as z from 'zod';

import { isURLUnderBaseURL } from '@/utils/urls';
import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import type { WebSocketEventMessage } from '@/utils/webSocket/types';
import type WebSocketServer from '@/utils/webSocket/WebSocketServer';
import {
  deserializeWebSocketMessageDataFromTransport,
  serializeWebSocketMessageDataForTransport,
} from '@/ws/utils/messageData';

import type {
  InterceptorServerWebSocketSchema,
  WebSocketInterceptorRegistration,
  WebSocketWorkerReset,
} from '../types/schema';
import { parseInterceptorServerRPCData } from '../utils/rpc';

const webSocketInterceptorRegistrationSchema = z.object({
  id: z.string(),
  baseURL: z.url({ protocol: /^wss?$/ }),
}) satisfies z.ZodType<WebSocketInterceptorRegistration>;

const webSocketWorkerResetSchema = z.object({
  interceptors: z.array(webSocketInterceptorRegistrationSchema),
  clearedInterceptorIds: z.array(z.string()).optional(),
}) satisfies z.ZodType<WebSocketWorkerReset>;

const webSocketMessageSendSchema = z.object({
  clientId: z.string().optional(),
  interceptorId: z.string().optional(),
  data: z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), data: z.string() }),
    z.object({ type: z.literal('binary'), data: z.base64() }),
  ]),
});

const clientConnectionReplySchema = z.object({ acceptedInterceptorIds: z.array(z.string()) });

interface RegisteredWebSocketInterceptor {
  id: string;
  baseURL: string;
  socket: Socket;
}

interface WebSocketWorker {
  socket: Socket;
  interceptors: RegisteredWebSocketInterceptor[];
  numberOfResets: number;
}

interface UserWebSocketConnection {
  clientId: string;
  workerSocket: Socket;
  // Kept in the order of the worker's interceptors, so the last holder is the newest.
  holders: RegisteredWebSocketInterceptor[];
}

interface PendingUserWebSocketConnection extends UserWebSocketConnection {
  closeListener: () => void;
}

const WEB_SOCKET_CLOSE_REASONS = Object.freeze({
  CONNECTION_SETUP_FAILED: 'Could not connect to the WebSocket interceptor.',
  NO_REGISTERED_INTERCEPTOR: 'No WebSocket interceptor is registered for this URL.',
} as const);

interface WebSocketInterceptorServerRuntimeOptions {
  webSocketServer: WebSocketServer<InterceptorServerWebSocketSchema>;
  isWebSocketWorkerSocket: (socket: Socket) => boolean;
}

class WebSocketInterceptorServerRuntime {
  private webSocketServer: WebSocketInterceptorServerRuntimeOptions['webSocketServer'];
  private isWebSocketWorkerSocket: WebSocketInterceptorServerRuntimeOptions['isWebSocketWorkerSocket'];

  // Workers are kept in the order of their first reset, which registers their first interceptor and decides the worker
  // that holds a connection. Each worker keeps that position until its socket disconnects, even if all of its
  // interceptors stop.
  private webSocketWorkersBySocket = new Map<Socket, WebSocketWorker>();
  private pendingUserWebSocketConnections = new Map<Socket, PendingUserWebSocketConnection>();
  private activeUserWebSocketConnections = new Map<Socket, UserWebSocketConnection>();

  constructor(options: WebSocketInterceptorServerRuntimeOptions) {
    this.webSocketServer = options.webSocketServer;
    this.isWebSocketWorkerSocket = options.isWebSocketWorkerSocket;

    this.webSocketServer.onChannel('event', 'interceptors/ws/workers/reset', this.resetWorker);
    this.webSocketServer.onChannel('event', 'interceptors/ws/messages/send', this.sendMessage);
  }

  private assertWebSocketWorkerSocket(socket: Socket) {
    if (!this.isWebSocketWorkerSocket(socket)) {
      throw new InvalidWebSocketMessageError('WebSocket RPC received from a non-WebSocket worker.');
    }
  }

  private resetWorker = (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/workers/reset'>,
    socket: Socket,
  ) => {
    this.assertWebSocketWorkerSocket(socket);

    // Setting a socket already in the map keeps its position.
    const worker = this.webSocketWorkersBySocket.get(socket) ?? { socket, interceptors: [], numberOfResets: 0 };
    this.webSocketWorkersBySocket.set(socket, worker);

    // Counted before parsing, so the count matches the resets the worker sent even if one is invalid.
    worker.numberOfResets++;

    const reset = parseInterceptorServerRPCData(webSocketWorkerResetSchema, message.data);
    const clearedInterceptorIds = new Set(reset.clearedInterceptorIds);

    const existingInterceptorsById = new Map(
      worker.interceptors.map((interceptor) => [interceptor.id, interceptor] as const),
    );

    const resetInterceptors = reset.interceptors.map((registration): RegisteredWebSocketInterceptor => {
      const existingInterceptor = existingInterceptorsById.get(registration.id);

      if (!existingInterceptor) {
        return { ...registration, socket };
      }

      existingInterceptor.baseURL = registration.baseURL;
      existingInterceptorsById.delete(registration.id);

      // A cleared interceptor keeps its registration, which decides the holders of new connections, but loses its
      // connections.
      if (clearedInterceptorIds.has(registration.id)) {
        this.detachWebSocketInterceptorConnections(existingInterceptor);
      }

      return existingInterceptor;
    });

    for (const removedInterceptor of existingInterceptorsById.values()) {
      this.detachWebSocketInterceptorConnections(removedInterceptor);
    }

    worker.interceptors = resetInterceptors;

    return {};
  };

  removeWorkerBySocket(socket: Socket) {
    for (const interceptor of this.webSocketWorkersBySocket.get(socket)?.interceptors ?? []) {
      this.detachWebSocketInterceptorConnections(interceptor, {
        pendingCloseCode: WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR,
        pendingCloseReason: WEB_SOCKET_CLOSE_REASONS.CONNECTION_SETUP_FAILED,
      });
    }

    this.webSocketWorkersBySocket.delete(socket);
  }

  // Clearing or stopping one interceptor must not affect the others, so a shared connection stays open until its last
  // holder lets it go, whether or not the connection is still being set up.
  private detachWebSocketInterceptorConnections(
    interceptor: RegisteredWebSocketInterceptor,
    options: {
      pendingCloseCode?: number;
      pendingCloseReason?: string;
    } = {},
  ) {
    for (const [userSocket, userConnection] of this.pendingUserWebSocketConnections) {
      if (userConnection.holders.includes(interceptor)) {
        userConnection.holders = userConnection.holders.filter((holder) => holder !== interceptor);

        if (userConnection.holders.length === 0) {
          this.webSocketServer.emitSocket('abortRequests', userConnection.workerSocket, {
            shouldAbortRequest: (request) =>
              this.webSocketServer.isChannelEvent(request, 'interceptors/ws/clients/connect') &&
              request.data.clientId === userConnection.clientId,
          });

          this.closePendingUserWebSocketConnection(userSocket, userConnection, options);

          // The worker may have accepted the connection after the server stopped waiting for its reply, so it is told
          // to forget the client.
          this.notifyUserWebSocketClose(userConnection);
        }
      }
    }

    for (const [userSocket, userConnection] of this.activeUserWebSocketConnections) {
      if (userConnection.holders.includes(interceptor)) {
        userConnection.holders = userConnection.holders.filter((holder) => holder !== interceptor);

        if (userConnection.holders.length === 0) {
          this.activeUserWebSocketConnections.delete(userSocket);
          userSocket.close(WEB_SOCKET_CLOSE_CODES.DEFAULT);
        }
      }
    }
  }

  handleConnection = async (socket: Socket, request: IncomingMessage) => {
    const connectionTarget = this.findConnectionTargetByRequest(request);

    if (!connectionTarget) {
      socket.resume();
      socket.close(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR, WEB_SOCKET_CLOSE_REASONS.NO_REGISTERED_INTERCEPTOR);
      return;
    }

    const clientId = crypto.randomUUID();

    const connection: PendingUserWebSocketConnection = {
      clientId,
      workerSocket: connectionTarget.worker.socket,
      holders: connectionTarget.holders,
      closeListener: () => {
        this.removePendingUserWebSocketConnection(socket, connection);
      },
    };

    socket.pause();
    socket.addEventListener('close', connection.closeListener, { once: true });

    this.pendingUserWebSocketConnections.set(socket, connection);

    let isActivated = false;

    try {
      // One request connects every holder, so the worker lists the client in all of them before any connection
      // listener runs, as in local mode.
      const reply = await this.webSocketServer.request(
        'interceptors/ws/clients/connect',
        {
          interceptorIds: connection.holders.map((holder) => holder.id),
          clientId,
          url: this.getWebSocketRequestURL(request).href,
          // Lets the worker tell which clears the server has not processed yet. Those holders let the connection go
          // before holding it, and the server drops them when their reset arrives, before the reply.
          numberOfResets: connectionTarget.worker.numberOfResets,
        },
        { sockets: [connection.workerSocket] },
      );

      const { acceptedInterceptorIds } = parseInterceptorServerRPCData(clientConnectionReplySchema, reply);

      // Holders that let the connection go while it was being set up were already dropped.
      const accepted = connection.holders.every((holder) => acceptedInterceptorIds.includes(holder.id));

      if (!accepted || !this.canActivatePendingUserWebSocketConnection(socket, connection)) {
        return;
      }

      const messageListener = this.createUserWebSocketMessageListener(connection);

      socket.addEventListener('close', () => {
        this.activeUserWebSocketConnections.delete(socket);
        socket.removeEventListener('message', messageListener);
        this.notifyUserWebSocketClose(connection);
      });

      socket.addEventListener('message', messageListener);

      this.activeUserWebSocketConnections.set(socket, connection);
      this.removePendingUserWebSocketConnection(socket, connection);

      socket.resume();

      isActivated = true;
    } catch (error) {
      if (error instanceof InvalidWebSocketMessageError) {
        console.error(error);
      }
    } finally {
      if (!isActivated) {
        this.closePendingUserWebSocketConnection(socket, connection, {
          pendingCloseCode: WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR,
          pendingCloseReason: WEB_SOCKET_CLOSE_REASONS.CONNECTION_SETUP_FAILED,
        });

        // Some holders may have accepted the connection, so the worker is told to forget the client.
        this.notifyUserWebSocketClose(connection);
      }
    }
  };

  private canActivatePendingUserWebSocketConnection(socket: Socket, connection: PendingUserWebSocketConnection) {
    return (
      this.pendingUserWebSocketConnections.get(socket) === connection &&
      this.isWebSocketWorkerSocket(connection.workerSocket) &&
      connection.workerSocket.readyState === ClientSocket.OPEN &&
      socket.readyState === ClientSocket.OPEN
    );
  }

  private removePendingUserWebSocketConnection(socket: Socket, connection: PendingUserWebSocketConnection) {
    if (this.pendingUserWebSocketConnections.get(socket) !== connection) {
      return false;
    }

    this.pendingUserWebSocketConnections.delete(socket);
    socket.removeEventListener('close', connection.closeListener);

    return true;
  }

  private closePendingUserWebSocketConnection(
    socket: Socket,
    connection: PendingUserWebSocketConnection,
    options: {
      pendingCloseCode?: number;
      pendingCloseReason?: string;
    },
  ) {
    if (!this.removePendingUserWebSocketConnection(socket, connection)) {
      return;
    }

    socket.resume();
    socket.close(options.pendingCloseCode ?? WEB_SOCKET_CLOSE_CODES.DEFAULT, options.pendingCloseReason);
  }

  private createUserWebSocketMessageListener(connection: UserWebSocketConnection) {
    return (message: ClientSocket.MessageEvent) => {
      void this.handleUserWebSocketMessage(connection, message).catch(
        /* istanbul ignore next -- @preserve
         * Message errors require serializing the message data to fail or the server to stop before the message
         * is sent to the worker. */
        (error: unknown) => {
          console.error(error);
        },
      );
    };
  }

  private notifyUserWebSocketClose(connection: UserWebSocketConnection) {
    // A user socket may finish closing after the server stopped waiting for it, when sending would throw.
    if (connection.workerSocket.readyState !== ClientSocket.OPEN || !this.webSocketServer.isRunning) {
      return;
    }

    this.webSocketServer.send(
      'interceptors/ws/clients/close',
      { clientId: connection.clientId },
      { sockets: [connection.workerSocket] },
    );
  }

  private async handleUserWebSocketMessage(connection: UserWebSocketConnection, message: ClientSocket.MessageEvent) {
    // Holders that let the connection go while the message is handled ignore it in the worker, which no longer lists
    // the client.
    const { holders } = connection;

    const data = await serializeWebSocketMessageDataForTransport(message.data as WebSocketMessageData<WebSocketSchema>);

    // The message is sent to the worker once with all holders, so the worker tries their handlers together by creation
    // order and applies the unhandled message strategy of the newest holder still holding the connection.
    this.webSocketServer.send(
      'interceptors/ws/messages/handle',
      { interceptorIds: holders.map((holder) => holder.id), clientId: connection.clientId, data },
      { sockets: [connection.workerSocket] },
    );
  }

  private sendMessage = (
    rawMessage: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/messages/send'>,
    workerSocket: Socket,
  ) => {
    this.assertWebSocketWorkerSocket(workerSocket);

    const message = parseInterceptorServerRPCData(webSocketMessageSendSchema, rawMessage.data);

    const targetSockets = [
      ...this.activeUserWebSocketConnections.entries(),
      ...this.pendingUserWebSocketConnections.entries(),
    ].filter(([, userConnection]) => {
      const isOwnedByWorker = userConnection.workerSocket === workerSocket;
      const matchesClient = message.clientId === undefined || userConnection.clientId === message.clientId;
      const matchesInterceptor =
        message.interceptorId === undefined ||
        userConnection.holders.some((holder) => holder.id === message.interceptorId);

      return isOwnedByWorker && matchesClient && matchesInterceptor;
    });

    const runtimeMessageData = deserializeWebSocketMessageDataFromTransport(message.data);

    for (const [socket] of targetSockets) {
      socket.send(runtimeMessageData);
    }
  };

  private findConnectionTargetByRequest(request: IncomingMessage) {
    const requestURL = excludeNonPathParams(this.getWebSocketRequestURL(request));

    const workers = Array.from(this.webSocketWorkersBySocket.values(), (worker) => ({
      worker,
      holders: worker.interceptors.filter((interceptor) => isURLUnderBaseURL(requestURL.href, interceptor.baseURL)),
    }));

    // Only one worker holds a connection, the same one that decides the unhandled message strategy. Other workers belong
    // to other processes or authentication tokens, so they do not serve each other's connections. A connection goes to
    // the newest worker with a running interceptor whose base URL is a prefix of the connection URL, even if that
    // interceptor has no handlers, as HTTP requests do.
    return workers.findLast((target) => target.holders.length > 0);
  }

  private getWebSocketRequestURL(request: IncomingMessage) {
    /* istanbul ignore next -- @preserve
     * Upgrade requests always include a URL in the supported Node runtimes. */
    return new URL(request.url ?? '/', `ws://${request.headers.host}`);
  }

  async stop() {
    this.webSocketServer.offChannel('event', 'interceptors/ws/workers/reset', this.resetWorker);
    this.webSocketServer.offChannel('event', 'interceptors/ws/messages/send', this.sendMessage);

    await this.closeUserWebSocketConnections();

    this.webSocketWorkersBySocket.clear();
  }

  private async closeUserWebSocketConnections() {
    for (const socket of this.pendingUserWebSocketConnections.keys()) {
      socket.resume();
    }

    const userSockets = new Set([
      ...this.pendingUserWebSocketConnections.keys(),
      ...this.activeUserWebSocketConnections.keys(),
    ]);

    const closingPromises = Array.from(userSockets, (socket) =>
      closeWebSocketClient(socket, { timeout: this.webSocketServer.socketTimeout }),
    );

    await Promise.all(closingPromises);
    this.pendingUserWebSocketConnections.clear();
    this.activeUserWebSocketConnections.clear();
  }
}

export default WebSocketInterceptorServerRuntime;
