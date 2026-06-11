import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER } from '@/server/constants';
import { InterceptorServerWebSocketSchema, WebSocketHandlerCommit } from '@/server/types/schema';
import { isClientSide, isServerSide } from '@/utils/environment';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import { WebSocketEventMessage } from '@/utils/webSocket/types';
import WebSocketClient from '@/utils/webSocket/WebSocketClient';

import NotRunningWebSocketInterceptorError from '../interceptor/errors/NotRunningWebSocketInterceptorError';
import UnknownWebSocketInterceptorPlatformError from '../interceptor/errors/UnknownWebSocketInterceptorPlatformError';
import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import { WebSocketInterceptorPlatform } from '../interceptor/types/options';
import { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';
import { deserializeWebSocketMessageData, serializeWebSocketMessageData } from '../utils/messageData';
import { RemoteWebSocketInterceptorWorkerOptions } from './types/options';
import WebSocketInterceptorWorker from './WebSocketInterceptorWorker';

interface WebSocketHandler {
  id: string;
  baseURL: string;
  interceptor: AnyWebSocketInterceptorImplementation;
  commitPromise: Promise<void>;
  clients: Map<string, WebSocketInterceptorClient<WebSocketSchema>>;
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

      this.webSocketClient.onChannel('event', 'interceptors/ws/clients/connect', this.connectClient);
      this.webSocketClient.onChannel('event', 'interceptors/ws/clients/close', this.closeClient);
      this.webSocketClient.onChannel('event', 'interceptors/ws/messages/handle', this.handleMessage);

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
      this.webSocketClient.offChannel('event', 'interceptors/ws/clients/connect', this.connectClient);
      this.webSocketClient.offChannel('event', 'interceptors/ws/clients/close', this.closeClient);
      this.webSocketClient.offChannel('event', 'interceptors/ws/messages/handle', this.handleMessage);
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
      .request('interceptors/ws/workers/commit', {
        id: handlerId,
        baseURL: interceptor.baseURLAsString,
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        const currentHandler = this.webSocketHandlers.get(handlerId);

        /* istanbul ignore else -- @preserve
         * This only skips deletion if the pending handler was already replaced by a newer commit. */
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
      clients: new Map(),
    };

    this.webSocketHandlers.set(newHandler.id, newHandler);

    return commitPromise;
  }

  async sendToClient<Schema extends WebSocketSchema>(
    client: WebSocketInterceptorClient<Schema>,
    data: WebSocketMessageData<Schema>,
  ) {
    const clientEntry = this.findClientEntry(client);

    if (!clientEntry) {
      return;
    }

    this.webSocketClient.send('interceptors/ws/messages/send', {
      clientId: clientEntry.clientId,
      data: await serializeWebSocketMessageData(data),
    });
  }

  async sendToClients<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
    data: WebSocketMessageData<Schema>,
  ) {
    const handler = this.findHandlerByInterceptor(interceptor);

    if (!handler) {
      return;
    }

    this.webSocketClient.send('interceptors/ws/messages/send', {
      handlerId: handler.id,
      data: await serializeWebSocketMessageData(data),
    });
  }

  private connectClient = ({
    data: connection,
  }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/clients/connect'>) => {
    const handler = this.webSocketHandlers.get(connection.handlerId);

    if (!handler) {
      return {};
    }

    const client = handler.interceptor.createClient(connection.url, {
      send: (data) => {
        void this.sendToClient(client, data);
      },
    });

    // The registry is intentionally schema-erased because one remote worker owns interceptors for any schema.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    handler.clients.set(connection.clientId, client);
    handler.interceptor.addClient(client);

    return {};
  };

  private closeClient = ({
    data: connection,
  }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/clients/close'>) => {
    const clientEntry = this.findClientEntryById(connection.clientId);

    if (!clientEntry) {
      return;
    }

    clientEntry.handler.clients.delete(connection.clientId);
    clientEntry.handler.interceptor.removeClient(clientEntry.client);
  };

  private handleMessage = async ({
    data: message,
  }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/messages/handle'>) => {
    const handler = this.webSocketHandlers.get(message.handlerId);
    const client = handler?.clients.get(message.clientId);

    /* istanbul ignore if -- @preserve
     * Stale server events after a worker reset are ignored; normal connect/close paths cover registered clients. */
    if (!handler || !client) {
      return {};
    }

    try {
      await handler.interceptor.handleInterceptedMessage(deserializeWebSocketMessageData(message.data), {
        sender: client,
        receiver: handler.interceptor.server,
      });
    } catch (error) {
      console.error(error);
    }

    return {};
  };

  private findHandlerByInterceptor<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
  ) {
    return Array.from(this.webSocketHandlers.values()).find((handler) => handler.interceptor === interceptor);
  }

  private findClientEntry<Schema extends WebSocketSchema>(client: WebSocketInterceptorClient<Schema>) {
    for (const handler of this.webSocketHandlers.values()) {
      for (const [clientId, handlerClient] of handler.clients) {
        if (handlerClient === client) {
          return { handler, clientId };
        }
      }
    }

    return undefined;
  }

  private findClientEntryById(clientId: string) {
    for (const handler of this.webSocketHandlers.values()) {
      const client = handler.clients.get(clientId);

      if (client) {
        return { handler, client };
      }
    }

    return undefined;
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
      for (const handler of this.webSocketHandlers.values()) {
        handler.interceptor.clients.length = 0;
      }
      this.webSocketHandlers.clear();
    } else {
      for (const handler of this.webSocketHandlers.values()) {
        if (handler.interceptor === options.interceptor) {
          handler.interceptor.clients.length = 0;
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
      await this.webSocketClient.request('interceptors/ws/workers/reset', handlersToRecommit);
      /* istanbul ignore next -- @preserve
       * Reset aborts only occur when the RPC socket closes during a reset request. */
    } catch (error) {
      /* istanbul ignore next -- @preserve */
      const isMessageAbortError = error instanceof WebSocketMessageAbortError;

      /* istanbul ignore next -- @preserve */
      if (!isMessageAbortError) {
        throw error;
      }
    }
  }
}

export default RemoteWebSocketInterceptorWorker;
