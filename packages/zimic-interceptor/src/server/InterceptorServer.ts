import { normalizeNodeRequest } from '@whatwg-node/server';
import { createCachedDynamicImport } from '@zimic/utils/import';
import { startHttpServer, stopHttpServer, getHttpServerPort } from '@zimic/utils/server';
import { IncomingMessage, Server as HttpServer, createServer, ServerResponse } from 'http';
import type { WebSocket as Socket } from 'isomorphic-ws';
import color from 'picocolors';

import type { InterceptorServerRPCProtocol } from '@/interceptor/constants';
import { isLoopbackHostname } from '@/utils/http';
import { logger, logUnhandledRequestWarning } from '@/utils/logging';
import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
import WebSocketServer, {
  type WebSocketServerAuthenticate,
  type WebSocketServerConnectionHandler,
} from '@/utils/webSocket/WebSocketServer';

import {
  DEFAULT_ACCESS_CONTROL_HEADERS,
  DEFAULT_LOG_UNHANDLED_REQUESTS,
  DEFAULT_HOSTNAME,
  DEFAULT_PREFLIGHT_STATUS_CODE,
  INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER,
} from './constants';
import NotRunningInterceptorServerError from './errors/NotRunningInterceptorServerError';
import RunningInterceptorServerError from './errors/RunningInterceptorServerError';
import StaleHttpRuntimeLoadError from './errors/StaleHttpRuntimeLoadError';
import type HttpInterceptorServerRuntime from './http/HttpInterceptorServerRuntime';
import type { InterceptorServerOptions } from './types/options';
import type { InterceptorServer as PublicInterceptorServer } from './types/public';
import type { InterceptorServerWebSocketSchema } from './types/schema';
import { validateInterceptorToken } from './utils/auth';
import { getFetchAPI } from './utils/fetch';
import WebSocketInterceptorServerRuntime from './ws/WebSocketInterceptorServerRuntime';

const importHttpInterceptorServerRuntime = createCachedDynamicImport(
  () => import('./http/HttpInterceptorServerRuntime'),
);

const WEB_SOCKET_CLOSE_REASONS = Object.freeze({
  INVALID_WORKER_PROTOCOL: 'Invalid interceptor worker protocol.',
  MISSING_HTTP_PEER: 'The optional peer dependency "@zimic/http" is required for HTTP interceptor workers.',
  HTTP_RUNTIME_LOAD_FAILED: 'Could not load the HTTP interceptor runtime.',
} as const);

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
  private webSocketRuntime?: WebSocketInterceptorServerRuntime;

  _hostname: string;
  _port: number | undefined;
  logUnhandledRequests: boolean;
  tokensDirectory?: string;

  private workerProtocols = new Map<Socket, InterceptorServerRPCProtocol>();

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

  private get webSocketRuntimeOrThrow(): WebSocketInterceptorServerRuntime {
    /* istanbul ignore if -- @preserve
     * The WebSocket runtime is initialized before handling application connections. */
    if (!this.webSocketRuntime) {
      throw new NotRunningInterceptorServerError();
    }
    return this.webSocketRuntime;
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

    const isDangerouslyUnprotected =
      !this.tokensDirectory && (process.env.NODE_ENV === 'production' || !isLoopbackHostname(this.hostname));

    if (isDangerouslyUnprotected) {
      logger.warn(
        [
          `Attention: this interceptor server is ${color.bold(
            color.red('unprotected'),
          )}. Do not expose it publicly without authentication.`,
          '',
          'For your safety, this server will reject remote browser interceptors until authentication is configured.',
          '',
          'In @zimic/interceptor v2, interceptor servers running on non-loopback hostnames will require ' +
            'authentication and refuse to start without a tokens directory.',
          '',
          'Learn more: https://zimic.dev/docs/interceptor/guides/http/remote-interceptors#interceptor-server-authentication',
        ].join('\n'),
      );
    }
  }

  private authenticateWebSocketConnection: WebSocketServerAuthenticate = async (_socket, request) => {
    if (!this.isWebSocketRPCRequest(request)) {
      return { isValid: true };
    }

    if (!this.tokensDirectory) {
      // Requests without an origin header are allowed when the interceptor server is not configured to require token
      // authentication. They are typically made by non-browser clients.
      if (request.headers.origin === undefined) {
        return { isValid: true };
      }

      try {
        const originURL = new URL(request.headers.origin);
        const originHostname = originURL.hostname === '[::1]' ? '::1' : originURL.hostname;

        const originMatchesServerLoopback =
          originURL.origin === request.headers.origin &&
          isLoopbackHostname(this.hostname) &&
          isLoopbackHostname(originHostname);

        if (originMatchesServerLoopback) {
          return { isValid: true };
        }
      } catch (error) {
        console.error(error);
      }

      return {
        isValid: false,
        message:
          'Unauthenticated browser connections are only allowed from loopback origins. ' +
          'Configure token authentication.',
      };
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

  private isWebSocketRPCRequest(request: IncomingMessage) {
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
    this.webSocketRuntime = new WebSocketInterceptorServerRuntime({
      webSocketServer: this.webSocketServerOrThrow,
      isWebSocketWorkerSocket: (socket) => this.workerProtocols.get(socket) === 'ws',
    });
    this.webSocketServerOrThrow.start();
  }

  private registerWorkerSocket(socket: Socket, protocol: InterceptorServerRPCProtocol) {
    this.workerProtocols.set(socket, protocol);

    socket.addEventListener('close', () => {
      if (protocol === 'http') {
        this.httpRuntime?.removeHandlersBySocket(socket);
      } else {
        this.webSocketRuntime?.removeHandlersBySocket(socket);
      }

      this.workerProtocols.delete(socket);
    });
  }

  private async loadHttpRuntime() {
    if (this.httpRuntime) {
      return this.httpRuntime;
    }

    const loadingPromise: Promise<HttpInterceptorServerRuntime> =
      this.httpRuntimeLoadingPromise ??
      importHttpInterceptorServerRuntime().then(({ default: Runtime }) => {
        if (this.httpRuntimeLoadingPromise !== loadingPromise || !this.webSocketServer?.isRunning) {
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
    if (this.isWebSocketRPCRequest(request)) {
      const protocol = this.getWebSocketRPCProtocol(request);

      if (!protocol) {
        socket.resume();
        socket.close(WEB_SOCKET_CLOSE_CODES.POLICY_VIOLATION, WEB_SOCKET_CLOSE_REASONS.INVALID_WORKER_PROTOCOL);
        return { handled: true };
      }

      if (protocol === 'http') {
        try {
          await this.loadHttpRuntime();
        } catch (error) {
          console.error(error);

          socket.resume();
          socket.close(
            WEB_SOCKET_CLOSE_CODES.POLICY_VIOLATION,
            isMissingHttpPeerError(error)
              ? WEB_SOCKET_CLOSE_REASONS.MISSING_HTTP_PEER
              : WEB_SOCKET_CLOSE_REASONS.HTTP_RUNTIME_LOAD_FAILED,
          );

          return { handled: true };
        }
      }

      this.registerWorkerSocket(socket, protocol);

      return { handled: false };
    }

    return this.webSocketRuntimeOrThrow.handleConnection(socket, request);
  };

  async stop() {
    if (!this.isRunning) {
      return;
    }

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
    await this.webSocketRuntime?.stop();
    this.webSocketRuntime = undefined;

    await this.webSocketServerOrThrow.stop();

    this.workerProtocols.clear();
    this.webSocketServer = undefined;
  }

  private handleHttpRequest = (nodeRequest: IncomingMessage, nodeResponse: ServerResponse) => {
    if (!this.httpRuntime) {
      if (nodeRequest.method === 'OPTIONS') {
        nodeResponse.statusCode = DEFAULT_PREFLIGHT_STATUS_CODE;

        for (const [header, value] of Object.entries(DEFAULT_ACCESS_CONTROL_HEADERS)) {
          if (value) {
            nodeResponse.setHeader(header, value);
          }
        }

        nodeResponse.end();
        return;
      }

      if (this.logUnhandledRequests) {
        return this.logUnhandledRequestWithoutRuntime(nodeRequest, nodeResponse);
      }

      nodeResponse.destroy();
      return;
    }

    return this.httpRuntime.handleRequest(nodeRequest, nodeResponse);
  };

  private async logUnhandledRequestWithoutRuntime(nodeRequest: IncomingMessage, nodeResponse: ServerResponse) {
    try {
      const request = normalizeNodeRequest(nodeRequest, getFetchAPI());
      await logUnhandledRequestWarning(request, 'reject');
    } catch (error) {
      console.error(error);
    } finally {
      nodeResponse.destroy();
    }
  }
}

export default InterceptorServer;
