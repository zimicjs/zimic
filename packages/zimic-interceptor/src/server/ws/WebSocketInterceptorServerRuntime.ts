import { excludeNonPathParams } from '@zimic/utils/url';
import { closeWebSocketClient } from '@zimic/utils/ws';
import type { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import type { IncomingMessage } from 'http';
import type { WebSocket as Socket } from 'isomorphic-ws';
import { WebSocket as ClientSocket } from 'ws';
import * as z from 'zod';

import { removeArrayIndex } from '@/utils/arrays';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import type { WebSocketEventMessage } from '@/utils/webSocket/types';
import type WebSocketServer from '@/utils/webSocket/WebSocketServer';
import {
  deserializeWebSocketMessageDataFromTransport,
  serializeWebSocketMessageDataForTransport,
} from '@/ws/utils/messageData';

import type { InterceptorServerWebSocketSchema, WebSocketHandlerCommit } from '../types/schema';
import { parseInterceptorServerRPCData } from '../utils/rpc';

const webSocketHandlerCommitSchema = z.object({
  id: z.string(),
  baseURL: z.url({ protocol: /^wss?$/ }),
}) satisfies z.ZodType<WebSocketHandlerCommit>;

const webSocketHandlerCommitsSchema = z.array(webSocketHandlerCommitSchema);

const webSocketMessageSendSchema = z.object({
  clientId: z.string().optional(),
  handlerId: z.string().optional(),
  data: z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), data: z.string() }),
    z.object({ type: z.literal('binary'), data: z.base64() }),
  ]),
});

const clientConnectionReplySchema = z.object({ accepted: z.boolean() });

interface WebSocketHandler {
  id: string;
  baseURL: string;
  socket: Socket;
}

interface UserWebSocketHandler {
  clientId: string;
  handler: WebSocketHandler;
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

  private webSocketHandlers: WebSocketHandler[] = [];
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

    const handlersToRecommit = parseInterceptorServerRPCData(webSocketHandlerCommitsSchema, message.data);

    const existingHandlersById = new Map(
      this.webSocketHandlers
        .filter((handler) => handler.socket === socket)
        .map((handler) => [handler.id, handler] as const),
    );

    for (const commit of handlersToRecommit) {
      const existingHandler = existingHandlersById.get(commit.id);

      if (existingHandler) {
        existingHandler.baseURL = commit.baseURL;
        existingHandlersById.delete(commit.id);
      } else {
        this.registerWebSocketHandler(commit, socket);
      }
    }

    for (const removedHandler of existingHandlersById.values()) {
      this.removeWebSocketHandler(removedHandler);
    }

    return {};
  };

  private registerWebSocketHandler({ id, baseURL }: WebSocketHandlerCommit, socket: Socket) {
    this.webSocketHandlers.push({ id, baseURL, socket });
  }

  removeHandlersBySocket(socket: Socket) {
    const handlersToRemove = this.webSocketHandlers.filter((handler) => handler.socket === socket);

    for (const handler of handlersToRemove) {
      this.removeWebSocketHandler(handler, {
        pendingCloseCode: WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR,
        pendingCloseReason: WEB_SOCKET_CLOSE_REASONS.CONNECTION_SETUP_FAILED,
      });
    }
  }

  private removeWebSocketHandler(
    handler: WebSocketHandler,
    options: {
      pendingCloseCode?: number;
      pendingCloseReason?: string;
    } = {},
  ) {
    const handlerIndex = this.webSocketHandlers.indexOf(handler);
    removeArrayIndex(this.webSocketHandlers, handlerIndex);

    this.webSocketServer.emitSocket('abortRequests', handler.socket, {
      shouldAbortRequest: (request) =>
        this.webSocketServer.isChannelEvent(request, 'interceptors/ws/clients/connect') &&
        request.data.handlerId === handler.id,
    });

    for (const [userSocket, userHandler] of this.pendingUserWebSocketHandlers) {
      if (userHandler.handler === handler) {
        this.closePendingUserWebSocketConnection(userSocket, userHandler, options);
      }
    }

    for (const [userSocket, userHandler] of this.activeUserWebSocketHandlers) {
      if (userHandler.handler === handler) {
        this.activeUserWebSocketHandlers.delete(userSocket);
        userSocket.close(WEB_SOCKET_CLOSE_CODES.DEFAULT);
      }
    }
  }

  handleConnection = async (socket: Socket, request: IncomingMessage) => {
    const handler = this.findWebSocketHandlerByRequest(request);

    if (!handler) {
      socket.resume();
      socket.close(WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR, WEB_SOCKET_CLOSE_REASONS.NO_REGISTERED_INTERCEPTOR);
      return;
    }

    const clientId = crypto.randomUUID();

    const connection: PendingUserWebSocketHandler = {
      clientId,
      handler,
      closeListener: () => {
        this.removePendingUserWebSocketConnection(socket, connection);
      },
    };

    socket.pause();
    socket.addEventListener('close', connection.closeListener, { once: true });

    this.pendingUserWebSocketHandlers.set(socket, connection);

    let accepted: boolean;

    try {
      const reply = await this.webSocketServer.request(
        'interceptors/ws/clients/connect',
        {
          handlerId: handler.id,
          clientId,
          url: this.getWebSocketRequestURL(request).href,
        },
        { sockets: [handler.socket] },
      );

      accepted = parseInterceptorServerRPCData(clientConnectionReplySchema, reply).accepted;
    } catch (error) {
      if (error instanceof InvalidWebSocketMessageError) {
        console.error(error);
      }

      this.closePendingUserWebSocketConnection(socket, connection, {
        pendingCloseCode: WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR,
        pendingCloseReason: WEB_SOCKET_CLOSE_REASONS.CONNECTION_SETUP_FAILED,
      });

      return;
    }

    if (!accepted) {
      this.closePendingUserWebSocketConnection(socket, connection, {
        pendingCloseCode: WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR,
        pendingCloseReason: WEB_SOCKET_CLOSE_REASONS.CONNECTION_SETUP_FAILED,
      });

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
      this.webSocketHandlers.includes(connection.handler) &&
      this.isWebSocketWorkerSocket(connection.handler.socket) &&
      connection.handler.socket.readyState === ClientSocket.OPEN &&
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
    if (connection.handler.socket.readyState !== ClientSocket.OPEN || !this.webSocketServer.isRunning) {
      return;
    }

    this.webSocketServer.send(
      'interceptors/ws/clients/close',
      { clientId: connection.clientId },
      { sockets: [connection.handler.socket] },
    );
  }

  private async handleUserWebSocketMessage(connection: UserWebSocketHandler, message: ClientSocket.MessageEvent) {
    try {
      await this.webSocketServer.request(
        'interceptors/ws/messages/handle',
        {
          handlerId: connection.handler.id,
          clientId: connection.clientId,
          data: await serializeWebSocketMessageDataForTransport(message.data as WebSocketMessageData<WebSocketSchema>),
        },
        { sockets: [connection.handler.socket] },
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
      const isOwnedByWorker = userHandler.handler.socket === workerSocket;
      const matchesClient = message.clientId === undefined || userHandler.clientId === message.clientId;
      const matchesHandler = message.handlerId === undefined || userHandler.handler.id === message.handlerId;

      return isOwnedByWorker && matchesClient && matchesHandler;
    });

    const runtimeMessageData = deserializeWebSocketMessageDataFromTransport(message.data);

    for (const [socket] of targetSockets) {
      socket.send(runtimeMessageData);
    }
  };

  private findWebSocketHandlerByRequest(request: IncomingMessage) {
    const requestURLAsString = this.normalizeWebSocketBaseURL(this.getWebSocketRequestURL(request));

    const handler = this.webSocketHandlers.findLast(
      (handler) => requestURLAsString === this.normalizeWebSocketBaseURL(handler.baseURL),
    );
    return handler;
  }

  private getWebSocketRequestURL(request: IncomingMessage) {
    /* istanbul ignore next -- @preserve
     * Upgrade requests always include a URL in the supported Node runtimes. */
    return new URL(request.url ?? '/', `ws://${request.headers.host}`);
  }

  private normalizeWebSocketBaseURL(url: string | URL) {
    const normalizedURL = excludeNonPathParams(new URL(url));
    return normalizedURL.href === `${normalizedURL.origin}/` ? normalizedURL.origin : normalizedURL.href;
  }

  async stop() {
    this.webSocketServer.offChannel('event', 'interceptors/ws/workers/commit', this.commitWorker);
    this.webSocketServer.offChannel('event', 'interceptors/ws/workers/reset', this.resetWorker);
    this.webSocketServer.offChannel('event', 'interceptors/ws/messages/send', this.sendMessage);

    await this.closeUserWebSocketConnections();

    this.webSocketHandlers.length = 0;
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
