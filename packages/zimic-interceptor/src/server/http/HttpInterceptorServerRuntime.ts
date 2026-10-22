import { normalizeNodeRequest, sendNodeResponse } from '@whatwg-node/server';
import { HTTP_METHODS, type HttpMethod, type HttpRequest } from '@zimic/http';
import { createRegexFromPath, excludeNonPathParams } from '@zimic/utils/url';
import type { IncomingMessage, ServerResponse } from 'http';
import type { WebSocket as Socket } from 'isomorphic-ws';
import * as z from 'zod';

import HttpInterceptorWorker from '@/http/interceptorWorker/HttpInterceptorWorker';
import { deserializeResponse, type SerializedHttpRequest, serializeRequest } from '@/utils/fetch';
import { logUnhandledRequestWarning } from '@/utils/logging';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import type { WebSocketEventMessage } from '@/utils/webSocket/types';
import type WebSocketServer from '@/utils/webSocket/WebSocketServer';

import { DEFAULT_ACCESS_CONTROL_HEADERS, DEFAULT_PREFLIGHT_STATUS_CODE, type AccessControlHeaders } from '../constants';
import type { HttpHandlerCommit, InterceptorServerWebSocketSchema } from '../types/schema';
import { getFetchAPI } from '../utils/fetch';
import { rejectNodeResponse } from '../utils/http';
import { parseInterceptorServerRPCData } from '../utils/rpc';

const httpHandlerCommitSchema = z.object({
  id: z.string(),
  baseURL: z.url({ protocol: /^https?$/ }),
  method: z.enum(HTTP_METHODS),
  path: z.string(),
}) satisfies z.ZodType<HttpHandlerCommit>;

const httpHandlerCommitsSchema = z.array(httpHandlerCommitSchema);

const responseCreationReplySchema = z.object({
  response: z
    .object({
      type: z.enum(['basic', 'cors', 'default', 'error', 'opaque', 'opaqueredirect']),
      action: z.enum(['bypass', 'reject']).optional(),
      status: z.union([z.literal(0), z.number().int().min(200).max(599)]),
      statusText: z.string(),
      headers: z.record(z.string(), z.string()),
      body: z.base64().nullable(),
    })
    .nullable(),
  // Workers that do not send this field are still accepted and fall through on a null response.
  error: z.boolean().optional(),
});

const unhandledRequestReplySchema = z.object({ wasLogged: z.boolean() });

interface HttpHandler {
  id: string;
  baseURL: string;
  method: HttpMethod;
  pathRegex: RegExp;
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

  // Workers are kept in the order of their first committed handler, which decides the worker that serves a request.
  // Each worker keeps that position until its socket disconnects, even if all of its handlers are cleared.
  private httpHandlersByWorkerSocket = new Map<Socket, HttpHandler[]>();

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
    this.registerHttpHandler(parseInterceptorServerRPCData(httpHandlerCommitSchema, message.data), socket);
    return {};
  };

  private resetWorker = (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/http/workers/reset'>,
    socket: Socket,
  ) => {
    this.assertHttpWorkerSocket(socket);

    const handlersToRecommit = parseInterceptorServerRPCData(httpHandlerCommitsSchema, message.data);

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

    const hasWorkerPosition = this.httpHandlersByWorkerSocket.has(socket);

    // A worker takes its position with its first handler. Setting the handlers of a socket already in the map keeps its
    // position.
    if (hasWorkerPosition || handlersToRecommit.length > 0) {
      this.httpHandlersByWorkerSocket.set(
        socket,
        handlersToRecommit.map((handler) => this.createHttpHandler(handler)),
      );
    }

    return {};
  };

  private registerHttpHandler(commit: HttpHandlerCommit, socket: Socket) {
    const handlers = this.httpHandlersByWorkerSocket.get(socket) ?? [];
    handlers.push(this.createHttpHandler(commit));
    this.httpHandlersByWorkerSocket.set(socket, handlers);
  }

  private createHttpHandler({ id, baseURL, method, path }: HttpHandlerCommit): HttpHandler {
    return { id, baseURL, method, pathRegex: createRegexFromPath(path) };
  }

  removeHandlersBySocket(socket: Socket) {
    this.httpHandlersByWorkerSocket.delete(socket);
  }

  handleRequest = async (nodeRequest: IncomingMessage, nodeResponse: ServerResponse) => {
    const request = normalizeNodeRequest(nodeRequest, getFetchAPI());
    const serializedRequest = await serializeRequest(request);

    try {
      const { response, matchedSomeInterceptor } = await this.createResponseForRequest(serializedRequest);

      if (response) {
        if (HttpInterceptorWorker.isRejectedResponse(response)) {
          rejectNodeResponse(nodeResponse);
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
      const shouldWarnUnhandledRequest = !isUnhandledPreflightResponse || matchedSomeInterceptor;

      if (shouldWarnUnhandledRequest) {
        await this.logUnhandledRequestIfNecessary(request, serializedRequest);
      }

      if (isUnhandledPreflightResponse) {
        const defaultPreflightResponse = new Response(null, { status: DEFAULT_PREFLIGHT_STATUS_CODE });
        this.setDefaultAccessControlHeaders(defaultPreflightResponse);
        await sendNodeResponse(defaultPreflightResponse, nodeResponse, nodeRequest, true);
      }

      rejectNodeResponse(nodeResponse);
    } catch (error) {
      const isMessageAbortError = error instanceof WebSocketMessageAbortError;

      if (!isMessageAbortError) {
        console.error(error);
        await this.logUnhandledRequestIfNecessary(request, serializedRequest);
      }

      rejectNodeResponse(nodeResponse);
    }
  };

  private async createResponseForRequest(request: SerializedHttpRequest) {
    // Only one worker is tried, the same one that decides the unhandled request strategy. Other workers belong to other
    // processes, base URLs, or authentication tokens, so they do not serve each other's requests.
    const worker = this.findWorkerByRequestBaseURL(request);

    if (!worker) {
      return { response: null, matchedSomeInterceptor: false };
    }

    const requestURL = excludeNonPathParams(new URL(request.url));
    const requestURLAsString = requestURL.href === `${requestURL.origin}/` ? requestURL.origin : requestURL.href;

    let matchedSomeInterceptor = false;

    for (let handlerIndex = worker.handlers.length - 1; handlerIndex >= 0; handlerIndex--) {
      const handler = worker.handlers[handlerIndex];

      if (handler.method !== request.method) {
        continue;
      }

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

      const reply = await this.webSocketServer.request(
        'interceptors/http/responses/create',
        { handlerId: handler.id, request },
        { sockets: [worker.socket] },
      );
      const { response: serializedResponse, error: failedToCreateResponse } = parseInterceptorServerRPCData(
        responseCreationReplySchema,
        reply,
      );

      if (serializedResponse) {
        const response = deserializeResponse(serializedResponse);
        return { response, matchedSomeInterceptor };
      }

      // A handler that threw may have already counted the request, such as toward its `times` limit, so older
      // interceptors are not tried.
      if (failedToCreateResponse) {
        break;
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
    const worker = this.findWorkerByRequestBaseURL(serializedRequest);

    if (worker) {
      try {
        const reply = await this.webSocketServer.request(
          'interceptors/http/responses/unhandled',
          { request: serializedRequest },
          { sockets: [worker.socket] },
        );
        const { wasLogged: wasRequestLoggedByRemoteInterceptor } = parseInterceptorServerRPCData(
          unhandledRequestReplySchema,
          reply,
        );

        if (wasRequestLoggedByRemoteInterceptor) {
          return;
        }
      } catch (error) {
        if (error instanceof InvalidWebSocketMessageError) {
          // The reply cannot be trusted, so the request is logged by the server below as if it was not logged.
          console.error(error);
        } else {
          /* istanbul ignore next -- @preserve
           *
           * If the socket is closed before receiving a response, the message is aborted with an error. This can happen
           * if we send a request message and the interceptor worker closes the socket before sending a response. In
           * this case, we can safely ignore the error because we know that the worker is shutting down and won't
           * handle any more requests.
           *
           * Due to the rare nature of this edge case, we can't reliably reproduce it in tests. */
          const isMessageAbortError = error instanceof WebSocketMessageAbortError;

          /* istanbul ignore next -- @preserve */
          if (!isMessageAbortError) {
            throw error;
          }
        }
      }
    }

    if (!this.shouldLogUnhandledRequests()) {
      return;
    }

    await logUnhandledRequestWarning(request, 'reject');
  }

  private findWorkerByRequestBaseURL(request: SerializedHttpRequest) {
    const workers = Array.from(this.httpHandlersByWorkerSocket, ([socket, handlers]) => ({ socket, handlers }));

    const worker = workers.findLast(({ handlers }) =>
      handlers.some((handler) => handler.method === request.method && request.url.startsWith(handler.baseURL)),
    );
    return worker;
  }

  stop() {
    this.webSocketServer.offChannel('event', 'interceptors/http/workers/commit', this.commitWorker);
    this.webSocketServer.offChannel('event', 'interceptors/http/workers/reset', this.resetWorker);

    this.httpHandlersByWorkerSocket.clear();
  }
}

export default HttpInterceptorServerRuntime;
