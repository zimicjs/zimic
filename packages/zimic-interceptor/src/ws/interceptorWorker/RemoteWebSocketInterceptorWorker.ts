import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER } from '@/server/constants';
import { InterceptorServerWebSocketSchema, WebSocketHandlerCommit } from '@/server/types/schema';
import { isClientSide, isServerSide } from '@/utils/environment';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import WebSocketClient from '@/utils/webSocket/WebSocketClient';

import NotRunningWebSocketInterceptorError from '../interceptor/errors/NotRunningWebSocketInterceptorError';
import UnknownWebSocketInterceptorPlatformError from '../interceptor/errors/UnknownWebSocketInterceptorPlatformError';
import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import { WebSocketInterceptorPlatform } from '../interceptor/types/options';
import { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';
import { RemoteWebSocketInterceptorWorkerOptions } from './types/options';
import WebSocketInterceptorWorker from './WebSocketInterceptorWorker';

interface WebSocketHandler {
  id: string;
  baseURL: string;
  interceptor: AnyWebSocketInterceptorImplementation;
  commitPromise: Promise<void>;
}

class RemoteWebSocketInterceptorWorker extends WebSocketInterceptorWorker {
  private webSocketHandlers = new Map<WebSocketHandler['id'], WebSocketHandler>();
  private auth?: RemoteWebSocketInterceptorWorkerOptions['auth'];

  webSocketClient: WebSocketClient<InterceptorServerWebSocketSchema>;

  constructor(options: RemoteWebSocketInterceptorWorkerOptions) {
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

    if (webSocketServerURL.protocol.startsWith('http')) {
      webSocketServerURL.protocol = serverURL.protocol.replace(/^http(s)?:$/, 'ws$1:');
    }

    return webSocketServerURL;
  }

  async start() {
    await super.sharedStart(async () => {
      await this.webSocketClient.start({
        parameters: {
          [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
          ...(this.auth ? { token: this.auth.token } : {}),
        },
        waitForAuthentication: true,
      });

      this.platform = this.readPlatform();
      this.isRunning = true;
    });
  }

  private readPlatform(): WebSocketInterceptorPlatform {
    if (isServerSide()) {
      return 'node';
    }
    /* istanbul ignore else -- @preserve */
    if (isClientSide()) {
      return 'browser';
    }
    /* istanbul ignore next -- @preserve
     * Ignoring because checking unknown platforms is not configured in our test setup. */
    throw new UnknownWebSocketInterceptorPlatformError();
  }

  async stop() {
    await super.sharedStop(async () => {
      await this.clearHandlers();
      await this.webSocketClient.stop();
      this.isRunning = false;
      this.platform = null;
    });
  }

  async use<Schema extends WebSocketSchema>(interceptor: AnyWebSocketInterceptorImplementation<Schema>) {
    if (!this.isRunning) {
      throw new NotRunningWebSocketInterceptorError();
    }

    const handler = Array.from(this.webSocketHandlers.values()).find((handler) => handler.interceptor === interceptor);

    if (handler) {
      return handler.commitPromise;
    }

    const handlerId = crypto.randomUUID();
    const commitPromise = this.webSocketClient
      .request('interceptors/web-sockets/workers/commit', {
        id: handlerId,
        baseURL: interceptor.baseURLAsString,
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        const currentHandler = this.webSocketHandlers.get(handlerId);

        if (currentHandler?.commitPromise === commitPromise) {
          this.webSocketHandlers.delete(handlerId);
        }

        throw error;
      });

    const newHandler: WebSocketHandler = {
      id: handlerId,
      baseURL: interceptor.baseURLAsString,
      interceptor,
      commitPromise,
    };

    this.webSocketHandlers.set(newHandler.id, newHandler);

    return commitPromise;
  }

  sendToClient<Schema extends WebSocketSchema>(
    _client: WebSocketInterceptorClient<Schema>,
    _data: WebSocketMessageData<Schema>,
  ) {
    throw new Error('Remote WebSocket client sends are not implemented yet.');
  }

  sendToClients<Schema extends WebSocketSchema>(
    _interceptor: AnyWebSocketInterceptorImplementation<Schema>,
    _data: WebSocketMessageData<Schema>,
  ) {
    throw new Error('Remote WebSocket broadcasts are not implemented yet.');
  }

  async clearHandlers<Schema extends WebSocketSchema>(
    options: {
      interceptor?: AnyWebSocketInterceptorImplementation<Schema>;
    } = {},
  ) {
    if (!this.isRunning) {
      throw new NotRunningWebSocketInterceptorError();
    }

    if (options.interceptor === undefined) {
      this.webSocketHandlers.clear();
    } else {
      for (const handler of this.webSocketHandlers.values()) {
        if (handler.interceptor === options.interceptor) {
          this.webSocketHandlers.delete(handler.id);
        }
      }
    }

    if (!this.webSocketClient.isRunning) {
      return;
    }

    const handlersToRecommit = Array.from<WebSocketHandler, WebSocketHandlerCommit>(
      this.webSocketHandlers.values(),
      (handler) => ({
        id: handler.id,
        baseURL: handler.baseURL,
      }),
    );

    try {
      await this.webSocketClient.request('interceptors/web-sockets/workers/reset', handlersToRecommit);
    } catch (error) {
      const isMessageAbortError = error instanceof WebSocketMessageAbortError;

      /* istanbul ignore next -- @preserve */
      if (!isMessageAbortError) {
        throw error;
      }
    }
  }
}

export default RemoteWebSocketInterceptorWorker;
