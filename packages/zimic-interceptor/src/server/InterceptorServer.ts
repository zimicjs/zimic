import { createCachedDynamicImport } from '@zimic/utils/import';
import { startHttpServer, stopHttpServer, getHttpServerPort } from '@zimic/utils/server';
import { excludeNonPathParams } from '@zimic/utils/url';
import type { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'http';
import ClientSocket, { type WebSocket as Socket } from 'isomorphic-ws';

import type { InterceptorServerRPCProtocol } from '@/interceptor/constants';
import { removeArrayIndex } from '@/utils/arrays';
import { closeClientSocket, WebSocketMessageAbortError } from '@/utils/webSocket';
import { WEB_SOCKET_NORMAL_CLOSE_CODE, WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE } from '@/utils/webSocket/constants';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import type { WebSocketEventMessage } from '@/utils/webSocket/types';
import WebSocketServer, {
  type WebSocketServerAuthenticate,
  type WebSocketServerConnectionHandler,
} from '@/utils/webSocket/WebSocketServer';
import {
  deserializeWebSocketMessageData,
  isSerializedWebSocketMessageData,
  serializeRuntimeWebSocketMessageData,
  serializeWebSocketMessageData,
} from '@/ws/utils/messageData';

import {
  DEFAULT_LOG_UNHANDLED_REQUESTS,
  DEFAULT_HOSTNAME,
  INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER,
} from './constants';
import NotRunningInterceptorServerError from './errors/NotRunningInterceptorServerError';
import RunningInterceptorServerError from './errors/RunningInterceptorServerError';
import type HttpInterceptorServerRuntime from './http/HttpInterceptorServerRuntime';
import type { InterceptorServerOptions } from './types/options';
import type { InterceptorServer as PublicInterceptorServer } from './types/public';
import type { InterceptorServerWebSocketSchema, WebSocketHandlerCommit } from './types/schema';
import { validateInterceptorToken } from './utils/auth';

const importHttpInterceptorServerRuntime = createCachedDynamicImport(
  () => import('./http/HttpInterceptorServerRuntime'),
);

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

const WEB_SOCKET_CONNECTION_SETUP_FAILED_CLOSE_REASON = 'Could not connect to the WebSocket interceptor.';
const WORKER_REJECTION_CLOSE_CODE = 1008;
const INVALID_WORKER_PROTOCOL_CLOSE_REASON = 'Invalid interceptor worker protocol.';
const MISSING_HTTP_PEER_CLOSE_REASON =
  'The optional peer dependency "@zimic/http" is required for HTTP interceptor workers.';
const HTTP_RUNTIME_LOAD_FAILED_CLOSE_REASON = 'Could not load the HTTP interceptor runtime.';

class StaleHttpRuntimeLoadError extends Error {}

function isMissingHttpPeerError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  const isModuleNotFoundError = code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND';

  return (isModuleNotFoundError && error.message.includes('@zimic/http')) || isMissingHttpPeerError(error.cause);
}

class InterceptorServer implements PublicInterceptorServer {
  private httpServer?: HttpServer;
  private webSocketServer?: WebSocketServer<InterceptorServerWebSocketSchema>;
  private httpRuntime?: HttpInterceptorServerRuntime;
  private httpRuntimeLoadingPromise?: Promise<HttpInterceptorServerRuntime>;
  private serverGeneration = 0;

  _hostname: string;
  _port: number | undefined;
  logUnhandledRequests: boolean;
  tokensDirectory?: string;

  private workerProtocols = new Map<Socket, InterceptorServerRPCProtocol>();
  private webSocketHandlers: WebSocketHandler[] = [];
  private pendingUserWebSocketHandlers = new Map<Socket, PendingUserWebSocketHandler>();
  private activeUserWebSocketHandlers = new Map<Socket, UserWebSocketHandler>();

  constructor(options: InterceptorServerOptions) {
    this._hostname = options.hostname ?? DEFAULT_HOSTNAME;
    this._port = options.port;
    this.logUnhandledRequests = options.logUnhandledRequests ?? DEFAULT_LOG_UNHANDLED_REQUESTS;
    this.tokensDirectory = options.tokensDirectory;
  }

  get hostname() {
    return this._hostname;
  }

  set hostname(newHostname: string) {
    if (this.isRunning) {
      throw new RunningInterceptorServerError('Did you forget to stop it before changing the hostname?');
    }
    this._hostname = newHostname;
  }

  get port() {
    return this._port;
  }

  set port(newPort: number | undefined) {
    if (this.isRunning) {
      throw new RunningInterceptorServerError('Did you forget to stop it before changing the port?');
    }
    this._port = newPort;
  }

  get isRunning() {
    return !!this.httpServer?.listening && !!this.webSocketServer?.isRunning;
  }

  private get httpServerOrThrow(): HttpServer {
    /* istanbul ignore if -- @preserve
     * The HTTP server is initialized before using this method in normal conditions. */
    if (!this.httpServer) {
      throw new NotRunningInterceptorServerError();
    }
    return this.httpServer;
  }

  private get webSocketServerOrThrow(): WebSocketServer<InterceptorServerWebSocketSchema> {
    /* istanbul ignore if -- @preserve
     * The web socket server is initialized before using this method in normal conditions. */
    if (!this.webSocketServer) {
      throw new NotRunningInterceptorServerError();
    }
    return this.webSocketServer;
  }

  async start() {
    if (this.isRunning) {
      return;
    }

    this.serverGeneration++;
    this.httpServer = createServer({
      keepAlive: true,
      joinDuplicateHeaders: true,
    });
    await this.startHttpServer();

    this.webSocketServer = new WebSocketServer({
      httpServer: this.httpServer,
      authenticate: this.authenticateWebSocketConnection,
      handleConnection: this.handleWebSocketConnection,
    });

    this.startWebSocketServer();
  }

  private authenticateWebSocketConnection: WebSocketServerAuthenticate = async (_socket, request) => {
    if (!this.isWebSocketRpcRequest(request)) {
      return { isValid: true };
    }

    if (!this.tokensDirectory) {
      return { isValid: true };
    }

    const tokenValue = this.getWebSocketRequestTokenValue(request);

    if (!tokenValue) {
      return { isValid: false, message: 'An interceptor token is required, but none was provided.' };
    }

    try {
      await validateInterceptorToken(tokenValue, { tokensDirectory: this.tokensDirectory });
      return { isValid: true };
    } catch (error) {
      console.error(error);
      return { isValid: false, message: 'The interceptor token is not valid.' };
    }
  };

  private getWebSocketRequestTokenValue(request: IncomingMessage) {
    const parametersAsString = this.getWebSocketRequestParameters(request);

    for (const parameterAsString of parametersAsString) {
      const tokenValueMatch = /^token=(?<tokenValue>.+?)$/.exec(parameterAsString);
      const tokenValue = tokenValueMatch?.groups?.tokenValue;

      if (tokenValue) {
        return tokenValue;
      }
    }

    return undefined;
  }

  private isWebSocketRpcRequest(request: IncomingMessage) {
    return this.getWebSocketRequestParameters(request).some(
      (parameter) =>
        parameter === INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER ||
        parameter.startsWith(`${INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER}=`),
    );
  }

  private getWebSocketRPCProtocol(request: IncomingMessage): InterceptorServerRPCProtocol | undefined {
    const protocolParameterPrefix = `${INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER}=`;
    const protocol = this.getWebSocketRequestParameters(request)
      .find((parameter) => parameter.startsWith(protocolParameterPrefix))
      ?.slice(protocolParameterPrefix.length);

    return protocol === 'http' || protocol === 'ws' ? protocol : undefined;
  }

  private getWebSocketRequestParameters(request: IncomingMessage) {
    const protocols = request.headers['sec-websocket-protocol'] ?? '';
    return protocols
      .split(/,\s*/)
      .filter(Boolean)
      .map((parameter) => this.decodeWebSocketRequestParameter(parameter));
  }

  private decodeWebSocketRequestParameter(parameter: string) {
    try {
      return decodeURIComponent(parameter);
    } catch {
      return parameter;
    }
  }

  private async startHttpServer() {
    this.httpServerOrThrow.on('request', this.handleHttpRequest);

    await startHttpServer(this.httpServerOrThrow, {
      hostname: this.hostname,
      port: this.port,
    });

    this.port = getHttpServerPort(this.httpServerOrThrow);
  }

  private startWebSocketServer() {
    this.webSocketServerOrThrow.onChannel('event', 'interceptors/ws/workers/commit', this.commitWebSocketWorker);
    this.webSocketServerOrThrow.onChannel('event', 'interceptors/ws/workers/reset', this.resetWebSocketWorker);
    this.webSocketServerOrThrow.onChannel('event', 'interceptors/ws/messages/send', this.sendWebSocketMessage);

    this.webSocketServerOrThrow.start();
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
    if (this.workerProtocols.get(socket) !== 'ws') {
      throw new InvalidWebSocketMessageError('WebSocket RPC received from a non-WebSocket worker.');
    }
  }

  private registerWebSocketHandler({ id, baseURL }: WebSocketHandlerCommit, socket: Socket) {
    this.webSocketHandlers.push({ id, baseURL, socket });
  }

  private registerWorkerSocket(socket: Socket, protocol: InterceptorServerRPCProtocol) {
    this.workerProtocols.set(socket, protocol);
    socket.addEventListener('close', () => {
      if (protocol === 'http') {
        this.httpRuntime?.removeHandlersBySocket(socket);
      } else {
        this.removeWebSocketHandlersBySocket(socket, {
          pendingCloseCode: WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE,
          pendingCloseReason: WEB_SOCKET_CONNECTION_SETUP_FAILED_CLOSE_REASON,
        });
      }

      this.workerProtocols.delete(socket);
    });
  }

  private removeWebSocketHandlersBySocket(
    socket: Socket,
    options: {
      pendingCloseCode?: number;
      pendingCloseReason?: string;
    } = {},
  ) {
    const handlersToRemove = this.webSocketHandlers.filter((handler) => handler.socket === socket);

    for (const handler of handlersToRemove) {
      this.removeWebSocketHandler(handler, options);
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

    this.webSocketServerOrThrow.emitSocket('abortRequests', handler.socket, {
      shouldAbortRequest: (request) =>
        this.webSocketServerOrThrow.isChannelEvent(request, 'interceptors/ws/clients/connect') &&
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
        userSocket.close(WEB_SOCKET_NORMAL_CLOSE_CODE);
      }
    }
  }

  private async loadHttpRuntime() {
    if (this.httpRuntime) {
      return this.httpRuntime;
    }

    const serverGeneration = this.serverGeneration;
    const loadingPromise =
      this.httpRuntimeLoadingPromise ??
      importHttpInterceptorServerRuntime().then(({ default: Runtime }) => {
        if (serverGeneration !== this.serverGeneration || !this.webSocketServer?.isRunning) {
          throw new StaleHttpRuntimeLoadError();
        }

        const runtime = new Runtime({
          webSocketServer: this.webSocketServerOrThrow,
          isHttpWorkerSocket: (socket) => this.workerProtocols.get(socket) === 'http',
          shouldLogUnhandledRequests: () => this.logUnhandledRequests,
        });

        this.httpRuntime = runtime;
        return runtime;
      });
    this.httpRuntimeLoadingPromise = loadingPromise;

    try {
      return await loadingPromise;
    } finally {
      if (this.httpRuntimeLoadingPromise === loadingPromise) {
        this.httpRuntimeLoadingPromise = undefined;
      }
    }
  }

  private handleWebSocketConnection: WebSocketServerConnectionHandler = async (socket, request) => {
    if (this.isWebSocketRpcRequest(request)) {
      const protocol = this.getWebSocketRPCProtocol(request);

      if (!protocol) {
        socket.resume();
        socket.close(WORKER_REJECTION_CLOSE_CODE, INVALID_WORKER_PROTOCOL_CLOSE_REASON);
        return { wasHandled: true };
      }

      if (protocol === 'http') {
        try {
          await this.loadHttpRuntime();
        } catch (error) {
          console.error(error);
          socket.resume();
          socket.close(
            WORKER_REJECTION_CLOSE_CODE,
            isMissingHttpPeerError(error) ? MISSING_HTTP_PEER_CLOSE_REASON : HTTP_RUNTIME_LOAD_FAILED_CLOSE_REASON,
          );
          return { wasHandled: true };
        }
      }

      this.registerWorkerSocket(socket, protocol);
      return { wasHandled: false };
    }

    const handler = this.findWebSocketHandlerByRequest(request);

    if (!handler) {
      socket.resume();
      socket.close(WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE, 'No WebSocket interceptor is registered for this URL.');
      return { wasHandled: true };
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
      const reply = await this.webSocketServerOrThrow.request(
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
        pendingCloseCode: WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE,
        pendingCloseReason: WEB_SOCKET_CONNECTION_SETUP_FAILED_CLOSE_REASON,
      });
      return { wasHandled: true };
    }

    if (!accepted) {
      this.closePendingUserWebSocketConnection(socket, connection, {
        pendingCloseCode: WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE,
        pendingCloseReason: WEB_SOCKET_CONNECTION_SETUP_FAILED_CLOSE_REASON,
      });
      return { wasHandled: true };
    }

    if (!this.canActivatePendingUserWebSocketConnection(socket, connection)) {
      this.closePendingUserWebSocketConnection(socket, connection, {
        pendingCloseCode: WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE,
        pendingCloseReason: WEB_SOCKET_CONNECTION_SETUP_FAILED_CLOSE_REASON,
      });
      this.notifyUserWebSocketClose(connection);
      return { wasHandled: true };
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

    return { wasHandled: true };
  };

  private canActivatePendingUserWebSocketConnection(socket: Socket, connection: PendingUserWebSocketHandler) {
    return (
      this.pendingUserWebSocketHandlers.get(socket) === connection &&
      this.webSocketHandlers.includes(connection.handler) &&
      this.workerProtocols.get(connection.handler.socket) === 'ws' &&
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
    } = {},
  ) {
    if (!this.removePendingUserWebSocketConnection(socket, connection)) {
      return;
    }

    socket.resume();
    socket.close(options.pendingCloseCode ?? WEB_SOCKET_NORMAL_CLOSE_CODE, options.pendingCloseReason);
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
      this.webSocketServerOrThrow.send(
        'interceptors/ws/clients/close',
        {
          clientId: connection.clientId,
        },
        { sockets: [connection.handler.socket] },
      );
    } catch (error) {
      console.error(error);
    }
  }

  private async handleUserWebSocketMessage(connection: UserWebSocketHandler, message: ClientSocket.MessageEvent) {
    try {
      await this.webSocketServerOrThrow.request(
        'interceptors/ws/messages/handle',
        {
          handlerId: connection.handler.id,
          clientId: connection.clientId,
          data: await serializeWebSocketMessageData<WebSocketSchema>(
            message.data as WebSocketMessageData<WebSocketSchema>,
          ),
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

    const targetSockets = Array.from(this.activeUserWebSocketHandlers.entries()).filter(([, userHandler]) => {
      const isOwnedByWorker = userHandler.handler.socket === workerSocket;
      const matchesClient = message.clientId === undefined || userHandler.clientId === message.clientId;
      const matchesHandler = message.handlerId === undefined || userHandler.handler.id === message.handlerId;

      return isOwnedByWorker && matchesClient && matchesHandler;
    });

    const runtimeMessageData = serializeRuntimeWebSocketMessageData<WebSocketSchema>(
      deserializeWebSocketMessageData(message.data),
    );

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

  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.serverGeneration++;
    this.httpRuntimeLoadingPromise = undefined;
    await this.stopWebSocketServer();
    await this.stopHttpServer();
  }

  private async stopHttpServer() {
    await stopHttpServer(this.httpServerOrThrow);
    this.httpServerOrThrow.removeAllListeners();
    this.httpServer = undefined;
  }

  private async stopWebSocketServer() {
    this.httpRuntime?.stop();
    this.httpRuntime = undefined;

    this.webSocketServerOrThrow.offChannel('event', 'interceptors/ws/workers/commit', this.commitWebSocketWorker);
    this.webSocketServerOrThrow.offChannel('event', 'interceptors/ws/workers/reset', this.resetWebSocketWorker);
    this.webSocketServerOrThrow.offChannel('event', 'interceptors/ws/messages/send', this.sendWebSocketMessage);

    await this.closeUserWebSocketConnections();

    await this.webSocketServerOrThrow.stop();

    this.workerProtocols.clear();
    this.webSocketServer = undefined;
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
      closeClientSocket(socket, { timeout: this.webSocketServerOrThrow.socketTimeout }),
    );

    await Promise.all(closingPromises);
    this.pendingUserWebSocketHandlers.clear();
    this.activeUserWebSocketHandlers.clear();
  }

  private handleHttpRequest = (nodeRequest: IncomingMessage, nodeResponse: ServerResponse) => {
    if (!this.httpRuntime) {
      nodeResponse.destroy();
      return;
    }

    return this.httpRuntime.handleRequest(nodeRequest, nodeResponse);
  };
}

export default InterceptorServer;
