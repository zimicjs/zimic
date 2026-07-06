import { normalizeNodeRequest, sendNodeResponse } from '@whatwg-node/server';
import type { HttpMethod, HttpRequest } from '@zimic/http';
import { createRegexFromPath, excludeNonPathParams } from '@zimic/utils/url';
import type { IncomingMessage, ServerResponse } from 'http';
import type { WebSocket as Socket } from 'isomorphic-ws';

import HttpInterceptorWorker from '@/http/interceptorWorker/HttpInterceptorWorker';
import { removeArrayIndex } from '@/utils/arrays';
import { deserializeResponse, type SerializedHttpRequest, serializeRequest } from '@/utils/fetch';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import type { WebSocketEventMessage } from '@/utils/webSocket/types';
import type WebSocketServer from '@/utils/webSocket/WebSocketServer';

import { DEFAULT_ACCESS_CONTROL_HEADERS, DEFAULT_PREFLIGHT_STATUS_CODE, type AccessControlHeaders } from '../constants';
import type { HttpHandlerCommit, InterceptorServerWebSocketSchema } from '../types/schema';
import { getFetchAPI } from '../utils/fetch';

interface HttpHandler {
  id: string;
  baseURL: string;
  pathRegex: RegExp;
  socket: Socket;
}

interface HttpInterceptorServerRuntimeOptions {
  webSocketServer: WebSocketServer<InterceptorServerWebSocketSchema>;
  isHttpWorkerSocket: (socket: Socket) => boolean;
  shouldLogUnhandledRequests: () => boolean;
}

class HttpInterceptorServerRuntime {
  private webSocketServer: HttpInterceptorServerRuntimeOptions['webSocketServer'];
  private isHttpWorkerSocket: HttpInterceptorServerRuntimeOptions['isHttpWorkerSocket'];
  private shouldLogUnhandledRequests: HttpInterceptorServerRuntimeOptions['shouldLogUnhandledRequests'];

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

  constructor(options: HttpInterceptorServerRuntimeOptions) {
    this.webSocketServer = options.webSocketServer;
    this.isHttpWorkerSocket = options.isHttpWorkerSocket;
    this.shouldLogUnhandledRequests = options.shouldLogUnhandledRequests;

    this.webSocketServer.onChannel('event', 'interceptors/http/workers/commit', this.commitWorker);
    this.webSocketServer.onChannel('event', 'interceptors/http/workers/reset', this.resetWorker);
  }

  private assertHttpWorkerSocket(socket: Socket) {
    if (!this.isHttpWorkerSocket(socket)) {
      throw new InvalidWebSocketMessageError('HTTP RPC received from a non-HTTP worker.');
    }
  }

  private commitWorker = (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/http/workers/commit'>,
    socket: Socket,
  ) => {
    this.assertHttpWorkerSocket(socket);
    this.registerHttpHandler(message.data, socket);
    return {};
  };

  private resetWorker = (
    {
      data: handlersToRecommit,
    }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/http/workers/reset'>,
    socket: Socket,
  ) => {
    this.assertHttpWorkerSocket(socket);

    this.webSocketServer.emitSocket('abortRequests', socket, {
      shouldAbortRequest: (request) => {
        const isResponseCreationRequest = this.webSocketServer.isChannelEvent(
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

    this.removeHandlersBySocket(socket);

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

  removeHandlersBySocket(socket: Socket) {
    for (const handlerGroups of Object.values(this.httpHandlersByMethod)) {
      const socketIndex = handlerGroups.findIndex((handlerGroup) => handlerGroup.socket === socket);
      removeArrayIndex(handlerGroups, socketIndex);
    }
  }

  handleRequest = async (nodeRequest: IncomingMessage, nodeResponse: ServerResponse) => {
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

      const { response: serializedResponse } = await this.webSocketServer.request(
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
    headersToSet: (keyof AccessControlHeaders)[] = Object.keys(DEFAULT_ACCESS_CONTROL_HEADERS),
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
        const { wasLogged: wasRequestLoggedByRemoteInterceptor } = await this.webSocketServer.request(
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

    if (!this.shouldLogUnhandledRequests()) {
      return;
    }

    await HttpInterceptorWorker.logUnhandledRequestWarning(request, 'reject');
  }

  private findHttpHandlerByRequestBaseURL(request: HttpRequest) {
    const methodHandlers = this.httpHandlersByMethod[request.method as HttpMethod];

    const handler = methodHandlers.findLast((handler) => request.url.startsWith(handler.baseURL));
    return handler;
  }

  stop() {
    this.webSocketServer.offChannel('event', 'interceptors/http/workers/commit', this.commitWorker);
    this.webSocketServer.offChannel('event', 'interceptors/http/workers/reset', this.resetWorker);

    for (const handlers of Object.values(this.httpHandlersByMethod)) {
      handlers.length = 0;
    }
  }
}

export default HttpInterceptorServerRuntime;
