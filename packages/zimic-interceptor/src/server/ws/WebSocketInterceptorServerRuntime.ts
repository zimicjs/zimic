import { excludeNonPathParams } from '@zimic/utils/url';
import type { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import type { IncomingMessage } from 'http';
import type { WebSocket as Socket } from 'isomorphic-ws';
import { WebSocket as ClientSocket } from 'ws';

import { removeArrayIndex } from '@/utils/arrays';
import { closeClientSocket, WebSocketMessageAbortError } from '@/utils/webSocket';
import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import type { WebSocketEventMessage } from '@/utils/webSocket/types';
import WebSocketServer from '@/utils/webSocket/WebSocketServer';
import {
  deserializeWebSocketMessageDataFromTransport,
  isSerializedWebSocketMessageData,
  serializeWebSocketMessageDataForTransport,
} from '@/ws/utils/messageData';

import type { InterceptorServerWebSocketSchema, WebSocketHandlerCommit } from '../types/schema';

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

interface WebSocketHandlerRemovalOptions {
  pendingCloseCode?: number;
  pendingCloseReason?: string;
}

interface WebSocketInterceptorServerRuntimeOptions {
  webSocketServer: WebSocketServer<InterceptorServerWebSocketSchema>;
  isWebSocketWorkerSocket: (socket: Socket) => boolean;
}

const WEB_SOCKET_CLOSE_REASONS = Object.freeze({
  CONNECTION_SETUP_FAILED: 'Could not connect to the WebSocket interceptor.',
  NO_REGISTERED_INTERCEPTOR: 'No WebSocket interceptor is registered for this URL.',
} as const);

class WebSocketInterceptorServerRuntime {
  private webSocketServer: WebSocketInterceptorServerRuntimeOptions['webSocketServer'];
  private isWebSocketWorkerSocket: WebSocketInterceptorServerRuntimeOptions['isWebSocketWorkerSocket'];

  private webSocketHandlers: WebSocketHandler[] = [];
  private pendingUserWebSocketHandlers = new Map<Socket, PendingUserWebSocketHandler>();
  private activeUserWebSocketHandlers = new Map<Socket, UserWebSocketHandler>();

  constructor(options: WebSocketInterceptorServerRuntimeOptions) {
    this.webSocketServer = options.webSocketServer;
    this.isWebSocketWorkerSocket = options.isWebSocketWorkerSocket;

    this.webSocketServer.onChannel('event', 'interceptors/ws/workers/commit', this.commitWebSocketWorker);
    this.webSocketServer.onChannel('event', 'interceptors/ws/workers/reset', this.resetWebSocketWorker);
    this.webSocketServer.onChannel('event', 'interceptors/ws/messages/send', this.sendWebSocketMessage);
  }

  private commitWebSocketWorker = (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/workers/commit'>,
    socket: Socket,
  ) => {
    this.assertWebSocketWorkerSocket(socket);

    const commit = message.data;
    this.validateWebSocketHandlerCommit(commit);

    this.registerWebSocketHandler(commit, socket);
    return {};
  };

  private resetWebSocketWorker = (
    {
      data: handlersToRecommit,
    }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/workers/reset'>,
    socket: Socket,
  ) => {
    this.assertWebSocketWorkerSocket(socket);
    this.validateWebSocketHandlerCommits(handlersToRecommit);

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

  private assertWebSocketWorkerSocket(socket: Socket) {
    if (!this.isWebSocketWorkerSocket(socket)) {
      throw new InvalidWebSocketMessageError('WebSocket RPC received from a non-WebSocket worker.');
    }
  }

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

  private removeWebSocketHandler(handler: WebSocketHandler, options: WebSocketHandlerRemovalOptions = {}) {
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

      return { handled: true };
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

      accepted = reply.accepted;
    } catch {
      this.closePendingUserWebSocketConnection(socket, connection, {
        pendingCloseCode: WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR,
        pendingCloseReason: WEB_SOCKET_CLOSE_REASONS.CONNECTION_SETUP_FAILED,
      });

      return { handled: true };
    }

    if (!accepted) {
      this.closePendingUserWebSocketConnection(socket, connection, {
        pendingCloseCode: WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR,
        pendingCloseReason: WEB_SOCKET_CLOSE_REASONS.CONNECTION_SETUP_FAILED,
      });

      return { handled: true };
    }

    if (!this.canActivatePendingUserWebSocketConnection(socket, connection)) {
      this.closePendingUserWebSocketConnection(socket, connection, {
        pendingCloseCode: WEB_SOCKET_CLOSE_CODES.PROTOCOL_ERROR,
        pendingCloseReason: WEB_SOCKET_CLOSE_REASONS.CONNECTION_SETUP_FAILED,
      });

      this.notifyUserWebSocketClose(connection);

      return { handled: true };
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

    return { handled: true };
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
    options: WebSocketHandlerRemovalOptions = {},
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
    if (connection.handler.socket.readyState !== ClientSocket.OPEN) {
      return;
    }

    try {
      this.webSocketServer.send(
        'interceptors/ws/clients/close',
        { clientId: connection.clientId },
        { sockets: [connection.handler.socket] },
      );
    } catch (error) {
      console.error(error);
    }
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

  private sendWebSocketMessage = (
    { data: message }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/messages/send'>,
    workerSocket: Socket,
  ) => {
    this.assertWebSocketWorkerSocket(workerSocket);
    this.validateWebSocketSendMessage(message);

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

  private validateWebSocketHandlerCommit(commit: unknown): asserts commit is WebSocketHandlerCommit {
    const isValid =
      typeof commit === 'object' &&
      commit !== null &&
      'id' in commit &&
      typeof commit.id === 'string' &&
      'baseURL' in commit &&
      typeof commit.baseURL === 'string' &&
      this.isValidWebSocketHandlerBaseURL(commit.baseURL);

    if (!isValid) {
      throw new InvalidWebSocketMessageError(JSON.stringify(commit));
    }
  }

  private isValidWebSocketHandlerBaseURL(baseURL: string) {
    try {
      const protocol = new URL(baseURL).protocol;
      return protocol === 'ws:' || protocol === 'wss:';
    } catch {
      return false;
    }
  }

  private validateWebSocketHandlerCommits(commits: unknown): asserts commits is WebSocketHandlerCommit[] {
    const isValid = Array.isArray(commits);

    /* istanbul ignore if -- @preserve
     * Invalid reset payloads are rejected by the RPC schema before normal workers can send them. */
    if (!isValid) {
      throw new InvalidWebSocketMessageError(JSON.stringify(commits));
    }

    for (const commit of commits) {
      this.validateWebSocketHandlerCommit(commit);
    }
  }

  private validateWebSocketSendMessage(
    message: unknown,
  ): asserts message is InterceptorServerWebSocketSchema['interceptors/ws/messages/send']['event'] {
    const isValid =
      typeof message === 'object' &&
      message !== null &&
      (!('clientId' in message) || typeof message.clientId === 'string') &&
      (!('handlerId' in message) || typeof message.handlerId === 'string') &&
      'data' in message &&
      isSerializedWebSocketMessageData(message.data);

    if (!isValid) {
      throw new InvalidWebSocketMessageError(JSON.stringify(message));
    }
  }

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

  private async closeUserWebSocketConnections() {
    for (const socket of this.pendingUserWebSocketHandlers.keys()) {
      socket.resume();
    }

    const userSockets = new Set([
      ...this.pendingUserWebSocketHandlers.keys(),
      ...this.activeUserWebSocketHandlers.keys(),
    ]);

    const closingPromises = Array.from(userSockets, (socket) =>
      closeClientSocket(socket, { timeout: this.webSocketServer.socketTimeout }),
    );

    await Promise.all(closingPromises);
    this.pendingUserWebSocketHandlers.clear();
    this.activeUserWebSocketHandlers.clear();
  }

  async stop() {
    this.webSocketServer.offChannel('event', 'interceptors/ws/workers/commit', this.commitWebSocketWorker);
    this.webSocketServer.offChannel('event', 'interceptors/ws/workers/reset', this.resetWebSocketWorker);
    this.webSocketServer.offChannel('event', 'interceptors/ws/messages/send', this.sendWebSocketMessage);

    await this.closeUserWebSocketConnections();
    this.webSocketHandlers.length = 0;
  }
}

export default WebSocketInterceptorServerRuntime;
