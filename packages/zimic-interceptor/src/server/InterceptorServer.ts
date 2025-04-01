import { normalizeNodeRequest, sendNodeResponse } from '@whatwg-node/server';
import { HttpRequest, HttpMethod } from '@zimic/http';
import createRegExpFromURL from '@zimic/utils/url/createRegExpFromURL';
import excludeURLParams from '@zimic/utils/url/excludeURLParams';
import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import type { WebSocket as Socket } from 'isomorphic-ws';

import HttpInterceptorWorker from '@/http/interceptorWorker/HttpInterceptorWorker';
import { removeArrayIndex } from '@/utils/arrays';
import { deserializeResponse, SerializedHttpRequest, serializeRequest } from '@/utils/fetch';
import { getHttpServerPort, startHttpServer, stopHttpServer } from '@/utils/http';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import { WebSocketEventMessage } from '@/webSocket/types';
import WebSocketServer from '@/webSocket/WebSocketServer';

import {
  DEFAULT_ACCESS_CONTROL_HEADERS,
  DEFAULT_PREFLIGHT_STATUS_CODE,
  DEFAULT_LOG_UNHANDLED_REQUESTS,
  DEFAULT_HOSTNAME,
} from './constants';
import NotRunningInterceptorServerError from './errors/NotRunningInterceptorServerError';
import RunningInterceptorServerError from './errors/RunningInterceptorServerError';
import { InterceptorServerOptions } from './types/options';
import { InterceptorServer as PublicInterceptorServer } from './types/public';
import { HttpHandlerCommit, InterceptorServerWebSocketSchema } from './types/schema';
import { validateInterceptorToken } from './utils/auth';
import { getFetchAPI } from './utils/fetch';

interface HttpHandler {
  id: string;
  url: {
    base: string;
    fullRegex: RegExp;
  };
  socket: Socket;
}

class InterceptorServer implements PublicInterceptorServer {
  private httpServer?: HttpServer;
  private webSocketServer?: WebSocketServer<InterceptorServerWebSocketSchema>;

  _hostname: string;
  _port: number | undefined;
  logUnhandledRequests: boolean;
  tokensDirectory?: string;

  private httpHandlerGroups: {
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

      authenticate: async (_socket, request) => {
        if (!this.tokensDirectory) {
          return { isValid: true };
        }

        const tokenValue = request.headers.authorization?.replace(/^Bearer (.+)$/, '$1');

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
      },
    });

    this.startWebSocketServer();
  }

  private async startHttpServer() {
    await startHttpServer(this.httpServerOrThrow, {
      hostname: this.hostname,
      port: this.port,
    });
    this.port = getHttpServerPort(this.httpServerOrThrow);

    this.httpServerOrThrow.on('request', this.handleHttpRequest);
  }

  private startWebSocketServer() {
    this.webSocketServerOrThrow.start();

    this.webSocketServerOrThrow.onEvent('interceptors/workers/commit', this.commitWorker);
    this.webSocketServerOrThrow.onEvent('interceptors/workers/reset', this.resetWorker);
  }

  private commitWorker = (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/workers/commit'>,
    socket: Socket,
  ) => {
    const commit = message.data;

    this.registerHttpHandler(commit, socket);
    this.registerWorkerSocketIfUnknown(socket);

    return {};
  };

  private resetWorker = (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/workers/reset'>,
    socket: Socket,
  ) => {
    this.removeHttpHandlersBySocket(socket);

    const handlersToResetTo = message.data;
    const isWorkerNoLongerCommitted = handlersToResetTo === undefined;

    if (isWorkerNoLongerCommitted) {
      // When a worker is no longer committed, we should abort all requests that were using it.
      // This ensures that we only wait for responses from committed worker sockets.
      this.webSocketServerOrThrow.abortSocketMessages([socket]);
    } else {
      for (const handler of handlersToResetTo) {
        this.registerHttpHandler(handler, socket);
      }
    }

    this.registerWorkerSocketIfUnknown(socket);

    return {};
  };

  private registerHttpHandler({ id, url, method }: HttpHandlerCommit, socket: Socket) {
    const handlerGroups = this.httpHandlerGroups[method];

    const fullURL = new URL(url.full);
    excludeURLParams(fullURL);

    handlerGroups.push({
      id,
      url: {
        base: url.base,
        fullRegex: createRegExpFromURL(fullURL.toString()),
      },
      socket,
    });
  }

  private registerWorkerSocketIfUnknown(socket: Socket) {
    if (this.knownWorkerSockets.has(socket)) {
      return;
    }

    socket.addEventListener('close', () => {
      this.removeHttpHandlersBySocket(socket);
      this.knownWorkerSockets.delete(socket);
    });

    this.knownWorkerSockets.add(socket);
  }

  private removeHttpHandlersBySocket(socket: Socket) {
    for (const handlerGroups of Object.values(this.httpHandlerGroups)) {
      const socketIndex = handlerGroups.findIndex((handlerGroup) => handlerGroup.socket === socket);
      removeArrayIndex(handlerGroups, socketIndex);
    }
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
    this.webSocketServerOrThrow.offEvent('interceptors/workers/commit', this.commitWorker);
    this.webSocketServerOrThrow.offEvent('interceptors/workers/reset', this.resetWorker);

    await this.webSocketServerOrThrow.stop();

    this.webSocketServer = undefined;
  }

  private handleHttpRequest = async (nodeRequest: IncomingMessage, nodeResponse: ServerResponse) => {
    const request = normalizeNodeRequest(nodeRequest, await getFetchAPI());
    const serializedRequest = await serializeRequest(request);

    try {
      const { response, matchedSomeInterceptor } = await this.createResponseForRequest(serializedRequest);

      if (response) {
        this.setDefaultAccessControlHeaders(response, ['access-control-allow-origin', 'access-control-expose-headers']);
        await sendNodeResponse(response, nodeResponse, nodeRequest);
        return;
      }

      const isUnhandledPreflightResponse = request.method === 'OPTIONS';

      if (isUnhandledPreflightResponse) {
        const defaultPreflightResponse = new Response(null, { status: DEFAULT_PREFLIGHT_STATUS_CODE });
        this.setDefaultAccessControlHeaders(defaultPreflightResponse);
        await sendNodeResponse(defaultPreflightResponse, nodeResponse, nodeRequest);
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
    const methodHandlers = this.httpHandlerGroups[request.method as HttpMethod];

    const requestURL = excludeURLParams(new URL(request.url)).toString();

    let matchedSomeInterceptor = false;

    for (let index = methodHandlers.length - 1; index >= 0; index--) {
      const handler = methodHandlers[index];

      const matchesHandlerURL = handler.url.fullRegex.test(requestURL);
      if (!matchesHandlerURL) {
        continue;
      }

      matchedSomeInterceptor = true;

      const { response: serializedResponse } = await this.webSocketServerOrThrow.request(
        'interceptors/responses/create',
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
          'interceptors/responses/unhandled',
          { request: serializedRequest },
          { sockets: [handler.socket] },
        );

        if (wasRequestLoggedByRemoteInterceptor) {
          return;
        }
      } catch (error) {
        /* istanbul ignore next -- @preserve
         * This try..catch is for the case when the remote interceptor web socket client is closed before responding.
         * Since simulating this scenario is difficult, we are ignoring this branch fow now. */
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
    const methodHandlers = this.httpHandlerGroups[request.method as HttpMethod];

    const handler = methodHandlers.findLast((handler) => {
      return request.url.startsWith(handler.url.base);
    });

    return handler;
  }
}

export default InterceptorServer;
