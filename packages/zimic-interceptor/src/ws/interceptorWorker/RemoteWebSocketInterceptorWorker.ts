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

import type { AnyWebSocketConnectionHandlerImplementation } from '../connectionHandler/WebSocketConnectionHandlerImplementation';
import NotRunningWebSocketInterceptorError from '../interceptor/errors/NotRunningWebSocketInterceptorError';
import UnknownWebSocketInterceptorPlatformError from '../interceptor/errors/UnknownWebSocketInterceptorPlatformError';
import { WebSocketInterceptorPlatform } from '../interceptor/types/options';
import type { WebSocketInterceptorProtocolConnectionClaim } from '../interceptor/types/protocol';
import {
  createWebSocketInterceptorClient,
  InternalWebSocketInterceptorClient,
} from '../interceptor/WebSocketInterceptorHandle';
import { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';
import type { AnyWebSocketMessageHandlerImplementation } from '../messageHandler/WebSocketMessageHandlerImplementation';
import {
  deserializeWebSocketMessageDataFromTransport,
  serializeWebSocketMessageDataForSocket,
  serializeWebSocketMessageDataForTransport,
} from '../utils/messageData';
import { RemoteWebSocketInterceptorWorkerOptions } from './types/options';
import WebSocketInterceptorWorker, { WebSocketHandlerClearChecks } from './WebSocketInterceptorWorker';

type WebSocketHandlerClearTarget =
  | AnyWebSocketInterceptorImplementation
  | AnyWebSocketMessageHandlerImplementation
  | AnyWebSocketConnectionHandlerImplementation;

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
  private numberOfAcknowledgedResets = 0;
  // The number of resets sent when each interceptor or handler was last cleared.
  private numberOfResetsWhenCleared = new WeakMap<WebSocketHandlerClearTarget, number>();
  // The acknowledged resets when the server sent the claimed frame being handled, if any.
  private numberOfResetsBeforeClaimedFrame?: number;
  private sendQueue = Promise.resolve();
  private auth?: RemoteWebSocketInterceptorWorkerOptions['auth'];

  webSocketClient: WebSocketClient<InterceptorServerWebSocketSchema>;

  constructor(options: RemoteWebSocketInterceptorWorkerOptions) {
    super();

    this.webSocketClient = new WebSocketClient({
      url: options.serverURL.toString(),
      onUnexpectedClose: () => {
        this.releaseClaimedConnections();
        logUnexpectedServerDisconnection(options.serverURL);
      },
    });

    this.auth = options.auth;
  }

  async start() {
    await super.sharedStart(async () => {
      // The server counts resets per worker socket, so a new socket starts the count again.
      this.numberOfResets = 0;
      this.numberOfAcknowledgedResets = 0;
      this.numberOfResetsWhenCleared = new WeakMap();

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
      this.webSocketClient.onChannel('reply', 'interceptors/ws/workers/reset', this.acknowledgeReset);

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
      this.webSocketClient.offChannel('reply', 'interceptors/ws/workers/reset', this.acknowledgeReset);

      // Queued sends and closes need the worker socket, so they finish before it stops.
      await this.sendQueue;

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

  private async sendToClient<Schema extends WebSocketSchema>(
    client: InternalWebSocketInterceptorClient<Schema>,
    data: WebSocketMessageData<WebSocketSchemaMessage<Schema>>,
  ) {
    const clientId = this.findClientId(client);

    if (clientId) {
      await this.enqueueSend(clientId, data);
    }
  }

  private async closeClient<Schema extends WebSocketSchema>(
    client: InternalWebSocketInterceptorClient<Schema>,
    code?: number,
    reason?: string,
  ) {
    const clientId = this.findClientId(client);

    if (clientId) {
      await this.disconnectClient(clientId, code, reason);
    }
  }

  // Queued after earlier sends, so the client receives them before the connection closes, as in local mode.
  private disconnectClient(clientId: string, code?: number, reason?: string) {
    return this.enqueueServerEvent(() => {
      this.webSocketClient.send('interceptors/ws/clients/disconnect', { clientId, code, reason });
    });
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

  private routeClientToHolders(clientId: string, url: string, holders: RegisteredWebSocketInterceptor[]) {
    // Protocols may close a connection while handling its close, when the server no longer has it.
    let isClosed = false;

    const routing = this.routeConnectionToHolders(
      {
        url,
        send: (frame) => {
          void this.enqueueSend(clientId, frame);
        },
        close: (code, reason) => {
          if (!isClosed) {
            void this.disconnectClient(clientId, code, reason);
          }
        },
      },
      holders,
    );

    if (routing.claim) {
      this.claimedConnections.set(clientId, {
        onFrame: routing.claim.onFrame,
        onClose: () => {
          isClosed = true;
          routing.claim.onClose();
        },
      });
    }

    return routing;
  }

  // The server no longer reports the close of claimed connections once the worker disconnects.
  private releaseClaimedConnections() {
    for (const claim of this.claimedConnections.values()) {
      claim.onClose();
    }

    this.claimedConnections.clear();
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

    const routing = this.routeClientToHolders(connection.clientId, connection.url, holderCandidates);

    if (routing.claim) {
      return { action: 'claim' };
    }

    const holderInterceptors = routing.holders;

    this.decidingClientIds.add(connection.clientId);

    const handling = await this.handleConnectionWithHandlers(
      { url: connection.url, protocols: connection.protocols },
      (interceptor) => {
        return holderInterceptors.some((registeredInterceptor) => {
          return registeredInterceptor.interceptor === interceptor && isHolding(registeredInterceptor);
        });
      },
      { wasClearedAfterConnection: this.createHandlerClearCheck(connection.numberOfResets) },
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

    for (const registeredInterceptor of holderInterceptors) {
      if (!isHolding(registeredInterceptor)) {
        continue;
      }

      const client = createWebSocketInterceptorClient({
        url: connection.url,
        protocols: connection.protocols,
        // Serialize now so errors throw from send, as in local mode.
        send: (data) => this.sendToClient(client, serializeWebSocketMessageDataForSocket<WebSocketMessageSchema>(data)),
        close: async (code, reason) => {
          await this.closeClient(client, code, reason);
        },
      });

      // The registry is intentionally schema-erased because one remote worker registers interceptors for any schema.
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

  // The server replies to resets in the order it reads them, right after reading each one, so the replies received when
  // a message arrives count at most the resets the server read before sending it. A message sent between a reset and
  // its reply counts as sent before that reset. Replies are counted as their frames are read, because a message frame
  // read in the same chunk is handled before a reply promise settles.
  private acknowledgeReset = () => {
    this.numberOfAcknowledgedResets++;
  };

  private handleMessage = async ({
    data: message,
  }: WebSocketEventMessage<InterceptorServerWebSocketSchema, 'interceptors/ws/messages/handle'>) => {
    // Clears do not wait for the server, so a message sent right after a clear can reach the server before the reset
    // does and be handled as sent before the clear. No synchronous clear can tell these messages apart.
    const numberOfResetsBeforeMessage = this.numberOfAcknowledgedResets;

    const claim = this.claimedConnections.get(message.clientId);

    if (claim) {
      // Messages and clients a protocol opens while it handles the frame are checked against it. Those it opens later,
      // such as from an asynchronous parser, are not checked.
      this.numberOfResetsBeforeClaimedFrame = numberOfResetsBeforeMessage;

      try {
        claim.onFrame(deserializeWebSocketMessageDataFromTransport(message.data));
      } finally {
        this.numberOfResetsBeforeClaimedFrame = undefined;
      }

      return;
    }

    // Holders removed or cleared after the server sent the message no longer hold the connection.
    const holders = message.interceptorIds.flatMap((interceptorId) => {
      const registeredInterceptor = this.registeredInterceptors.get(interceptorId);
      const client = registeredInterceptor?.clients.get(message.clientId);
      return registeredInterceptor && client ? [{ interceptor: registeredInterceptor.interceptor, client }] : [];
    });

    const deserializedMessageData = deserializeWebSocketMessageDataFromTransport(message.data);

    await this.handleRawMessageWithHandlers(deserializedMessageData, holders, {
      wasClearedAfterMessage: this.createHandlerClearCheck(numberOfResetsBeforeMessage),
    });
  };

  private createHandlerClearCheck(numberOfResetsBeforeSent: number) {
    return (handler: {
      interceptor: AnyWebSocketInterceptorImplementation;
      implementation: WebSocketHandlerClearTarget;
    }) => {
      const numberOfResetsWhenCleared = Math.max(
        this.numberOfResetsWhenCleared.get(handler.interceptor) ?? 0,
        this.numberOfResetsWhenCleared.get(handler.implementation) ?? 0,
      );
      return numberOfResetsWhenCleared > numberOfResetsBeforeSent;
    };
  }

  // Polling requests reach the server through another worker connection, so their order relative to the resets of this
  // one is unknown and messages and clients opened from them are not checked.
  protected getProtocolFrameClearChecks(): WebSocketHandlerClearChecks {
    if (this.numberOfResetsBeforeClaimedFrame === undefined) {
      return {};
    }

    const wasClearedAfterFrame = this.createHandlerClearCheck(this.numberOfResetsBeforeClaimedFrame);
    return { wasClearedAfterMessage: wasClearedAfterFrame, wasClearedAfterConnection: wasClearedAfterFrame };
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
        this.releaseClient(registeredInterceptor.interceptor, client);
      }

      if (options.preserveInterceptorRegistration) {
        registeredInterceptor.clients.clear();
        clearedInterceptors.push(registeredInterceptor);
      } else {
        this.registeredInterceptors.delete(registeredInterceptor.id);
      }
    }

    // Clears do not wait for the server. Stops do, so the server no longer routes connections to stopped interceptors.
    if (options.preserveInterceptorRegistration) {
      this.resetServerWorkerInBackground(clearedInterceptors);

      // Connections sent before the clear keep their holders from accepting them, but protocols open clients from frames
      // of connections they already claimed, so those frames are checked against the clear.
      for (const { interceptor } of clearedInterceptors) {
        this.numberOfResetsWhenCleared.set(interceptor, this.numberOfResets);
      }
    } else {
      await this.resetServerWorker(clearedInterceptors);
    }
  }

  markHandlerAsCleared(
    handler: AnyWebSocketMessageHandlerImplementation | AnyWebSocketConnectionHandlerImplementation,
  ) {
    this.resetServerWorkerInBackground([]);
    this.numberOfResetsWhenCleared.set(handler, this.numberOfResets);
  }

  private resetServerWorkerInBackground(clearedInterceptors: RegisteredWebSocketInterceptor[]) {
    this.resetServerWorker(clearedInterceptors).catch(
      /* istanbul ignore next -- @preserve
       * Clears return nothing to reject, so failures other than aborts are logged. They happen only if the server stops
       * replying, which tests do not simulate. */
      (error: unknown) => {
        console.error(error);
      },
    );
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
