import type { PossiblePromise } from '@zimic/utils/types';
import type { WebSocketMessageData, WebSocketMessageSchema, WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';

import {
  INTERCEPTOR_SERVER_RPC_PROTOCOL_PARAMETER,
  INTERCEPTOR_SERVER_RPC_VERSION,
  INTERCEPTOR_SERVER_RPC_VERSION_PARAMETER,
} from '@/interceptor/constants';
import {
  InterceptorServerWebSocketSchema,
  WebSocketClientConnectionReply,
  WebSocketWorkerReset,
} from '@/server/types/schema';
import { isClientSide, isServerSide } from '@/utils/environment';
import { logUnexpectedServerDisconnection } from '@/utils/logging';
import { WebSocketMessageAbortError } from '@/utils/webSocket';
import { WebSocketEventMessage } from '@/utils/webSocket/types';
import WebSocketClient from '@/utils/webSocket/WebSocketClient';

import NotRunningWebSocketInterceptorError from '../interceptor/errors/NotRunningWebSocketInterceptorError';
import UnknownWebSocketInterceptorPlatformError from '../interceptor/errors/UnknownWebSocketInterceptorPlatformError';
import { WebSocketInterceptorPlatform } from '../interceptor/types/options';
import type {
  WebSocketInterceptorProtocolConnectionClaim,
  WebSocketInterceptorProtocolFrame,
} from '../interceptor/types/protocol';
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
  interceptor: AnyWebSocketInterceptorImplementation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clients: Map<string, InternalWebSocketInterceptorClient<any>>;
  // The number of resets sent to the server when the interceptor was last cleared.
  numberOfResetsWhenCleared: number;
}

class RemoteWebSocketInterceptorWorker extends WebSocketInterceptorWorker {
  private registeredInterceptors = new Map<RegisteredWebSocketInterceptor['id'], RegisteredWebSocketInterceptor>();
  private decidingClientIds = new Set<string>();
  private claimedConnections = new Map<string, WebSocketInterceptorProtocolConnectionClaim>();
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
      this.webSocketClient.onChannel('event', 'interceptors/ws/clients/close', this.removeClosedClient);
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
      this.webSocketClient.offChannel('event', 'interceptors/ws/clients/close', this.removeClosedClient);
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
    data: WebSocketMessageData<WebSocketSchemaMessage<Schema>>,
  ) {
    const clientId = this.findClientId(client);

    if (clientId) {
      await this.enqueueSend(clientId, data);
    }
  }

  // Only clients already listed receive the message, as in local mode, so connections still being decided do not.
  async sendToClients<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
    data: WebSocketMessageData<WebSocketSchemaMessage<Schema>>,
  ) {
    const registeredInterceptor = this.findRegisteredInterceptor(interceptor);
    const clientIds = registeredInterceptor?.clients.keys() ?? [];

    await Promise.all(Array.from(clientIds, (clientId) => this.enqueueSend(clientId, data)));
  }

  async closeClient<Schema extends WebSocketSchema>(
    client: InternalWebSocketInterceptorClient<Schema>,
    code?: number,
    reason?: string,
  ) {
    const clientId = this.findClientId(client);

    if (clientId) {
      // Queued after earlier sends, so the client receives them before the connection closes, as in local mode.
      await this.enqueueServerEvent(() => {
        this.webSocketClient.send('interceptors/ws/clients/disconnect', {
          clientId,
          code,
          reason,
        });
      });
    }
  }

  private enqueueSend<Message extends WebSocketMessageSchema>(clientId: string, data: WebSocketMessageData<Message>) {
    return this.enqueueServerEvent(async () => {
      this.webSocketClient.send('interceptors/ws/messages/send', {
        clientId,
        data: await serializeWebSocketMessageDataForTransport(data),
      });
    });
  }

  // Serializing a Blob is asynchronous, so sends and closes are chained to reach the server in call order, as in local
  // mode. Failures are logged because the public send and close methods return nothing to reject, as native
  // `WebSocket.send` and `WebSocket.close`.
  private enqueueServerEvent(sendEvent: () => PossiblePromise<void>) {
    this.sendQueue = this.sendQueue.then(async () => {
      try {
        await sendEvent();
      } catch (error) {
        console.error(error);
      }
    });

    return this.sendQueue;
  }

  // A connection claimed by a protocol opens its clients through the protocol, so it is not decided by the connection
  // handlers and has no client of its own. The protocol closes it, so the server keeps it open after its holders let
  // it go.
  private claimConnectionForProtocol(clientId: string, url: string, holders: RegisteredWebSocketInterceptor[]) {
    const rawConnection = {
      send: (frame: WebSocketInterceptorProtocolFrame) => {
        void this.enqueueSend(clientId, frame);
      },
      close: (code?: number, reason?: string) => {
        void this.enqueueServerEvent(() => {
          this.webSocketClient.send('interceptors/ws/clients/disconnect', { clientId, code, reason });
        });
      },
    };

    for (const { interceptor } of holders) {
      const claim = interceptor.claimProtocolConnection(url, rawConnection);

      if (claim) {
        this.claimedConnections.set(clientId, claim);
        return true;
      }
    }

    return false;
  }

  private connectClient = async ({
    data: connection,
  }: WebSocketEventMessage<
    InterceptorServerWebSocketSchema,
    'interceptors/ws/clients/connect'
  >): Promise<WebSocketClientConnectionReply> => {
    // A removed interceptor, or one cleared after the server sent the connection, does not accept it, as a local
    // interceptor cleared while a connection opens lets it go. The reset of that interceptor reaches the server before
    // this reply, so the server no longer counts it as a holder.
    const isHolding = (registeredInterceptor: RegisteredWebSocketInterceptor) => {
      return (
        this.registeredInterceptors.get(registeredInterceptor.id) === registeredInterceptor &&
        registeredInterceptor.numberOfResetsWhenCleared <= connection.numberOfResets
      );
    };

    const holderCandidates = connection.interceptorIds.flatMap((interceptorId) => {
      const registeredInterceptor = this.registeredInterceptors.get(interceptorId);
      return registeredInterceptor && isHolding(registeredInterceptor) ? [registeredInterceptor] : [];
    });

    if (this.claimConnectionForProtocol(connection.clientId, connection.url, holderCandidates)) {
      return { action: 'claim' };
    }

    this.decidingClientIds.add(connection.clientId);

    const handling = await this.handleConnectionWithHandlers(
      { url: connection.url, protocols: connection.protocols },
      (interceptor) => {
        return holderCandidates.some((registeredInterceptor) => {
          return registeredInterceptor.interceptor === interceptor && isHolding(registeredInterceptor);
        });
      },
    );

    // The client closed while the connection was decided, or the server stopped waiting for the decision and closed it.
    const wasClosedWhileDeciding = !this.decidingClientIds.delete(connection.clientId);

    if (handling.action === 'reject' || wasClosedWhileDeciding) {
      return { action: 'reject' };
    }

    const holders: {
      registeredInterceptor: RegisteredWebSocketInterceptor;
      client: InternalWebSocketInterceptorClient;
    }[] = [];

    for (const registeredInterceptor of holderCandidates) {
      if (!isHolding(registeredInterceptor)) {
        continue;
      }

      const client = createWebSocketInterceptorClient({
        url: connection.url,
        protocols: connection.protocols,
        connectionId: connection.clientId,
        send: async (data) => {
          await this.sendToClient(client, data);
        },
        close: async (code, reason) => {
          await this.closeClient(client, code, reason);
        },
        protocol: registeredInterceptor.interceptor.protocol,
      });

      // The registry is intentionally schema-erased because one remote worker owns interceptors for any schema.
      registeredInterceptor.clients.set(connection.clientId, client);
      registeredInterceptor.interceptor.addClient(client);
      holders.push({ registeredInterceptor, client });
    }

    // Every holder lists the client before the effects run, so an effect that clears another holder makes it let the
    // connection go, as in local mode. Sends issued by effects before the server receives this reply are kept by the
    // server until the handshake completes.
    void this.applyConnectionEffect(handling, holders);

    return {
      action: 'accept',
      acceptedInterceptorIds: holders.map(({ registeredInterceptor }) => registeredInterceptor.id),
    };
  };

  private removeClosedClient = ({
    data: connection,
  }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/clients/close'>) => {
    this.decidingClientIds.delete(connection.clientId);

    this.claimedConnections.get(connection.clientId)?.onClose();
    this.claimedConnections.delete(connection.clientId);

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
    const claim = this.claimedConnections.get(message.clientId);

    if (claim) {
      claim.onFrame(deserializeWebSocketMessageDataFromTransport(message.data));
      return;
    }

    // Holders removed or cleared after the server sent the message no longer hold the connection.
    const holders = message.interceptorIds.flatMap((interceptorId) => {
      const registeredInterceptor = this.registeredInterceptors.get(interceptorId);
      const client = registeredInterceptor?.clients.get(message.clientId);
      return registeredInterceptor && client ? [{ interceptor: registeredInterceptor.interceptor, client }] : [];
    });

    const deserializedMessageData = deserializeWebSocketMessageDataFromTransport(message.data);
    await this.handleFrameWithHandlers(deserializedMessageData, holders);
  };

  private findRegisteredInterceptor<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
  ) {
    return Array.from(this.registeredInterceptors.values()).find((registeredInterceptor) => {
      return registeredInterceptor.interceptor === interceptor;
    });
  }

  private findClientId<Schema extends WebSocketSchema>(client: InternalWebSocketInterceptorClient<Schema>) {
    for (const registeredInterceptor of this.registeredInterceptors.values()) {
      for (const [clientId, interceptorClient] of registeredInterceptor.clients) {
        if (interceptorClient === client) {
          return clientId;
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

    this.clearInterceptorHandlers(options.interceptor);

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
        baseURL: registeredInterceptor.interceptor.baseURLAsString,
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
