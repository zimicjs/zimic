import type { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER } from '@/interceptor/constants';
import { InterceptorServerWebSocketSchema, WebSocketHandlerCommit, WebSocketHandlerReset } from '@/server/types/schema';
import { isClientSide, isServerSide } from '@/utils/environment';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import { WebSocketEventMessage } from '@/utils/webSocket/types';
import WebSocketClient from '@/utils/webSocket/WebSocketClient';

import NotRunningWebSocketInterceptorError from '../interceptor/errors/NotRunningWebSocketInterceptorError';
import UnknownWebSocketInterceptorPlatformError from '../interceptor/errors/UnknownWebSocketInterceptorPlatformError';
import { WebSocketInterceptorPlatform } from '../interceptor/types/options';
import {
  createWebSocketInterceptorClient,
  InternalWebSocketInterceptorClient,
} from '../interceptor/WebSocketInterceptorHandle';
import { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';
import {
  deserializeWebSocketMessageDataFromTransport,
  serializeWebSocketMessageDataForTransport,
} from '../utils/messageData';
import { RemoteWebSocketInterceptorWorkerOptions } from './types/options';
import WebSocketInterceptorWorker from './WebSocketInterceptorWorker';

interface WebSocketHandler {
  id: string;
  baseURL: string;
  interceptor: AnyWebSocketInterceptorImplementation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clients: Map<string, InternalWebSocketInterceptorClient<any>>;
}

class RemoteWebSocketInterceptorWorker extends WebSocketInterceptorWorker {
  private webSocketHandlers = new Map<WebSocketHandler['id'], WebSocketHandler>();
  private auth?: RemoteWebSocketInterceptorWorkerOptions['auth'];

  webSocketClient: WebSocketClient<InterceptorServerWebSocketSchema>;

  constructor(options: RemoteWebSocketInterceptorWorkerOptions) {
    super();

    this.webSocketClient = new WebSocketClient({
      url: options.serverURL.toString(),
    });

    this.auth = options.auth;
  }

  async start() {
    await super.sharedStart(async () => {
      await this.webSocketClient.start({
        parameters: {
          [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
          ...(this.auth ? { token: this.auth.token } : {}),
        },
        waitForAuthentication: true,
      });

      this.webSocketClient.onChannel('event', 'interceptors/ws/clients/connect', this.connectClient);
      this.webSocketClient.onChannel('event', 'interceptors/ws/clients/close', this.closeClient);
      this.webSocketClient.onChannel('event', 'interceptors/ws/messages/handle', this.handleMessage);
      this.webSocketClient.onChannel('event', 'interceptors/ws/messages/unhandled', this.handleUnhandledMessage);

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
      this.webSocketClient.offChannel('event', 'interceptors/ws/messages/unhandled', this.handleUnhandledMessage);

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

    const handlerId = crypto.randomUUID();

    const commitPromise = this.webSocketClient
      .request('interceptors/ws/workers/commit', {
        id: handlerId,
        baseURL: interceptor.baseURLAsString,
      })
      .then(() => undefined)
      .catch((error: unknown) => {
        this.webSocketHandlers.delete(handlerId);
        throw error;
      });

    const newHandler: WebSocketHandler = {
      id: handlerId,
      baseURL: interceptor.baseURLAsString,
      interceptor,
      clients: new Map(),
    };

    this.webSocketHandlers.set(newHandler.id, newHandler);

    return commitPromise;
  }

  async sendToClient<Schema extends WebSocketSchema>(
    client: InternalWebSocketInterceptorClient<Schema>,
    data: WebSocketMessageData<Schema>,
  ) {
    const clientEntry = this.findClientEntry(client);

    if (!clientEntry) {
      return;
    }

    this.webSocketClient.send('interceptors/ws/messages/send', {
      clientId: clientEntry.clientId,
      data: await serializeWebSocketMessageDataForTransport(data),
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
      data: await serializeWebSocketMessageDataForTransport(data),
    });
  }

  private connectClient = ({
    data: connection,
  }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/clients/connect'>) => {
    const handler = this.webSocketHandlers.get(connection.handlerId);

    if (!handler) {
      return { accepted: false };
    }

    const client = createWebSocketInterceptorClient(connection.url, async (data) => {
      await this.sendToClient(client, data);
    });

    // The registry is intentionally schema-erased because one remote worker owns interceptors for any schema.
    handler.clients.set(connection.clientId, client);
    handler.interceptor.addClient(client);

    return { accepted: true };
  };

  private closeClient = ({
    data: connection,
  }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/clients/close'>) => {
    // A connection shared by several interceptors has one client in each of them.
    for (const handler of this.webSocketHandlers.values()) {
      const client = handler.clients.get(connection.clientId);

      if (client) {
        handler.clients.delete(connection.clientId);
        handler.interceptor.removeClient(client);
      }
    }
  };

  private handleMessage = async ({
    data: message,
  }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/messages/handle'>) => {
    const handler = this.webSocketHandlers.get(message.handlerId);
    const client = handler?.clients.get(message.clientId);

    /* istanbul ignore if -- @preserve
     * Stale server events after a worker reset are ignored; normal connect/close paths cover registered clients. */
    if (!handler || !client) {
      return { handled: false };
    }

    try {
      const deserializedMessageData = deserializeWebSocketMessageDataFromTransport(message.data);

      return await handler.interceptor.handleInterceptedMessage(deserializedMessageData, {
        sender: client,
        receiver: handler.interceptor.server,
      });
    } catch (error) {
      console.error(error);
      return { handled: false, error: true };
    }
  };

  private handleUnhandledMessage = async ({
    data: message,
  }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/messages/unhandled'>) => {
    const handler = this.webSocketHandlers.get(message.handlerId);

    /* istanbul ignore if -- @preserve
     * Stale server events after a worker reset are ignored; normal connect/close paths cover registered clients. */
    if (!handler) {
      return {};
    }

    const deserializedMessageData = deserializeWebSocketMessageDataFromTransport(message.data);
    await handler.interceptor.logUnhandledMessageIfNecessary(deserializedMessageData);

    return {};
  };

  private findHandlerByInterceptor<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
  ) {
    return Array.from(this.webSocketHandlers.values()).find((handler) => handler.interceptor === interceptor);
  }

  private findClientEntry<Schema extends WebSocketSchema>(client: InternalWebSocketInterceptorClient<Schema>) {
    for (const handler of this.webSocketHandlers.values()) {
      for (const [clientId, handlerClient] of handler.clients) {
        if (handlerClient === client) {
          return { handler, clientId };
        }
      }
    }

    return undefined;
  }

  async clearHandlers<Schema extends WebSocketSchema>(
    options: {
      interceptor?: AnyWebSocketInterceptorImplementation<Schema>;
      preserveInterceptorRegistration?: boolean;
    } = {},
  ) {
    if (!this.isRunning) {
      throw new NotRunningWebSocketInterceptorError();
    }

    const selectedHandlers = Array.from(this.webSocketHandlers.values()).filter((handler) => {
      return options.interceptor === undefined || handler.interceptor === options.interceptor;
    });

    const clearedHandlerIds: string[] = [];

    for (const handler of selectedHandlers) {
      handler.interceptor.clients.length = 0;

      if (options.preserveInterceptorRegistration) {
        handler.clients.clear();
        clearedHandlerIds.push(handler.id);
      } else {
        this.webSocketHandlers.delete(handler.id);
      }
    }

    if (!this.webSocketClient.isRunning) {
      return;
    }

    const reset: WebSocketHandlerReset = {
      handlers: Array.from<WebSocketHandler, WebSocketHandlerCommit>(this.webSocketHandlers.values(), (handler) => ({
        id: handler.id,
        baseURL: handler.baseURL,
      })),
      clearedHandlerIds,
    };

    try {
      await this.webSocketClient.request('interceptors/ws/workers/reset', reset);
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
