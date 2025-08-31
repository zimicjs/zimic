import { HttpMethod, HttpSchema } from '@zimic/http';
import validateURLPathParams from '@zimic/utils/url/validateURLPathParams';

import { HttpHandlerCommit, InterceptorServerWebSocketSchema } from '@/server/types/schema';
import { importCrypto } from '@/utils/crypto';
import { isClientSide, isServerSide } from '@/utils/environment';
import { deserializeRequest, serializeResponse } from '@/utils/fetch';
import { WebSocketEventMessage } from '@/webSocket/types';
import WebSocketClient from '@/webSocket/WebSocketClient';

import NotRunningHttpInterceptorError from '../interceptor/errors/NotRunningHttpInterceptorError';
import UnknownHttpInterceptorPlatformError from '../interceptor/errors/UnknownHttpInterceptorPlatformError';
import HttpInterceptorClient, { AnyHttpInterceptorClient } from '../interceptor/HttpInterceptorClient';
import { HttpInterceptorPlatform } from '../interceptor/types/options';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpResponseFactoryContext } from './types/http';
import { MSWHttpResponseFactory } from './types/msw';
import { RemoteHttpInterceptorWorkerOptions } from './types/options';

interface HttpHandler {
  id: string;
  baseURL: string;
  method: HttpMethod;
  path: string;
  interceptor: AnyHttpInterceptorClient;
  createResponse: (context: HttpResponseFactoryContext) => Promise<Response | null>;
}

class RemoteHttpInterceptorWorker extends HttpInterceptorWorker {
  private httpHandlers = new Map<HttpHandler['id'], HttpHandler>();

  webSocketClient: WebSocketClient<InterceptorServerWebSocketSchema>;
  private auth?: RemoteHttpInterceptorWorkerOptions['auth'];

  constructor(options: RemoteHttpInterceptorWorkerOptions) {
    super();

    this.webSocketClient = new WebSocketClient({
      url: this.getWebSocketServerURL(options.serverURL).toString(),
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
      await this.webSocketClient.start({
        parameters: this.auth ? { token: this.auth.token } : undefined,
        waitForAuthentication: true,
      });

      this.webSocketClient.onEvent('interceptors/responses/create', this.createResponse);
      this.webSocketClient.onEvent('interceptors/responses/unhandled', this.handleUnhandledServerRequest);

      this.platform = this.readPlatform();
      this.isRunning = true;
    });
  }

  private createResponse = async (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/responses/create'>,
  ) => {
    const { handlerId, request: serializedRequest } = message.data;

    const handler = this.httpHandlers.get(handlerId);
    const request = deserializeRequest(serializedRequest);

    try {
      const rawResponse = (await handler?.createResponse({ request })) ?? null;
      const response = rawResponse && request.method === 'HEAD' ? new Response(null, rawResponse) : rawResponse;

      if (response) {
        return { response: await serializeResponse(response) };
      }
    } catch (error) {
      console.error(error);
    }

    const strategy = await super.getUnhandledRequestStrategy(request, 'remote');
    await super.logUnhandledRequestIfNecessary(request, strategy);

    return { response: null };
  };

  private handleUnhandledServerRequest = async (
    message: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/responses/unhandled'>,
  ) => {
    const { request: serializedRequest } = message.data;
    const request = deserializeRequest(serializedRequest);

    const strategy = await super.getUnhandledRequestStrategy(request, 'remote');
    const { wasLogged } = await super.logUnhandledRequestIfNecessary(request, strategy);

    return { wasLogged };
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
      await this.clearHandlers();

      this.webSocketClient.offEvent('interceptors/responses/create', this.createResponse);
      this.webSocketClient.offEvent('interceptors/responses/unhandled', this.handleUnhandledServerRequest);

      await this.webSocketClient.stop();

      this.isRunning = false;
    });
  }

  async use<Schema extends HttpSchema>(
    interceptor: HttpInterceptorClient<Schema>,
    method: HttpMethod,
    path: string,
    createResponse: MSWHttpResponseFactory,
  ) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    validateURLPathParams(path);

    const crypto = await importCrypto();

    const handler: HttpHandler = {
      id: crypto.randomUUID(),
      baseURL: interceptor.baseURLAsString,
      method,
      path: path.toString(),
      interceptor,
      async createResponse(context) {
        const response = await createResponse(context);
        return response;
      },
    };

    this.httpHandlers.set(handler.id, handler);

    await this.webSocketClient.request('interceptors/workers/commit', {
      id: handler.id,
      baseURL: handler.baseURL,
      method: handler.method,
      path: handler.path,
    });
  }

  async clearHandlers() {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    this.httpHandlers.clear();

    if (this.webSocketClient.isRunning) {
      await this.webSocketClient.request('interceptors/workers/reset', undefined);
    }
  }

  async clearInterceptorHandlers<Schema extends HttpSchema>(interceptor: HttpInterceptorClient<Schema>) {
    if (!this.isRunning) {
      throw new NotRunningHttpInterceptorError();
    }

    for (const handler of this.httpHandlers.values()) {
      if (handler.interceptor === interceptor) {
        this.httpHandlers.delete(handler.id);
      }
    }

    if (this.webSocketClient.isRunning) {
      const groupsToRecommit = Array.from<HttpHandler, HttpHandlerCommit>(this.httpHandlers.values(), (handler) => ({
        id: handler.id,
        baseURL: handler.baseURL,
        method: handler.method,
        path: handler.path,
      }));

      await this.webSocketClient.request('interceptors/workers/reset', groupsToRecommit);
    }
  }

  get interceptorsWithHandlers() {
    const interceptors = Array.from(this.httpHandlers.values(), (handler) => handler.interceptor);
    return interceptors;
  }
}

export default RemoteHttpInterceptorWorker;
