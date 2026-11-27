import type { HttpBody, HttpHeadersInit, HttpMethod, HttpRequest, HttpSchema } from '@zimic/http';

import {
  INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER,
  INTERCEPTOR_SERVER_RPC_VERSION,
  INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER,
} from '@/interceptor/constants';
import UnsupportedResponseBypassError from '@/server/errors/UnsupportedResponseBypassError';
import { HttpWorkerReset, InterceptorServerWebSocketSchema } from '@/server/types/schema';
import { isClientSide, isServerSide } from '@/utils/environment';
import { deserializeRequest, serializeResponse } from '@/utils/fetch';
import { methodCanHaveResponseBody } from '@/utils/http';
import { logUnexpectedServerDisconnection } from '@/utils/logging';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import { WebSocketEventMessage } from '@/utils/webSocket/types';
import WebSocketClient from '@/utils/webSocket/WebSocketClient';

import NotRunningHttpInterceptorError from '../interceptor/errors/NotRunningHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from '../interceptor/errors/UnknownHttpInterceptorPlatformError';
import HttpInterceptorImplementation, {
  AnyHttpInterceptorImplementation,
} from '../interceptor/HttpInterceptorImplementation';
import { HttpInterceptorPlatform, UnhandledRequestStrategy } from '../interceptor/types/options';
import { AnyHttpRequestHandlerImplementation } from '../requestHandler/HttpRequestHandlerImplementation';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { RemoteHttpInterceptorWorkerOptions } from './types/options';

class RemoteHttpInterceptorWorker extends HttpInterceptorWorker {
  webSocketClient: WebSocketClient<InterceptorServerWebSocketSchema>;
  private isConnectedToServer = false;
  private auth?: RemoteHttpInterceptorWorkerOptions['auth'];

  // Counted per server connection, as the resets sent and the replies received on it.
  private numberOfResets = 0;
  private numberOfAcknowledgedResets = 0;
  // The number of resets sent when each interceptor or handler was last cleared.
  private numberOfResetsWhenCleared = new WeakMap<
    AnyHttpInterceptorImplementation | AnyHttpRequestHandlerImplementation,
    number
  >();

  constructor(options: RemoteHttpInterceptorWorkerOptions) {
    super();

    this.webSocketClient = new WebSocketClient({
      url: this.getWebSocketServerURL(options.serverURL).toString(),
      onUnexpectedClose: () => {
        logUnexpectedServerDisconnection(options.serverURL);
      },
    });

    this.auth = options.auth;
  }

  get type() {
    return 'remote' as const;
  }

  private getWebSocketServerURL(serverURL: URL) {
    const webSocketServerURL = new URL(serverURL);
    webSocketServerURL.protocol = serverURL.protocol.replace(/^http(s)?:$/, 'ws$1:');
    return webSocketServerURL;
  }

  async start() {
    await super.sharedStart(async () => {
      this.numberOfResets = 0;
      this.numberOfAcknowledgedResets = 0;
      this.numberOfResetsWhenCleared = new WeakMap();

      this.webSocketClient.onChannel('event', 'interceptors/http/requests/handle', this.handleRequest);
      this.webSocketClient.onChannel('reply', 'interceptors/http/workers/reset', this.acknowledgeReset);

      await this.webSocketClient.start({
        parameters: {
          [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'http',
          [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
          ...(this.auth ? { token: this.auth.token } : {}),
        },
        waitForAuthentication: true,
      });

      // Resets are sent only from here on, because the socket opens before the server authenticates it and messages
      // sent in between are never answered. This first reset includes the interceptors registered until now.
      this.isConnectedToServer = true;

      try {
        await this.resetServerWorker();
      } catch (error) {
        // Stopping returns early while the worker is not running, so the connection is closed here.
        await this.disconnectFromServer();
        throw error;
      }

      this.platform = this.readPlatform();
      this.isRunning = true;
    });
  }

  async registerRunningInterceptor(interceptor: AnyHttpInterceptorImplementation) {
    await super.registerRunningInterceptor(interceptor);
    await this.resetServerWorker();
  }

  async unregisterRunningInterceptor(interceptor: AnyHttpInterceptorImplementation) {
    await super.unregisterRunningInterceptor(interceptor);
    await this.resetServerWorker();
  }

  // The server replies to resets in the order it reads them, right after reading each one, so the replies received when
  // a request arrives count at most the resets the server read before forwarding it. A request forwarded between a reset
  // and its reply counts as forwarded before that reset. Replies are counted as their frames are read, because a request
  // frame read in the same chunk is handled before a reply promise settles.
  private acknowledgeReset = () => {
    this.numberOfAcknowledgedResets++;
  };

  private handleRequest = async (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/http/requests/handle'>,
  ) => {
    // Clears do not wait for the server, so a request sent right after a clear can reach the server before the reset
    // does and be handled as sent before the clear. No synchronous clear can tell these requests apart.
    const numberOfResetsBeforeRequest = this.numberOfAcknowledgedResets;

    const request = deserializeRequest(message.data.request);

    const { response: rawResponse, matchedSomeHandler } = await this.createResponseWithHandlers(request, {
      wasClearedAfterRequest: (handler) => {
        const numberOfResetsWhenCleared = Math.max(
          this.numberOfResetsWhenCleared.get(handler.interceptor) ?? 0,
          this.numberOfResetsWhenCleared.get(handler.implementation) ?? 0,
        );
        return numberOfResetsWhenCleared > numberOfResetsBeforeRequest;
      },
    });

    if (!rawResponse) {
      // The server answers an unmatched preflight request with its default preflight response, so it is not warned.
      const isUnmatchedPreflightRequest = request.method === 'OPTIONS' && !matchedSomeHandler;

      if (isUnmatchedPreflightRequest) {
        return { response: null, matchedSomeHandler, wasUnhandledRequestLogged: false };
      }

      const strategy = await super.getUnhandledRequestStrategy(request, 'remote');
      const { wasUnhandledRequestLogged } = await super.logUnhandledRequestIfNecessary(request, strategy);

      return { response: null, matchedSomeHandler, wasUnhandledRequestLogged };
    }

    const response = methodCanHaveResponseBody(request.method as HttpMethod)
      ? rawResponse
      : new Response(null, rawResponse);

    return { response: await serializeResponse(response), matchedSomeHandler, wasUnhandledRequestLogged: false };
  };

  private readPlatform(): HttpInterceptorPlatform {
    if (isServerSide()) {
      return 'node';
    }
    /* istanbul ignore else -- @preserve */
    if (isClientSide()) {
      return 'browser';
    }
    /* istanbul ignore next -- @preserve
     * Ignoring because checking unknown platforms is not configured in our test setup. */
    throw new UnknownHttpInterceptorPlatformError();
  }

  async stop() {
    await super.sharedStop(async () => {
      this.webSocketClient.offChannel('event', 'interceptors/http/requests/handle', this.handleRequest);
      this.webSocketClient.offChannel('reply', 'interceptors/http/workers/reset', this.acknowledgeReset);

      this.clearHandlers();

      await this.disconnectFromServer();

      this.isRunning = false;
    });
  }

  private async disconnectFromServer() {
    this.isConnectedToServer = false;

    // Stopping the client also removes its channel listeners.
    await this.webSocketClient.stop();
  }

  private async resetServerWorker() {
    if (!this.isConnectedToServer || !this.webSocketClient.isRunning) {
      return;
    }

    this.numberOfResets++;

    const reset: HttpWorkerReset = {
      interceptorBaseURLs: this.runningInterceptors.map((interceptor) => interceptor.baseURLAsString),
    };

    try {
      await this.webSocketClient.request('interceptors/http/workers/reset', reset);
    } catch (error) {
      /* istanbul ignore next -- @preserve
       *
       * If the socket is closed before receiving a response, the message is aborted with an error. This can happen if
       * we send a request message and the interceptor server closes the socket before sending a response. In this case,
       * we can safely ignore the error because we know that the server is shutting down and resetting is no longer
       * necessary.
       *
       * Due to the rare nature of this edge case, we can't reliably reproduce it in tests. */
      const isMessageAbortError = error instanceof WebSocketMessageAbortError;

      /* istanbul ignore next -- @preserve */
      if (!isMessageAbortError) {
        throw error;
      }
    }
  }

  async createResponseFromDeclaration(
    request: HttpRequest,
    declaration:
      { status: number; headers?: HttpHeadersInit; body?: HttpBody } | { action: UnhandledRequestStrategy.Action },
  ) {
    const response = await super.createResponseFromDeclaration(request, declaration);

    if (response && HttpInterceptorWorker.isBypassedResponse(response)) {
      throw new UnsupportedResponseBypassError();
    }

    if (response && HttpInterceptorWorker.isRejectedResponse(response)) {
      return response;
    }

    return response;
  }

  clearHandlers<Schema extends HttpSchema>(
    options: {
      interceptor?: HttpInterceptorImplementation<Schema>;
    } = {},
  ) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    this.clearHttpHandlers(options.interceptor);

    if (options.interceptor) {
      this.markAsCleared(options.interceptor);
    }
  }

  markHandlerAsCleared(handler: AnyHttpRequestHandlerImplementation) {
    this.markAsCleared(handler);
  }

  // The reset tells requests the server forwarded before reading it apart from the ones it forwarded after, so clears
  // send it without waiting for the reply.
  private markAsCleared(target: AnyHttpInterceptorImplementation | AnyHttpRequestHandlerImplementation) {
    this.resetServerWorker().catch(
      /* istanbul ignore next -- @preserve
       * Clears return nothing to reject, so failures other than aborts are logged. They happen only if the server stops
       * replying, which tests do not simulate. */
      (error: unknown) => {
        console.error(error);
      },
    );

    this.numberOfResetsWhenCleared.set(target, this.numberOfResets);
  }
}

export default RemoteHttpInterceptorWorker;
