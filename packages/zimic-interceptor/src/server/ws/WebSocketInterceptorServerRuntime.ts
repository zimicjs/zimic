import { excludeNonPathParams } from '@zimic/utils/url';
import { closeWebSocketClient } from '@zimic/utils/ws';
import type { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import type { IncomingMessage } from 'http';
import type { WebSocket as Socket } from 'isomorphic-ws';
import { WebSocket as ClientSocket } from 'ws';
import * as z from 'zod';

import { isURLUnderBaseURL } from '@/utils/urls';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import type { WebSocketEventMessage } from '@/utils/webSocket/types';
import type WebSocketServer from '@/utils/webSocket/WebSocketServer';
import { isUserCloseCode, MAX_CLOSE_REASON_BYTE_LENGTH } from '@/ws/interceptor/WebSocketInterceptorHandle';
import {
  deserializeWebSocketMessageDataFromTransport,
  serializeWebSocketMessageDataForTransport,
} from '@/ws/utils/messageData';

import type {
  InterceptorServerWebSocketSchema,
  WebSocketClientConnectionReply,
  WebSocketClientDisconnection,
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
  clientId: z.string(),
  data: z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), data: z.string() }),
    z.object({ type: z.literal('binary'), data: z.base64() }),
  ]),
});

const webSocketClientDisconnectionSchema = z.object({
  clientId: z.string(),
  code: z
    .int()
    .refine(isUserCloseCode, { message: 'Close codes must be either 1000, or between 3000 and 4999.' })
    .optional(),
  reason: z
    .string()
    .refine((reason) => Buffer.byteLength(reason) <= MAX_CLOSE_REASON_BYTE_LENGTH, {
      message: `Close reasons must not be greater than ${MAX_CLOSE_REASON_BYTE_LENGTH} UTF-8 bytes.`,
    })
    .optional(),
}) satisfies z.ZodType<WebSocketClientDisconnection>;

const clientConnectionReplySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept'), acceptedInterceptorIds: z.array(z.string()) }),
  z.object({ action: z.literal('reject') }),
]) satisfies z.ZodType<WebSocketClientConnectionReply>;

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

interface UserWebSocketConnectionClosure {
  code: number;
  reason?: string;
}

// A connection is pending from its upgrade request until its handshake completes, so it has no socket yet.
interface PendingUserWebSocketConnection extends UserWebSocketConnection {
  requestSocketCloseListener: () => void;
  // Server messages and closes the worker sends before the handshake completes, such as from connection effects, are
  // delivered in order once it does.
  queuedDeliveries: ((socket: Socket) => void)[];
  // Set when the connection can no longer be activated, such as after its last holder lets it go. Its handshake still
  // completes and the connection closes right after, so the client receives the close code and reason.
  closure?: UserWebSocketConnectionClosure;
}

const WEB_SOCKET_CLOSE_REASONS = Object.freeze({
  CONNECTION_SETUP_FAILED: 'Could not connect to the WebSocket interceptor.',
  NO_REGISTERED_INTERCEPTOR: 'No WebSocket interceptor is registered for this URL.',
} as const);

const CONNECTION_SETUP_FAILURE_CLOSURE: UserWebSocketConnectionClosure = Object.freeze({
  code: WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR,
  reason: WEB_SOCKET_CLOSE_REASONS.CONNECTION_SETUP_FAILED,
});

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
  private pendingUserWebSocketConnections = new Map<IncomingMessage, PendingUserWebSocketConnection>();
  private activeUserWebSocketConnections = new Map<Socket, UserWebSocketConnection>();

  constructor(options: WebSocketInterceptorServerRuntimeOptions) {
    this.webSocketServer = options.webSocketServer;
    this.isWebSocketWorkerSocket = options.isWebSocketWorkerSocket;

    this.webSocketServer.onChannel('event', 'interceptors/ws/workers/reset', this.resetWorker);
    this.webSocketServer.onChannel('event', 'interceptors/ws/messages/send', this.sendMessage);
    this.webSocketServer.onChannel('event', 'interceptors/ws/clients/disconnect', this.disconnectClient);
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
      this.detachWebSocketInterceptorConnections(interceptor, { pendingClosure: CONNECTION_SETUP_FAILURE_CLOSURE });
    }

    this.webSocketWorkersBySocket.delete(socket);
  }

  // Clearing or stopping one interceptor must not affect the others, so a shared connection stays open until its last
  // holder lets it go, whether or not the connection is still being set up.
  private detachWebSocketInterceptorConnections(
    interceptor: RegisteredWebSocketInterceptor,
    options: { pendingClosure?: UserWebSocketConnectionClosure } = {},
  ) {
    for (const userConnection of this.pendingUserWebSocketConnections.values()) {
      if (userConnection.holders.includes(interceptor)) {
        userConnection.holders = userConnection.holders.filter((holder) => holder !== interceptor);

        if (userConnection.holders.length === 0) {
          this.webSocketServer.emitSocket('abortRequests', userConnection.workerSocket, {
            shouldAbortRequest: (request) =>
              this.webSocketServer.isChannelEvent(request, 'interceptors/ws/clients/connect') &&
              request.data.clientId === userConnection.clientId,
          });

          userConnection.closure ??= options.pendingClosure ?? { code: WEB_SOCKET_CLOSE_CODES.DEFAULT };
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

  // Resolves with whether to complete the handshake of a user connection. The worker decides it first, so a connection
  // its handlers reject is refused without opening. Connections that cannot be set up complete the handshake and then
  // close, which tells the client why.
  verifyUpgrade = async (request: IncomingMessage) => {
    const connectionTarget = this.findConnectionTargetByRequest(request);

    if (!connectionTarget) {
      return true;
    }

    const connection: PendingUserWebSocketConnection = {
      clientId: crypto.randomUUID(),
      workerSocket: connectionTarget.worker.socket,
      holders: connectionTarget.holders,
      queuedDeliveries: [],
      requestSocketCloseListener: () => {
        this.removePendingUserWebSocketConnection(request, connection);
        this.notifyUserWebSocketClose(connection);
      },
    };

    // A socket with no reader does not report its peer closing, so it is read while the worker decides the connection.
    // Clients send no frames before the handshake completes, so nothing is lost. HTTP server sockets stay half-open
    // after the peer ends, so its end also counts as closing.
    request.socket.once('close', connection.requestSocketCloseListener);
    request.socket.once('end', connection.requestSocketCloseListener);
    request.socket.resume();

    this.pendingUserWebSocketConnections.set(request, connection);

    try {
      // One request connects every holder, so the worker lists the client in all of them before any connection
      // listener runs, as in local mode.
      const rawReply = await this.webSocketServer.request(
        'interceptors/ws/clients/connect',
        {
          interceptorIds: connection.holders.map((holder) => holder.id),
          clientId: connection.clientId,
          url: this.getWebSocketRequestURL(request).href,
          protocols: this.getWebSocketRequestProtocols(request),
          // Lets the worker tell which clears the server has not processed yet. Those holders let the connection go
          // before holding it, and the server drops them when their reset arrives, before the reply.
          numberOfResets: connectionTarget.worker.numberOfResets,
        },
        { sockets: [connection.workerSocket] },
      );

      const reply = parseInterceptorServerRPCData(clientConnectionReplySchema, rawReply);

      if (reply.action === 'reject') {
        this.removePendingUserWebSocketConnection(request, connection);
        return false;
      }

      // Holders that let the connection go while it was being set up were already dropped.
      const accepted = connection.holders.every((holder) => reply.acceptedInterceptorIds.includes(holder.id));

      if (!accepted) {
        connection.closure ??= CONNECTION_SETUP_FAILURE_CLOSURE;
      }
    } catch (error) {
      // Aborts are expected when the last holder lets the connection go or the worker disconnects.
      if (!(error instanceof WebSocketMessageAbortError)) {
        console.error(error);
      }

      connection.closure ??= CONNECTION_SETUP_FAILURE_CLOSURE;
    }

    return this.pendingUserWebSocketConnections.get(request) === connection;
  };

  handleConnection = (socket: Socket, request: IncomingMessage) => {
    const connection = this.pendingUserWebSocketConnections.get(request);

    if (!connection) {
      socket.resume();
      socket.close(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR, WEB_SOCKET_CLOSE_REASONS.NO_REGISTERED_INTERCEPTOR);
      return;
    }

    this.removePendingUserWebSocketConnection(request, connection);

    // A worker that disconnects or lets the connection go before this point has already set its closure, and a client
    // that goes away has already removed the pending connection.
    if (connection.closure) {
      socket.resume();
      this.deliverQueuedUserWebSocketDeliveries(socket, connection);
      socket.close(connection.closure.code, connection.closure.reason);

      // Some holders may have accepted the connection, so the worker is told to forget the client.
      this.notifyUserWebSocketClose(connection);
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

    socket.resume();
    this.deliverQueuedUserWebSocketDeliveries(socket, connection);
  };

  private deliverQueuedUserWebSocketDeliveries(socket: Socket, connection: PendingUserWebSocketConnection) {
    for (const deliver of connection.queuedDeliveries) {
      deliver(socket);
    }
  }

  private removePendingUserWebSocketConnection(request: IncomingMessage, connection: PendingUserWebSocketConnection) {
    if (this.pendingUserWebSocketConnections.get(request) !== connection) {
      return;
    }

    this.pendingUserWebSocketConnections.delete(request);
    request.socket.off('close', connection.requestSocketCloseListener);
    request.socket.off('end', connection.requestSocketCloseListener);
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
    const runtimeMessageData = deserializeWebSocketMessageDataFromTransport(message.data);

    this.deliverToUserWebSocketConnection(workerSocket, message.clientId, (socket) => {
      socket.send(runtimeMessageData);
    });
  };

  private disconnectClient = (
    rawMessage: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/clients/disconnect'>,
    workerSocket: Socket,
  ) => {
    this.assertWebSocketWorkerSocket(workerSocket);

    const disconnection = parseInterceptorServerRPCData(webSocketClientDisconnectionSchema, rawMessage.data);

    this.deliverToUserWebSocketConnection(workerSocket, disconnection.clientId, (socket) => {
      socket.close(disconnection.code, disconnection.reason);
    });
  };

  private deliverToUserWebSocketConnection(workerSocket: Socket, clientId: string, deliver: (socket: Socket) => void) {
    // A worker can reach only its own connections.
    function isTargetConnection(userConnection: UserWebSocketConnection) {
      return userConnection.workerSocket === workerSocket && userConnection.clientId === clientId;
    }

    for (const [socket, userConnection] of this.activeUserWebSocketConnections) {
      if (isTargetConnection(userConnection)) {
        deliver(socket);
        return;
      }
    }

    // A connection effect may send to or close a connection still being set up, after its earlier deliveries.
    for (const userConnection of this.pendingUserWebSocketConnections.values()) {
      if (isTargetConnection(userConnection)) {
        userConnection.queuedDeliveries.push(deliver);
        return;
      }
    }
  }

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

  // Node joins repeated `Sec-WebSocket-Protocol` headers with commas, so one list covers them in order.
  private getWebSocketRequestProtocols(request: IncomingMessage) {
    const protocols = request.headers['sec-websocket-protocol'] ?? '';

    return protocols
      .split(',')
      .map((protocol) => protocol.trim())
      .filter(Boolean);
  }

  async stop() {
    this.webSocketServer.offChannel('event', 'interceptors/ws/workers/reset', this.resetWorker);
    this.webSocketServer.offChannel('event', 'interceptors/ws/messages/send', this.sendMessage);
    this.webSocketServer.offChannel('event', 'interceptors/ws/clients/disconnect', this.disconnectClient);

    await this.closeUserWebSocketConnections();

    this.webSocketWorkersBySocket.clear();
  }

  private async closeUserWebSocketConnections() {
    // Pending connections have not completed their handshake, so there is no closing handshake to wait for.
    for (const request of this.pendingUserWebSocketConnections.keys()) {
      request.socket.destroy();
    }

    const closingPromises = Array.from(this.activeUserWebSocketConnections.keys(), (socket) =>
      closeWebSocketClient(socket, { timeout: this.webSocketServer.socketTimeout }),
    );

    await Promise.all(closingPromises);
    this.pendingUserWebSocketConnections.clear();
    this.activeUserWebSocketConnections.clear();
  }
}

export default WebSocketInterceptorServerRuntime;
