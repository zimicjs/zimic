import { excludeNonPathParams } from '@zimic/utils/url';
import { closeWebSocketClient } from '@zimic/utils/ws';
import type { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import type { IncomingMessage } from 'http';
import type { WebSocket as Socket } from 'isomorphic-ws';
import { WebSocket as ClientSocket } from 'ws';
import * as z from 'zod';

import { WebSocketMessageAbortError } from '@/utils/webSocket';
import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import type { WebSocketEventMessage } from '@/utils/webSocket/types';
import type WebSocketServer from '@/utils/webSocket/WebSocketServer';
import {
  deserializeWebSocketMessageDataFromTransport,
  serializeWebSocketMessageDataForTransport,
} from '@/ws/utils/messageData';

import type { InterceptorServerWebSocketSchema, WebSocketHandlerCommit, WebSocketHandlerReset } from '../types/schema';
import { parseInterceptorServerRPCData } from '../utils/rpc';

const webSocketHandlerCommitSchema = z.object({
  id: z.string(),
  baseURL: z.url({ protocol: /^wss?$/ }),
}) satisfies z.ZodType<WebSocketHandlerCommit>;

const webSocketHandlerResetSchema = z.object({
  handlers: z.array(webSocketHandlerCommitSchema),
  clearedHandlerIds: z.array(z.string()).optional(),
}) satisfies z.ZodType<WebSocketHandlerReset>;

const webSocketMessageSendSchema = z.object({
  clientId: z.string().optional(),
  handlerId: z.string().optional(),
  data: z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), data: z.string() }),
    z.object({ type: z.literal('binary'), data: z.base64() }),
  ]),
});

const clientConnectionReplySchema = z.object({ accepted: z.boolean() });

const messageHandlingReplySchema = z.object({
  // Workers that do not send this field log unhandled messages themselves, so their reply ends the fall-through.
  handled: z.boolean().optional(),
  error: z.boolean().optional(),
});

interface WebSocketHandler {
  id: string;
  baseURL: string;
  socket: Socket;
}

interface UserWebSocketHandler {
  clientId: string;
  workerSocket: Socket;
  // Kept in the order of the worker's handlers, so the last holder is the newest.
  holders: WebSocketHandler[];
}

interface PendingUserWebSocketHandler extends UserWebSocketHandler {
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

  // Workers are kept in the order of their first committed handler, which decides the worker that holds a connection.
  // Each worker keeps that position until its socket disconnects, even if all of its handlers are removed.
  private webSocketHandlersByWorkerSocket = new Map<Socket, WebSocketHandler[]>();
  private pendingUserWebSocketHandlers = new Map<Socket, PendingUserWebSocketHandler>();
  private activeUserWebSocketHandlers = new Map<Socket, UserWebSocketHandler>();

  constructor(options: WebSocketInterceptorServerRuntimeOptions) {
    this.webSocketServer = options.webSocketServer;
    this.isWebSocketWorkerSocket = options.isWebSocketWorkerSocket;

    this.webSocketServer.onChannel('event', 'interceptors/ws/workers/commit', this.commitWorker);
    this.webSocketServer.onChannel('event', 'interceptors/ws/workers/reset', this.resetWorker);
    this.webSocketServer.onChannel('event', 'interceptors/ws/messages/send', this.sendMessage);
  }

  private assertWebSocketWorkerSocket(socket: Socket) {
    if (!this.isWebSocketWorkerSocket(socket)) {
      throw new InvalidWebSocketMessageError('WebSocket RPC received from a non-WebSocket worker.');
    }
  }

  private commitWorker = (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/workers/commit'>,
    socket: Socket,
  ) => {
    this.assertWebSocketWorkerSocket(socket);

    this.registerWebSocketHandler(parseInterceptorServerRPCData(webSocketHandlerCommitSchema, message.data), socket);
    return {};
  };

  private resetWorker = (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/workers/reset'>,
    socket: Socket,
  ) => {
    this.assertWebSocketWorkerSocket(socket);

    const reset = parseInterceptorServerRPCData(webSocketHandlerResetSchema, message.data);
    const clearedHandlerIds = new Set(reset.clearedHandlerIds);

    const existingHandlersById = new Map(
      (this.webSocketHandlersByWorkerSocket.get(socket) ?? []).map((handler) => [handler.id, handler] as const),
    );

    const resetHandlers = reset.handlers.map((commit) => {
      const existingHandler = existingHandlersById.get(commit.id);

      if (!existingHandler) {
        return this.createWebSocketHandler(commit, socket);
      }

      existingHandler.baseURL = commit.baseURL;
      existingHandlersById.delete(commit.id);

      // A cleared handler keeps its registration, which decides the holders of new connections, but loses its
      // connections.
      if (clearedHandlerIds.has(commit.id)) {
        this.closeWebSocketHandlerConnections(existingHandler);
      }

      return existingHandler;
    });

    for (const removedHandler of existingHandlersById.values()) {
      this.closeWebSocketHandlerConnections(removedHandler);
    }

    const hasWorkerPosition = this.webSocketHandlersByWorkerSocket.has(socket);

    // A worker takes its position with its first handler. Setting the handlers of a socket already in the map keeps its
    // position.
    if (hasWorkerPosition || resetHandlers.length > 0) {
      this.webSocketHandlersByWorkerSocket.set(socket, resetHandlers);
    }

    return {};
  };

  private registerWebSocketHandler(commit: WebSocketHandlerCommit, socket: Socket) {
    const handlers = this.webSocketHandlersByWorkerSocket.get(socket) ?? [];
    handlers.push(this.createWebSocketHandler(commit, socket));
    this.webSocketHandlersByWorkerSocket.set(socket, handlers);
  }

  private createWebSocketHandler({ id, baseURL }: WebSocketHandlerCommit, socket: Socket): WebSocketHandler {
    return { id, baseURL, socket };
  }

  private isWebSocketHandlerRegistered(handler: WebSocketHandler) {
    return this.webSocketHandlersByWorkerSocket.get(handler.socket)?.includes(handler) ?? false;
  }

  removeHandlersBySocket(socket: Socket) {
    for (const handler of this.webSocketHandlersByWorkerSocket.get(socket) ?? []) {
      this.closeWebSocketHandlerConnections(handler, {
        pendingCloseCode: WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR,
        pendingCloseReason: WEB_SOCKET_CLOSE_REASONS.CONNECTION_SETUP_FAILED,
      });
    }

    this.webSocketHandlersByWorkerSocket.delete(socket);
  }

  private closeWebSocketHandlerConnections(
    handler: WebSocketHandler,
    options: {
      pendingCloseCode?: number;
      pendingCloseReason?: string;
    } = {},
  ) {
    this.webSocketServer.emitSocket('abortRequests', handler.socket, {
      shouldAbortRequest: (request) =>
        this.webSocketServer.isChannelEvent(request, 'interceptors/ws/clients/connect') &&
        request.data.handlerId === handler.id,
    });

    for (const [userSocket, userHandler] of this.pendingUserWebSocketHandlers) {
      if (userHandler.holders.includes(handler)) {
        this.closePendingUserWebSocketConnection(userSocket, userHandler, options);

        // The worker may have accepted the connection after the server stopped waiting for its reply, so it is told
        // to forget the client.
        this.notifyUserWebSocketClose(userHandler);
      }
    }

    for (const [userSocket, userHandler] of this.activeUserWebSocketHandlers) {
      if (userHandler.holders.includes(handler)) {
        this.activeUserWebSocketHandlers.delete(userSocket);
        userSocket.close(WEB_SOCKET_CLOSE_CODES.DEFAULT);
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

    const connection: PendingUserWebSocketHandler = {
      clientId,
      workerSocket: connectionTarget.workerSocket,
      holders: connectionTarget.holders,
      closeListener: () => {
        this.removePendingUserWebSocketConnection(socket, connection);
      },
    };

    socket.pause();
    socket.addEventListener('close', connection.closeListener, { once: true });

    this.pendingUserWebSocketHandlers.set(socket, connection);

    let accepted: boolean;

    try {
      const requestURL = this.getWebSocketRequestURL(request).href;

      const replies = await Promise.all(
        connection.holders.map((holder) =>
          this.webSocketServer.request(
            'interceptors/ws/clients/connect',
            { handlerId: holder.id, clientId, url: requestURL },
            { sockets: [connection.workerSocket] },
          ),
        ),
      );

      accepted = replies.every((reply) => parseInterceptorServerRPCData(clientConnectionReplySchema, reply).accepted);
    } catch (error) {
      if (error instanceof InvalidWebSocketMessageError) {
        console.error(error);
      }

      this.closePendingUserWebSocketConnection(socket, connection, {
        pendingCloseCode: WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR,
        pendingCloseReason: WEB_SOCKET_CLOSE_REASONS.CONNECTION_SETUP_FAILED,
      });

      // Other holders may have accepted the connection, so the worker is told to forget the client.
      this.notifyUserWebSocketClose(connection);

      return;
    }

    if (!accepted) {
      this.closePendingUserWebSocketConnection(socket, connection, {
        pendingCloseCode: WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR,
        pendingCloseReason: WEB_SOCKET_CLOSE_REASONS.CONNECTION_SETUP_FAILED,
      });

      this.notifyUserWebSocketClose(connection);

      return;
    }

    if (!this.canActivatePendingUserWebSocketConnection(socket, connection)) {
      this.closePendingUserWebSocketConnection(socket, connection, {
        pendingCloseCode: WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR,
        pendingCloseReason: WEB_SOCKET_CLOSE_REASONS.CONNECTION_SETUP_FAILED,
      });

      this.notifyUserWebSocketClose(connection);

      return;
    }

    const messageListener = this.createUserWebSocketMessageListener(connection);

    socket.addEventListener('close', () => {
      this.activeUserWebSocketHandlers.delete(socket);
      socket.removeEventListener('message', messageListener);
      this.notifyUserWebSocketClose(connection);
    });

    socket.addEventListener('message', messageListener);

    this.activeUserWebSocketHandlers.set(socket, connection);
    this.removePendingUserWebSocketConnection(socket, connection);

    socket.resume();
  };

  private canActivatePendingUserWebSocketConnection(socket: Socket, connection: PendingUserWebSocketHandler) {
    return (
      this.pendingUserWebSocketHandlers.get(socket) === connection &&
      connection.holders.every((holder) => this.isWebSocketHandlerRegistered(holder)) &&
      this.isWebSocketWorkerSocket(connection.workerSocket) &&
      connection.workerSocket.readyState === ClientSocket.OPEN &&
      socket.readyState === ClientSocket.OPEN
    );
  }

  private removePendingUserWebSocketConnection(socket: Socket, connection: PendingUserWebSocketHandler) {
    if (this.pendingUserWebSocketHandlers.get(socket) !== connection) {
      return false;
    }

    this.pendingUserWebSocketHandlers.delete(socket);
    socket.removeEventListener('close', connection.closeListener);

    return true;
  }

  private closePendingUserWebSocketConnection(
    socket: Socket,
    connection: PendingUserWebSocketHandler,
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

  private createUserWebSocketMessageListener(connection: UserWebSocketHandler) {
    return (message: ClientSocket.MessageEvent) => {
      void this.handleUserWebSocketMessage(connection, message).catch(
        /* istanbul ignore next -- @preserve
         * Message errors require the worker RPC to fail after a user message has already been received. */
        (error: unknown) => {
          console.error(error);
        },
      );
    };
  }

  private notifyUserWebSocketClose(connection: UserWebSocketHandler) {
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

  private async handleUserWebSocketMessage(connection: UserWebSocketHandler, message: ClientSocket.MessageEvent) {
    const { holders } = connection;

    try {
      const data = await serializeWebSocketMessageDataForTransport(
        message.data as WebSocketMessageData<WebSocketSchema>,
      );

      // Messages fall through holders from the last started to the first, as HTTP requests fall through interceptors.
      for (let holderIndex = holders.length - 1; holderIndex >= 0; holderIndex--) {
        const reply = await this.webSocketServer.request(
          'interceptors/ws/messages/handle',
          { handlerId: holders[holderIndex].id, clientId: connection.clientId, data },
          { sockets: [connection.workerSocket] },
        );
        const { handled = true, error: failedToHandleMessage } = parseInterceptorServerRPCData(
          messageHandlingReplySchema,
          reply,
        );

        // A handler that threw may have already counted the message, such as toward its `times` limit, so older
        // holders are not tried.
        if (handled || failedToHandleMessage) {
          return;
        }
      }

      const newestHolder = holders[holders.length - 1];

      await this.webSocketServer.request(
        'interceptors/ws/messages/unhandled',
        { handlerId: newestHolder.id, data },
        { sockets: [connection.workerSocket] },
      );
      /* istanbul ignore next -- @preserve
       * Message aborts depend on an RPC disconnect during message forwarding. */
    } catch (error) {
      /* istanbul ignore next -- @preserve */
      const isMessageAbortError = error instanceof WebSocketMessageAbortError;

      /* istanbul ignore next -- @preserve */
      if (!isMessageAbortError) {
        throw error;
      }
    }
  }

  private sendMessage = (
    rawMessage: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/messages/send'>,
    workerSocket: Socket,
  ) => {
    this.assertWebSocketWorkerSocket(workerSocket);

    const message = parseInterceptorServerRPCData(webSocketMessageSendSchema, rawMessage.data);

    const targetSockets = [
      ...this.activeUserWebSocketHandlers.entries(),
      ...this.pendingUserWebSocketHandlers.entries(),
    ].filter(([, userHandler]) => {
      const isOwnedByWorker = userHandler.workerSocket === workerSocket;
      const matchesClient = message.clientId === undefined || userHandler.clientId === message.clientId;
      const matchesHandler =
        message.handlerId === undefined || userHandler.holders.some((holder) => holder.id === message.handlerId);

      return isOwnedByWorker && matchesClient && matchesHandler;
    });

    const runtimeMessageData = deserializeWebSocketMessageDataFromTransport(message.data);

    for (const [socket] of targetSockets) {
      socket.send(runtimeMessageData);
    }
  };

  private findConnectionTargetByRequest(request: IncomingMessage) {
    const requestURL = excludeNonPathParams(this.getWebSocketRequestURL(request));

    const workers = Array.from(this.webSocketHandlersByWorkerSocket, ([workerSocket, handlers]) => ({
      workerSocket,
      holders: handlers.filter((handler) => requestURL.href.startsWith(handler.baseURL)),
    }));

    // Only one worker holds a connection, the same one that decides the unhandled message strategy. Other workers belong
    // to other processes or authentication tokens, so they do not serve each other's connections.
    return workers.findLast((worker) => worker.holders.length > 0);
  }

  private getWebSocketRequestURL(request: IncomingMessage) {
    /* istanbul ignore next -- @preserve
     * Upgrade requests always include a URL in the supported Node runtimes. */
    return new URL(request.url ?? '/', `ws://${request.headers.host}`);
  }

  async stop() {
    this.webSocketServer.offChannel('event', 'interceptors/ws/workers/commit', this.commitWorker);
    this.webSocketServer.offChannel('event', 'interceptors/ws/workers/reset', this.resetWorker);
    this.webSocketServer.offChannel('event', 'interceptors/ws/messages/send', this.sendMessage);

    await this.closeUserWebSocketConnections();

    this.webSocketHandlersByWorkerSocket.clear();
  }

  private async closeUserWebSocketConnections() {
    for (const socket of this.pendingUserWebSocketHandlers.keys()) {
      socket.resume();
    }

    const userSockets = new Set([
      ...this.pendingUserWebSocketHandlers.keys(),
      ...this.activeUserWebSocketHandlers.keys(),
    ]);

    const closingPromises = Array.from(userSockets, (socket) =>
      closeWebSocketClient(socket, { timeout: this.webSocketServer.socketTimeout }),
    );

    await Promise.all(closingPromises);
    this.pendingUserWebSocketHandlers.clear();
    this.activeUserWebSocketHandlers.clear();
  }
}

export default WebSocketInterceptorServerRuntime;
