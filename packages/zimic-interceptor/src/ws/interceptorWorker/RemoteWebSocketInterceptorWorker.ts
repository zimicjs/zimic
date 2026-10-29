import type { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import {
  INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER,
  INTERCEPTOR_SERVER_RPC_VERSION,
  INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER,
} from '@/interceptor/constants';
import { InterceptorServerWebSocketSchema, WebSocketWorkerReset } from '@/server/types/schema';
import { isClientSide, isServerSide } from '@/utils/environment';
import { logUnexpectedServerDisconnection } from '@/utils/logging';
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

interface RegisteredWebSocketInterceptor {
  id: string;
  baseURL: string;
  interceptor: AnyWebSocketInterceptorImplementation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clients: Map<string, InternalWebSocketInterceptorClient<any>>;
  // The number of resets sent to the server when the interceptor was last cleared.
  numberOfResetsWhenCleared: number;
}

class RemoteWebSocketInterceptorWorker extends WebSocketInterceptorWorker {
  private registeredInterceptors = new Map<RegisteredWebSocketInterceptor['id'], RegisteredWebSocketInterceptor>();
  private numberOfResets = 0;
  private sendQueue = Promise.resolve();
  private auth?: RemoteWebSocketInterceptorWorkerOptions['auth'];

  webSocketClient: WebSocketClient<InterceptorServerWebSocketSchema>;

  constructor(options: RemoteWebSocketInterceptorWorkerOptions) {
    super();

    this.webSocketClient = new WebSocketClient({
      url: options.serverURL.toString(),
      onUnexpectedClose: () => {
        logUnexpectedServerDisconnection(options.serverURL);
      },
    });

    this.auth = options.auth;
  }

  async start() {
    await super.sharedStart(async () => {
      // The server counts resets per worker socket, so a new socket starts the count again.
      this.numberOfResets = 0;

      await this.webSocketClient.start({
        parameters: {
          [INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER]: 'ws',
          [INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER]: String(INTERCEPTOR_SERVER_RPC_VERSION),
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

      // Stopped interceptors already reset their registrations, so a reset is only needed for ones still registered.
      if (this.registeredInterceptors.size > 0) {
        await this.clearHandlers();
      }

      await this.webSocketClient.stop();

      this.isRunning = false;
      this.platform = null;
    });
  }

  async use<Schema extends WebSocketSchema>(interceptor: AnyWebSocketInterceptorImplementation<Schema>) {
    if (!this.isRunning) {
      throw new NotRunningWebSocketInterceptorError();
    }

    const registeredInterceptor: RegisteredWebSocketInterceptor = {
      id: crypto.randomUUID(),
      baseURL: interceptor.baseURLAsString,
      interceptor,
      clients: new Map(),
      numberOfResetsWhenCleared: 0,
    };

    this.registeredInterceptors.set(registeredInterceptor.id, registeredInterceptor);

    try {
      await this.resetServerWorker([]);
    } catch (error) {
      this.registeredInterceptors.delete(registeredInterceptor.id);
      throw error;
    }
  }

  async sendToClient<Schema extends WebSocketSchema>(
    client: InternalWebSocketInterceptorClient<Schema>,
    data: WebSocketMessageData<Schema>,
  ) {
    const clientEntry = this.findClientEntry(client);

    if (clientEntry) {
      await this.enqueueSend({ clientId: clientEntry.clientId }, data);
    }
  }

  async sendToClients<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
    data: WebSocketMessageData<Schema>,
  ) {
    const registeredInterceptor = this.findRegisteredInterceptor(interceptor);

    if (registeredInterceptor) {
      await this.enqueueSend({ interceptorId: registeredInterceptor.id }, data);
    }
  }

  // Serializing a Blob is asynchronous, so sends are chained to reach the server in call order, as in local mode.
  // Failures are logged because the public send methods return nothing to reject, as native `WebSocket.send`.
  private enqueueSend<Schema extends WebSocketSchema>(
    target: { clientId: string } | { interceptorId: string },
    data: WebSocketMessageData<Schema>,
  ) {
    this.sendQueue = this.sendQueue.then(async () => {
      try {
        this.webSocketClient.send('interceptors/ws/messages/send', {
          ...target,
          data: await serializeWebSocketMessageDataForTransport(data),
        });
      } catch (error) {
        console.error(error);
      }
    });

    return this.sendQueue;
  }

  private connectClient = ({
    data: connection,
  }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/clients/connect'>) => {
    const holders: {
      registeredInterceptor: RegisteredWebSocketInterceptor;
      client: InternalWebSocketInterceptorClient<WebSocketSchema>;
    }[] = [];

    for (const interceptorId of connection.interceptorIds) {
      const registeredInterceptor = this.registeredInterceptors.get(interceptorId);

      // A removed interceptor, or one cleared after the server sent the connection, does not accept it, as a local
      // interceptor cleared after a connection opens lets it go. The reset of that interceptor reaches the server
      // before this reply, so the server no longer counts it as a holder.
      if (!registeredInterceptor || registeredInterceptor.numberOfResetsWhenCleared > connection.numberOfResets) {
        continue;
      }

      const client = createWebSocketInterceptorClient(connection.url, async (data) => {
        await this.sendToClient(client, data);
      });

      // The registry is intentionally schema-erased because one remote worker owns interceptors for any schema.
      registeredInterceptor.clients.set(connection.clientId, client);
      holders.push({ registeredInterceptor, client });
    }

    // Every holder lists the client before any connection listener runs, so a listener that clears another holder makes
    // it let the connection go, as in local mode.
    for (const { registeredInterceptor, client } of holders) {
      if (registeredInterceptor.clients.has(connection.clientId)) {
        registeredInterceptor.interceptor.addClient(client);
      }
    }

    return { acceptedInterceptorIds: holders.map(({ registeredInterceptor }) => registeredInterceptor.id) };
  };

  private closeClient = ({
    data: connection,
  }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/clients/close'>) => {
    // A connection shared by several interceptors has one client in each of them.
    for (const registeredInterceptor of this.registeredInterceptors.values()) {
      const client = registeredInterceptor.clients.get(connection.clientId);

      if (client) {
        registeredInterceptor.clients.delete(connection.clientId);
        registeredInterceptor.interceptor.removeClient(client);
      }
    }
  };

  private handleMessage = async ({
    data: message,
  }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/messages/handle'>) => {
    // Holders removed or cleared after the server sent the message no longer hold the connection.
    const holders = message.interceptorIds.flatMap((interceptorId) => {
      const registeredInterceptor = this.registeredInterceptors.get(interceptorId);
      const client = registeredInterceptor?.clients.get(message.clientId);
      return registeredInterceptor && client ? [{ interceptor: registeredInterceptor.interceptor, client }] : [];
    });

    const deserializedMessageData = deserializeWebSocketMessageDataFromTransport(message.data);
    await this.handleMessageWithHandlers(deserializedMessageData, holders);
  };

  private findRegisteredInterceptor<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
  ) {
    return Array.from(this.registeredInterceptors.values()).find((registeredInterceptor) => {
      return registeredInterceptor.interceptor === interceptor;
    });
  }

  private findClientEntry<Schema extends WebSocketSchema>(client: InternalWebSocketInterceptorClient<Schema>) {
    for (const registeredInterceptor of this.registeredInterceptors.values()) {
      for (const [clientId, interceptorClient] of registeredInterceptor.clients) {
        if (interceptorClient === client) {
          return { registeredInterceptor, clientId };
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

    this.clearMessageHandlers(options.interceptor);

    const selectedInterceptors = Array.from(this.registeredInterceptors.values()).filter((registeredInterceptor) => {
      return options.interceptor === undefined || registeredInterceptor.interceptor === options.interceptor;
    });

    const clearedInterceptors: RegisteredWebSocketInterceptor[] = [];

    for (const registeredInterceptor of selectedInterceptors) {
      for (const client of registeredInterceptor.clients.values()) {
        registeredInterceptor.interceptor.removeClient(client);
      }

      if (options.preserveInterceptorRegistration) {
        registeredInterceptor.clients.clear();
        clearedInterceptors.push(registeredInterceptor);
      } else {
        this.registeredInterceptors.delete(registeredInterceptor.id);
      }
    }

    await this.resetServerWorker(clearedInterceptors);
  }

  private async resetServerWorker(clearedInterceptors: RegisteredWebSocketInterceptor[]) {
    if (!this.webSocketClient.isRunning) {
      return;
    }

    this.numberOfResets++;

    for (const registeredInterceptor of clearedInterceptors) {
      registeredInterceptor.numberOfResetsWhenCleared = this.numberOfResets;
    }

    const reset: WebSocketWorkerReset = {
      interceptors: Array.from(this.registeredInterceptors.values(), (registeredInterceptor) => ({
        id: registeredInterceptor.id,
        baseURL: registeredInterceptor.baseURL,
      })),
      clearedInterceptorIds: clearedInterceptors.map((registeredInterceptor) => registeredInterceptor.id),
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
