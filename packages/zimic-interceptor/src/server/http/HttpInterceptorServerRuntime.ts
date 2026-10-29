import { normalizeNodeRequest, sendNodeResponse } from '@whatwg-node/server';
import type { HttpRequest } from '@zimic/http';
import type { IncomingMessage, ServerResponse } from 'http';
import type { WebSocket as Socket } from 'isomorphic-ws';
import * as z from 'zod';

import HttpInterceptorWorker from '@/http/interceptorWorker/HttpInterceptorWorker';
import { deserializeResponse, type SerializedHttpRequest, serializeRequest } from '@/utils/fetch';
import { logUnhandledRequestWarning } from '@/utils/logging';
import { isURLUnderBaseURL } from '@/utils/urls';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import type { WebSocketEventMessage } from '@/utils/webSocket/types';
import type WebSocketServer from '@/utils/webSocket/WebSocketServer';

import { DEFAULT_ACCESS_CONTROL_HEADERS, DEFAULT_PREFLIGHT_STATUS_CODE, type AccessControlHeaders } from '../constants';
import type { HttpWorkerReset, InterceptorServerWebSocketSchema } from '../types/schema';
import { getFetchAPI } from '../utils/fetch';
import { rejectNodeResponse } from '../utils/http';
import { parseInterceptorServerRPCData } from '../utils/rpc';

const httpBaseURLSchema = z.url({ protocol: /^https?$/ });

const httpWorkerResetSchema = z.object({
  interceptorBaseURLs: z.array(httpBaseURLSchema),
}) satisfies z.ZodType<HttpWorkerReset>;

const requestHandlingReplySchema = z.object({
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
  matchedSomeHandler: z.boolean(),
  wasUnhandledRequestLogged: z.boolean(),
});

interface HttpWorker {
  socket: Socket;
  interceptorBaseURLs: string[];
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

  // Workers are kept in the order of their first registration, which decides the worker that serves a request. Each
  // worker keeps that position until its socket disconnects, even if all of its interceptors stop.
  private httpWorkersBySocket = new Map<Socket, HttpWorker>();

  constructor(options: HttpInterceptorServerRuntimeOptions) {
    this.webSocketServer = options.webSocketServer;
    this.isHttpWorkerSocket = options.isHttpWorkerSocket;
    this.shouldLogUnhandledRequests = options.shouldLogUnhandledRequests;

    this.webSocketServer.onChannel('event', 'interceptors/http/workers/reset', this.resetWorker);
  }

  private assertHttpWorkerSocket(socket: Socket) {
    if (!this.isHttpWorkerSocket(socket)) {
      throw new InvalidWebSocketMessageError('HTTP RPC received from a non-HTTP worker.');
    }
  }

  private resetWorker = (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/http/workers/reset'>,
    socket: Socket,
  ) => {
    this.assertHttpWorkerSocket(socket);

    const reset = parseInterceptorServerRPCData(httpWorkerResetSchema, message.data);

    // Setting a socket already in the map keeps its position.
    this.httpWorkersBySocket.set(socket, {
      socket,
      interceptorBaseURLs: reset.interceptorBaseURLs,
    });

    return {};
  };

  removeWorkerBySocket(socket: Socket) {
    this.httpWorkersBySocket.delete(socket);
  }

  handleRequest = async (nodeRequest: IncomingMessage, nodeResponse: ServerResponse) => {
    let request: Request;
    let serializedRequest: SerializedHttpRequest;

    try {
      request = normalizeNodeRequest(nodeRequest, getFetchAPI());
      serializedRequest = await serializeRequest(request);
    } catch (error) {
      // The Fetch API forbids some methods, such as `TRACE` and `CONNECT`, so their requests cannot be handled.
      console.error(error);
      rejectNodeResponse(nodeResponse);
      return;
    }

    // Only one worker is tried, and the same worker decides the unhandled request strategy even if workers reset or
    // disconnect while the request is handled. Other workers belong to other processes or authentication tokens, so
    // they do not serve each other's requests.
    const worker = this.findWorkerByRequestBaseURL(serializedRequest);

    try {
      const { response, matchedSomeHandler, wasUnhandledRequestLogged } = await this.handleRequestInWorker(
        serializedRequest,
        worker,
      );

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
      const shouldWarnUnhandledRequest =
        !wasUnhandledRequestLogged && (!isUnhandledPreflightResponse || matchedSomeHandler);

      if (shouldWarnUnhandledRequest) {
        await this.logUnhandledRequestIfNecessary(request);
      }

      if (isUnhandledPreflightResponse) {
        const defaultPreflightResponse = new Response(null, { status: DEFAULT_PREFLIGHT_STATUS_CODE });
        this.setDefaultAccessControlHeaders(defaultPreflightResponse);
        await sendNodeResponse(defaultPreflightResponse, nodeResponse, nodeRequest, true);
      }

      rejectNodeResponse(nodeResponse);
    } catch (error) {
      // An aborted reply means that the worker disconnected, which is not an error of the server.
      const isMessageAbortError = error instanceof WebSocketMessageAbortError;

      if (!isMessageAbortError) {
        console.error(error);
      }

      // The reply was not received or cannot be trusted, so the request is logged as if the worker did not log it.
      await this.logUnhandledRequestIfNecessary(request);

      rejectNodeResponse(nodeResponse);
    }
  };

  private async handleRequestInWorker(request: SerializedHttpRequest, worker: HttpWorker | undefined) {
    if (!worker) {
      return { response: null, matchedSomeHandler: false, wasUnhandledRequestLogged: false };
    }

    const reply = await this.webSocketServer.request(
      'interceptors/http/requests/handle',
      { request },
      { sockets: [worker.socket] },
    );

    const {
      response: serializedResponse,
      matchedSomeHandler,
      wasUnhandledRequestLogged,
    } = parseInterceptorServerRPCData(requestHandlingReplySchema, reply);

    const response = serializedResponse ? deserializeResponse(serializedResponse) : null;
    return { response, matchedSomeHandler, wasUnhandledRequestLogged };
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

  private async logUnhandledRequestIfNecessary(request: HttpRequest) {
    if (!this.shouldLogUnhandledRequests()) {
      return;
    }

    await logUnhandledRequestWarning(request, 'reject');
  }

  // A request goes to the newest worker with a running interceptor whose base URL is a prefix of the request URL, even
  // if that interceptor has no handlers, so that the worker applies the unhandled request strategy of its last started
  // matching interceptor, as in local mode. WebSocket connections follow the same rule.
  private findWorkerByRequestBaseURL(request: SerializedHttpRequest) {
    const workers = Array.from(this.httpWorkersBySocket.values());

    return workers.findLast((worker) => {
      return worker.interceptorBaseURLs.some((baseURL) => isURLUnderBaseURL(request.url, baseURL));
    });
  }

  stop() {
    this.webSocketServer.offChannel('event', 'interceptors/http/workers/reset', this.resetWorker);

    this.httpWorkersBySocket.clear();
  }
}

export default HttpInterceptorServerRuntime;
