import { normalizeNodeRequest, sendNodeResponse } from '@whatwg-node/server';
import { HttpRequest, HttpMethod } from '@zimic/http';
import { startHttpServer, stopHttpServer, getHttpServerPort } from '@zimic/utils/server';
import { createRegexFromPath, excludeNonPathParams } from '@zimic/utils/url';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import ClientSocket, { type WebSocket as Socket } from 'isomorphic-ws';

import HttpInterceptorWorker from '@/http/interceptorWorker/HttpInterceptorWorker';
import { removeArrayIndex } from '@/utils/arrays';
import { deserializeResponse, SerializedHttpRequest, serializeRequest } from '@/utils/fetch';
import { closeClientSocket, WebSocketMessageAbortError } from '@/utils/webSocket';
import { WEB_SOCKET_NORMAL_CLOSE_CODE, WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE } from '@/utils/webSocket/constants';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import { WebSocketEventMessage } from '@/utils/webSocket/types';
import WebSocketServer, {
  WebSocketServerAuthenticate,
  WebSocketServerConnectionHandler,
} from '@/utils/webSocket/WebSocketServer';
import {
  deserializeWebSocketMessageData,
  isSerializedWebSocketMessageData,
  serializeRuntimeWebSocketMessageData,
  serializeWebSocketMessageData,
} from '@/ws/utils/messageData';

import {
  DEFAULT_ACCESS_CONTROL_HEADERS,
  DEFAULT_PREFLIGHT_STATUS_CODE,
  DEFAULT_LOG_UNHANDLED_REQUESTS,
  DEFAULT_HOSTNAME,
  INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER,
} from './constants';
import NotRunningInterceptorServerError from './errors/NotRunningInterceptorServerError';
import RunningInterceptorServerError from './errors/RunningInterceptorServerError';
import { InterceptorServerOptions } from './types/options';
import { InterceptorServer as PublicInterceptorServer } from './types/public';
import { HttpHandlerCommit, InterceptorServerWebSocketSchema, WebSocketHandlerCommit } from './types/schema';
import { validateInterceptorToken } from './utils/auth';
import { getFetchAPI } from './utils/fetch';

interface HttpHandler {
  id: string;
  baseURL: string;
  pathRegex: RegExp;
  socket: Socket;
}

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

class InterceptorServer implements PublicInterceptorServer {
  private httpServer?: HttpServer;
  private webSocketServer?: WebSocketServer<InterceptorServerWebSocketSchema>;

  _hostname: string;
  _port: number | undefined;
  logUnhandledRequests: boolean;
  tokensDirectory?: string;

  private httpHandlersByMethod: {
    [Method in HttpMethod]: HttpHandler[];
  } = {
    GET: [],
    POST: [],
    PATCH: [],
    PUT: [],
    DELETE: [],
    HEAD: [],
    OPTIONS: [],
  };

  private knownWorkerSockets = new Set<Socket>();
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
    this.webSocketServerOrThrow.onChannel('event', 'interceptors/http/workers/commit', this.commitWorker);
    this.webSocketServerOrThrow.onChannel('event', 'interceptors/http/workers/reset', this.resetWorker);
    this.webSocketServerOrThrow.onChannel('event', 'interceptors/ws/workers/commit', this.commitWebSocketWorker);
    this.webSocketServerOrThrow.onChannel('event', 'interceptors/ws/workers/reset', this.resetWebSocketWorker);
    this.webSocketServerOrThrow.onChannel('event', 'interceptors/ws/messages/send', this.sendWebSocketMessage);

    this.webSocketServerOrThrow.start();
  }

  private commitWorker = (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/http/workers/commit'>,
    socket: Socket,
  ) => {
    const commit = message.data;

    this.registerHttpHandler(commit, socket);
    this.registerWorkerSocketIfUnknown(socket);

    return {};
  };

  private commitWebSocketWorker = (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/workers/commit'>,
    socket: Socket,
  ) => {
    const commit = message.data;
    this.validateWebSocketHandlerCommit(commit);

    this.registerWebSocketHandler(commit, socket);
    this.registerWorkerSocketIfUnknown(socket);

    return {};
  };

  private resetWebSocketWorker = (
    {
      data: handlersToRecommit,
    }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/workers/reset'>,
    socket: Socket,
  ) => {
    this.registerWorkerSocketIfUnknown(socket);
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

  private resetWorker = (
    {
      data: handlersToRecommit,
    }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/http/workers/reset'>,
    socket: Socket,
  ) => {
    this.registerWorkerSocketIfUnknown(socket);

    this.webSocketServerOrThrow.emitSocket('abortRequests', socket, {
      shouldAbortRequest: (request) => {
        const isResponseCreationRequest = this.webSocketServerOrThrow.isChannelEvent(
          request,
          'interceptors/http/responses/create',
        );

        /* istanbul ignore if -- @preserve
         * While resetting a worker, there could be other types of requests in progress. These are not guaranteed to
         * exist and are not related to handler resets, so we let them continue. */
        if (!isResponseCreationRequest) {
          return false;
        }

        const isHandlerStillCommitted = handlersToRecommit.some(
          /* istanbul ignore next -- @preserve
           * Ensuring this function is called in tests is difficult because it requires clearing or stopping a worker
           * at the exact moment a request is being handled, in a scenario when there are other handlers still
           * committed. */
          (handler) => request.data.handlerId === handler.id,
        );
        return !isHandlerStillCommitted;
      },
    });

    this.removeHttpHandlersBySocket(socket);

    for (const handler of handlersToRecommit) {
      this.registerHttpHandler(handler, socket);
    }

    return {};
  };

  private registerHttpHandler({ id, baseURL, method, path }: HttpHandlerCommit, socket: Socket) {
    const handlerGroups = this.httpHandlersByMethod[method];

    handlerGroups.push({
      id,
      baseURL,
      pathRegex: createRegexFromPath(path),
      socket,
    });
  }

  private registerWebSocketHandler({ id, baseURL }: WebSocketHandlerCommit, socket: Socket) {
    this.webSocketHandlers.push({ id, baseURL, socket });
  }

  private registerWorkerSocketIfUnknown(socket: Socket) {
    if (this.knownWorkerSockets.has(socket)) {
      return;
    }

    socket.addEventListener('close', () => {
      this.removeHttpHandlersBySocket(socket);
      this.removeWebSocketHandlersBySocket(socket, {
        pendingCloseCode: WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE,
        pendingCloseReason: WEB_SOCKET_CONNECTION_SETUP_FAILED_CLOSE_REASON,
      });
      this.knownWorkerSockets.delete(socket);
    });

    this.knownWorkerSockets.add(socket);
  }

  private removeHttpHandlersBySocket(socket: Socket) {
    for (const handlerGroups of Object.values(this.httpHandlersByMethod)) {
      const socketIndex = handlerGroups.findIndex((handlerGroup) => handlerGroup.socket === socket);
      removeArrayIndex(handlerGroups, socketIndex);
    }
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

  private handleWebSocketConnection: WebSocketServerConnectionHandler = async (socket, request) => {
    if (this.isWebSocketRpcRequest(request)) {
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

    let messageQueue = Promise.resolve();
    const messageListener = this.createUserWebSocketMessageListener(connection, (queuedMessage) => {
      messageQueue = queuedMessage;
    });

    socket.addEventListener('close', () => {
      this.activeUserWebSocketHandlers.delete(socket);
      socket.removeEventListener('message', messageListener);
      void messageQueue
        .then(() => this.notifyUserWebSocketClose(connection))
        .catch(
          /* istanbul ignore next -- @preserve
           * Close notifications are best-effort if the worker disconnects while user messages are being forwarded. */
          (error: unknown) => {
            console.error(error);
          },
        );
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
      this.knownWorkerSockets.has(connection.handler.socket) &&
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

  private createUserWebSocketMessageListener(
    connection: UserWebSocketHandler,
    updateMessageQueue: (queuedMessage: Promise<void>) => void,
  ) {
    let messageQueue = Promise.resolve();

    return (message: ClientSocket.MessageEvent) => {
      messageQueue = messageQueue
        .then(() => this.handleUserWebSocketMessage(connection, message))
        .catch(
          /* istanbul ignore next -- @preserve
           * Message queue errors require the worker RPC to fail after a user message has already been received. */
          (error: unknown) => {
            console.error(error);
          },
        );

      updateMessageQueue(messageQueue);
    };
  }

  private notifyUserWebSocketClose(connection: UserWebSocketHandler) {
    if (connection.handler.socket.readyState !== ClientSocket.OPEN) {
      return;
    }

    this.webSocketServerOrThrow.send(
      'interceptors/ws/clients/close',
      {
        clientId: connection.clientId,
      },
      { sockets: [connection.handler.socket] },
    );
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

    await this.stopWebSocketServer();
    await this.stopHttpServer();
  }

  private async stopHttpServer() {
    await stopHttpServer(this.httpServerOrThrow);
    this.httpServerOrThrow.removeAllListeners();
    this.httpServer = undefined;
  }

  private async stopWebSocketServer() {
    this.webSocketServerOrThrow.offChannel('event', 'interceptors/http/workers/commit', this.commitWorker);
    this.webSocketServerOrThrow.offChannel('event', 'interceptors/http/workers/reset', this.resetWorker);
    this.webSocketServerOrThrow.offChannel('event', 'interceptors/ws/workers/commit', this.commitWebSocketWorker);
    this.webSocketServerOrThrow.offChannel('event', 'interceptors/ws/workers/reset', this.resetWebSocketWorker);
    this.webSocketServerOrThrow.offChannel('event', 'interceptors/ws/messages/send', this.sendWebSocketMessage);

    await this.closeUserWebSocketConnections();

    await this.webSocketServerOrThrow.stop();

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

  private handleHttpRequest = async (nodeRequest: IncomingMessage, nodeResponse: ServerResponse) => {
    const request = normalizeNodeRequest(nodeRequest, getFetchAPI());
    const serializedRequest = await serializeRequest(request);

    try {
      const { response, matchedSomeInterceptor } = await this.createResponseForRequest(serializedRequest);

      if (response) {
        if (HttpInterceptorWorker.isRejectedResponse(response)) {
          nodeResponse.destroy();
        } else {
          this.setDefaultAccessControlHeaders(response, [
            'access-control-allow-origin',
            'access-control-expose-headers',
          ]);

          await sendNodeResponse(response, nodeResponse, nodeRequest, true);
        }

        return;
      }

      const isUnhandledPreflightResponse = request.method === 'OPTIONS';

      if (isUnhandledPreflightResponse) {
        const defaultPreflightResponse = new Response(null, { status: DEFAULT_PREFLIGHT_STATUS_CODE });
        this.setDefaultAccessControlHeaders(defaultPreflightResponse);
        await sendNodeResponse(defaultPreflightResponse, nodeResponse, nodeRequest, true);
      }

      const shouldWarnUnhandledRequest = !isUnhandledPreflightResponse && !matchedSomeInterceptor;

      if (shouldWarnUnhandledRequest) {
        await this.logUnhandledRequestIfNecessary(request, serializedRequest);
      }

      nodeResponse.destroy();
    } catch (error) {
      const isMessageAbortError = error instanceof WebSocketMessageAbortError;

      if (!isMessageAbortError) {
        console.error(error);
        await this.logUnhandledRequestIfNecessary(request, serializedRequest);
      }

      nodeResponse.destroy();
    }
  };

  private async createResponseForRequest(request: SerializedHttpRequest) {
    const methodHandlers = this.httpHandlersByMethod[request.method as HttpMethod];

    const requestURL = excludeNonPathParams(new URL(request.url));
    const requestURLAsString = requestURL.href === `${requestURL.origin}/` ? requestURL.origin : requestURL.href;

    let matchedSomeInterceptor = false;

    for (let handlerIndex = methodHandlers.length - 1; handlerIndex >= 0; handlerIndex--) {
      const handler = methodHandlers[handlerIndex];
      const matchesBaseURL = requestURLAsString.startsWith(handler.baseURL);

      if (!matchesBaseURL) {
        continue;
      }

      const requestPath = requestURLAsString.replace(handler.baseURL, '');
      const matchesPath = handler.pathRegex.test(requestPath);

      if (!matchesPath) {
        continue;
      }

      matchedSomeInterceptor = true;

      const { response: serializedResponse } = await this.webSocketServerOrThrow.request(
        'interceptors/http/responses/create',
        { handlerId: handler.id, request },
        { sockets: [handler.socket] },
      );

      if (serializedResponse) {
        const response = deserializeResponse(serializedResponse);
        return { response, matchedSomeInterceptor };
      }
    }

    return { response: null, matchedSomeInterceptor };
  }

  private setDefaultAccessControlHeaders(
    response: Response,
    headersToSet = Object.keys(DEFAULT_ACCESS_CONTROL_HEADERS),
  ) {
    for (const key of headersToSet) {
      if (response.headers.has(key)) {
        continue;
      }

      const value = DEFAULT_ACCESS_CONTROL_HEADERS[key];
      /* istanbul ignore else -- @preserve
       * This is always true during tests because we force max-age=0 to disable CORS caching. */
      if (value) {
        response.headers.set(key, value);
      }
    }
  }

  private async logUnhandledRequestIfNecessary(request: HttpRequest, serializedRequest: SerializedHttpRequest) {
    const handler = this.findHttpHandlerByRequestBaseURL(request);

    if (handler) {
      try {
        const { wasLogged: wasRequestLoggedByRemoteInterceptor } = await this.webSocketServerOrThrow.request(
          'interceptors/http/responses/unhandled',
          { request: serializedRequest },
          { sockets: [handler.socket] },
        );

        if (wasRequestLoggedByRemoteInterceptor) {
          return;
        }
      } catch (error) {
        /* istanbul ignore next -- @preserve
         *
         * If the socket is closed before receiving a response, the message is aborted with an error. This can happen if
         * we send a request message and the interceptor worker closes the socket before sending a response. In this
         * case, we can safely ignore the error because we know that the worker is shutting down and won't handle
         * any more requests.
         *
         * Due to the rare nature of this edge case, we can't reliably reproduce it in tests. */
        const isMessageAbortError = error instanceof WebSocketMessageAbortError;

        /* istanbul ignore next -- @preserve */
        if (!isMessageAbortError) {
          throw error;
        }
      }
    }

    if (!this.logUnhandledRequests) {
      return;
    }

    await HttpInterceptorWorker.logUnhandledRequestWarning(request, 'reject');
  }

  private findHttpHandlerByRequestBaseURL(request: HttpRequest) {
    const methodHandlers = this.httpHandlersByMethod[request.method as HttpMethod];

    const handler = methodHandlers.findLast((handler) => request.url.startsWith(handler.baseURL));
    return handler;
  }
}

export default InterceptorServer;
