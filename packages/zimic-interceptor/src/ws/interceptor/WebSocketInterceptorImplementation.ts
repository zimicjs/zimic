import { excludeNonPathParams, validateURLProtocol } from '@zimic/utils/url';
import { WebSocketMessageData, WebSocketMessageSchema, WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';

import { removeArrayElement } from '@/utils/arrays';
import { isServerSide } from '@/utils/environment';
import { logUnhandledMessageWarning } from '@/utils/logging';

import LocalWebSocketConnectionHandler from '../connectionHandler/LocalWebSocketConnectionHandler';
import RemoteWebSocketConnectionHandler from '../connectionHandler/RemoteWebSocketConnectionHandler';
import { InternalWebSocketConnectionHandler, WebSocketConnectionHandler } from '../connectionHandler/types/public';
import { AnyWebSocketConnectionHandlerImplementation } from '../connectionHandler/WebSocketConnectionHandlerImplementation';
import WebSocketInterceptorWorker from '../interceptorWorker/WebSocketInterceptorWorker';
import LocalWebSocketMessageHandler from '../messageHandler/LocalWebSocketMessageHandler';
import RemoteWebSocketMessageHandler from '../messageHandler/RemoteWebSocketMessageHandler';
import { InternalWebSocketMessageHandler, WebSocketMessageHandler } from '../messageHandler/types/public';
import {
  AnyWebSocketMessageHandlerImplementation,
  WebSocketMessageHandlerApplyContext,
} from '../messageHandler/WebSocketMessageHandlerImplementation';
import { normalizeWebSocketMessageData } from '../utils/messageData';
import ConnectionSavingSafeLimitExceededError from './errors/ConnectionSavingSafeLimitExceededError';
import NotRunningWebSocketInterceptorError from './errors/NotRunningWebSocketInterceptorError';
import RunningWebSocketInterceptorError from './errors/RunningWebSocketInterceptorError';
import type {
  ReceivedWebSocketMessageData,
  WebSocketInterceptorClient,
  WebSocketInterceptorConnectionRequest,
  WebSocketInterceptorServerSendOptions,
} from './types/messages';
import type { UnhandledMessageStrategy, WebSocketInterceptorType } from './types/options';
import {
  isInternalWebSocketInterceptorProtocol,
  WebSocketInterceptorProtocol,
  WebSocketInterceptorProtocolClient,
  WebSocketInterceptorProtocolHost,
  WebSocketInterceptorProtocolRawConnection,
} from './types/protocol';
import type { WebSocketInterceptorConnectionSaving, WebSocketInterceptorMessageSaving } from './types/public';
import type { WebSocketInterceptorPathMessage } from './types/schema';
import {
  createWebSocketInterceptorServer,
  InternalWebSocketInterceptorClient,
  InternalWebSocketInterceptorServer,
} from './WebSocketInterceptorHandle';
import WebSocketInterceptorMessageStore from './WebSocketInterceptorMessageStore';

export const SUPPORTED_BASE_URL_PROTOCOLS = Object.freeze(['ws', 'wss']);
export const DEFAULT_MESSAGE_SAVING_SAFE_LIMIT = 1000;
export const DEFAULT_CONNECTION_SAVING_SAFE_LIMIT = DEFAULT_MESSAGE_SAVING_SAFE_LIMIT;

const DEFAULT_UNHANDLED_MESSAGE_STRATEGY = Object.freeze({
  log: true,
}) satisfies UnhandledMessageStrategy.Declaration;

function isWebSocketInterceptorClientArray<Schema extends WebSocketSchema>(
  clients: WebSocketInterceptorServerSendOptions<Schema>['to'],
): clients is readonly WebSocketInterceptorClient<Schema>[] {
  return Array.isArray(clients);
}

export type WebSocketMessageHandlerConstructor =
  typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;

export type WebSocketConnectionHandlerConstructor =
  typeof LocalWebSocketConnectionHandler | typeof RemoteWebSocketConnectionHandler;

class WebSocketInterceptorImplementation<
  Schema extends WebSocketSchema,
  MessageHandlerConstructor extends WebSocketMessageHandlerConstructor = WebSocketMessageHandlerConstructor,
> {
  #baseURL!: URL;

  messageSaving: WebSocketInterceptorMessageSaving;
  readonly messageStore: WebSocketInterceptorMessageStore<Schema>;

  connectionSaving: WebSocketInterceptorConnectionSaving;
  private numberOfSavedConnections = 0;

  onUnhandledMessage?: UnhandledMessageStrategy;

  isRunning = false;

  private MessageHandler: MessageHandlerConstructor;
  private ConnectionHandler: WebSocketConnectionHandlerConstructor;

  // Kept in registration order, so times checks run in the order the handlers were declared.
  private handlers: (AnyWebSocketMessageHandlerImplementation | AnyWebSocketConnectionHandlerImplementation)[] = [];

  private _server: InternalWebSocketInterceptorServer<Schema>;
  private _clients: InternalWebSocketInterceptorClient<Schema>[] = [];

  readonly protocol: WebSocketInterceptorProtocol | undefined;
  private protocolHost: WebSocketInterceptorProtocolHost;
  private protocolDisconnectListeners = new Map<InternalWebSocketInterceptorClient<Schema>, () => void>();

  private createWorker: () => WebSocketInterceptorWorker;
  private deleteWorker: () => void;
  private worker?: WebSocketInterceptorWorker;
  private startPromise?: Promise<void>;
  private numberOfPendingStarts = 0;
  private numberOfPendingStops = 0;
  private lifecycleQueue: Promise<void> = Promise.resolve();
  private messageSavingGeneration = {};
  private connectionSavingGeneration = {};

  constructor(options: {
    baseURL: URL;
    messageSaving?: Partial<WebSocketInterceptorMessageSaving>;
    connectionSaving?: Partial<WebSocketInterceptorConnectionSaving>;
    onUnhandledMessage?: UnhandledMessageStrategy;
    protocol: WebSocketInterceptorProtocol | undefined;
    type: WebSocketInterceptorType;
    getAuth: (() => WebSocketInterceptorProtocolHost['auth']) | undefined;
    MessageHandler: MessageHandlerConstructor;
    ConnectionHandler: WebSocketConnectionHandlerConstructor;
    createWorker: () => WebSocketInterceptorWorker;
    deleteWorker: () => void;
  }) {
    this.baseURL = options.baseURL;

    this.messageSaving = {
      enabled: options.messageSaving?.enabled ?? this.getDefaultSavingEnabled(),
      safeLimit: options.messageSaving?.safeLimit ?? DEFAULT_MESSAGE_SAVING_SAFE_LIMIT,
    };
    this.messageStore = new WebSocketInterceptorMessageStore(() => this.messageSaving.safeLimit);

    this.connectionSaving = {
      enabled: options.connectionSaving?.enabled ?? this.getDefaultSavingEnabled(),
      safeLimit: options.connectionSaving?.safeLimit ?? DEFAULT_CONNECTION_SAVING_SAFE_LIMIT,
    };

    this.onUnhandledMessage = options.onUnhandledMessage;

    this.protocol = options.protocol;
    this.protocolHost = this.createProtocolHost(options.type, options.getAuth);

    this.MessageHandler = options.MessageHandler;
    this.ConnectionHandler = options.ConnectionHandler;
    this.createWorker = options.createWorker;
    this.deleteWorker = options.deleteWorker;
    this._server = createWebSocketInterceptorServer(
      () => this.baseURLAsString,
      (data, options) => {
        // Each client encodes the message, because frames may depend on the client, as with its protocol state.
        if (this.protocol) {
          const recipients = options?.to === undefined ? this._clients : [options.to].flat();

          for (const client of this._clients.filter((client) => recipients.includes(client))) {
            client.send(data);
          }
          return;
        }

        if (options?.to === undefined) {
          void this.worker?.sendToClients(this, data);
          return;
        }

        const clients = isWebSocketInterceptorClientArray(options.to) ? options.to : [options.to];

        for (const client of this._clients) {
          if (clients.includes(client)) {
            void this.worker?.sendToClient(client, data);
          }
        }
      },
    );
  }

  private createProtocolHost(
    type: WebSocketInterceptorType,
    getAuth: (() => WebSocketInterceptorProtocolHost['auth']) | undefined,
  ): WebSocketInterceptorProtocolHost {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const interceptor = this;

    return {
      type,

      get baseURL() {
        return interceptor.baseURLAsString;
      },

      get auth() {
        return getAuth?.();
      },

      openClient: (options) => this.workerOrThrow.openProtocolClient(this, options),
      // Protocols receive the clients created by the workers, which are schema-erased when created.
      removeClient: (client) => this.removeClient(client as unknown as InternalWebSocketInterceptorClient<Schema>),

      handleFrame: (client, frame) => {
        void this.worker?.handleFrameWithHandlers(frame, [
          {
            interceptor: this as unknown as WebSocketInterceptorImplementation<WebSocketSchema>,
            client: client as InternalWebSocketInterceptorClient,
          },
        ]);
      },
    };
  }

  private get internalProtocol() {
    return isInternalWebSocketInterceptorProtocol(this.protocol) ? this.protocol : undefined;
  }

  claimProtocolConnection(url: string, connection: WebSocketInterceptorProtocolRawConnection) {
    return this.internalProtocol?.claimConnection(url, connection);
  }

  private getDefaultSavingEnabled(): boolean {
    return isServerSide() ? process.env.NODE_ENV === 'test' : false;
  }

  get baseURL() {
    return this.#baseURL;
  }

  set baseURL(newBaseURL: URL) {
    if (this.isRunning || this.isStarting) {
      throw new RunningWebSocketInterceptorError(
        'Did you forget to call `await interceptor.stop()` before changing the base URL?',
      );
    }

    validateURLProtocol(newBaseURL, SUPPORTED_BASE_URL_PROTOCOLS);
    excludeNonPathParams(newBaseURL);

    this.#baseURL = newBaseURL;
  }

  get baseURLAsString() {
    if (this.baseURL.href === `${this.baseURL.origin}/`) {
      return this.baseURL.origin;
    }
    return this.baseURL.href;
  }

  private get workerOrThrow() {
    if (!this.worker) {
      throw new NotRunningWebSocketInterceptorError();
    }
    return this.worker;
  }

  get platform() {
    return this.worker?.platform ?? null;
  }

  start() {
    if (this.startPromise) {
      return this.startPromise;
    }

    this.numberOfPendingStarts++;

    const startPromise = this.enqueueLifecycleOperation(() => this.startOnce()).finally(() => {
      this.numberOfPendingStarts--;

      const isLastStartPromise = this.startPromise === startPromise;

      if (isLastStartPromise) {
        this.startPromise = undefined;
      }
    });

    this.startPromise = startPromise;

    return startPromise;
  }

  private async startOnce() {
    if (this.isRunning) {
      return;
    }

    try {
      this.worker = this.createWorker();
      this.worker.registerRunningInterceptor(this);

      await this.worker.start();
      await this.worker.use(this);
      await this.internalProtocol?.start(this.protocolHost);

      this.isRunning = true;
    } catch (error) {
      await this.internalProtocol?.stop(this.protocolHost);
      await this.stopWorker();
      throw error;
    }
  }

  // Handlers declared while stopping would survive the clear before the interceptor unregisters, so declarations are
  // rejected from the moment stop is called until it completes.
  get isStopping() {
    return this.numberOfPendingStops > 0;
  }

  async stop() {
    this.startPromise = undefined;
    this.numberOfPendingStops++;

    await this.enqueueLifecycleOperation(async () => {
      try {
        await this.stopOnce();
      } finally {
        this.numberOfPendingStops--;
      }
    });
  }

  private async stopOnce() {
    if (!this.isRunning) {
      return;
    }

    await this.internalProtocol?.stop(this.protocolHost);

    // Clearing and unregistering in one worker call sends a single reset to a remote server, so no connection opened
    // during the stop reaches an interceptor that is cleared but still registered.
    await this.clearAndOptionallyUnregister({ preserveInterceptorRegistration: false });

    await this.stopWorker();
  }

  private async stopWorker() {
    this.worker?.unregisterRunningInterceptor(this);

    const isLastRunningInterceptor = this.worker?.numberOfRunningInterceptors === 0;

    if (isLastRunningInterceptor) {
      await this.worker?.stop();

      // Stopping is asynchronous, so we need to check again if we are still the last before deleting the worker.
      // Another interceptor might have started in the meantime and the worker should not be deleted if so.
      const isStillLastRunningInterceptor = this.worker?.numberOfRunningInterceptors === 0;

      if (isStillLastRunningInterceptor) {
        this.deleteWorker();
      }
    }

    this.isRunning = false;
    this.worker = undefined;
  }

  get isStarting() {
    return this.numberOfPendingStarts > 0;
  }

  private enqueueLifecycleOperation(operation: () => Promise<void>) {
    const operationPromise = this.lifecycleQueue.then(operation);
    this.lifecycleQueue = operationPromise.catch(() => undefined);
    return operationPromise;
  }

  get server() {
    return this._server;
  }

  get clients() {
    return this._clients;
  }

  // As in HTTP, handlers declared with a concrete path are typed with the declared path it belongs to.
  message<Path extends string>(path: string | undefined) {
    return this.createWebSocketMessageHandler<Path>(path as Path | undefined);
  }

  private createWebSocketMessageHandler<Path extends string>(
    path: Path | undefined,
  ): WebSocketMessageHandler<Schema, Path> {
    const handler = new this.MessageHandler<Schema, Path>(this, path);
    this.registerMessageHandler(handler);

    return handler;
  }

  registerMessageHandler<Path extends string, RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path>>(
    handler: InternalWebSocketMessageHandler<Schema, Path, RestrictedMessage>,
  ) {
    if (!this.isRunning || this.isStopping) {
      throw new NotRunningWebSocketInterceptorError();
    }

    const isAlreadyRegistered = this.handlers.includes(handler.implementation);

    if (isAlreadyRegistered) {
      return;
    }

    this.handlers.push(handler.implementation);

    this.workerOrThrow.useMessageHandler(this, handler.implementation);
  }

  // As in HTTP, handlers declared with a concrete path are typed with the declared path it belongs to.
  connection<Path extends string>(path: string | undefined) {
    return this.createWebSocketConnectionHandler<Path>(path as Path | undefined);
  }

  private createWebSocketConnectionHandler<Path extends string>(
    path: Path | undefined,
  ): WebSocketConnectionHandler<Schema, Path> {
    const handler = new this.ConnectionHandler<Schema, Path>(this, path);
    this.registerConnectionHandler(handler);

    return handler;
  }

  registerConnectionHandler<Path extends string>(handler: InternalWebSocketConnectionHandler<Schema, Path>) {
    if (!this.isRunning || this.isStopping) {
      throw new NotRunningWebSocketInterceptorError();
    }

    const isAlreadyRegistered = this.handlers.includes(handler.implementation);

    if (isAlreadyRegistered) {
      return;
    }

    this.handlers.push(handler.implementation);

    this.workerOrThrow.useConnectionHandler(this, handler.implementation);
  }

  async handleMatchedConnection(
    handler: AnyWebSocketConnectionHandlerImplementation,
    request: WebSocketInterceptorConnectionRequest,
  ) {
    const connectionSavingGeneration = this.connectionSavingGeneration;
    const clearGeneration = handler.clearGeneration;

    const action = await handler.applyDeclarations(request);

    // A handler cleared while deciding the connection does not apply its action or save it, even if redeclared.
    if (action === null || clearGeneration !== handler.clearGeneration) {
      return null;
    }

    if (this.connectionSaving.enabled && connectionSavingGeneration === this.connectionSavingGeneration) {
      handler.saveInterceptedConnection(request);
    }

    return action;
  }

  incrementNumberOfSavedConnections(increment: number) {
    this.numberOfSavedConnections += increment;

    const exceedsSafeLimit = this.numberOfSavedConnections > this.connectionSaving.safeLimit;

    if (increment > 0 && exceedsSafeLimit) {
      const error = new ConnectionSavingSafeLimitExceededError(
        this.numberOfSavedConnections,
        this.connectionSaving.safeLimit,
      );
      console.warn(error);
    }
  }

  async handleMatchedMessage(
    handler: AnyWebSocketMessageHandlerImplementation,
    message: ReceivedWebSocketMessageData<WebSocketMessageSchema>,
    context: WebSocketMessageHandlerApplyContext<Schema>,
  ) {
    const messageSavingGeneration = this.messageSavingGeneration;
    const clearGeneration = handler.clearGeneration;

    const declaration = await handler.applyDeclarations(message, context);

    // A handler cleared while computing its response does not send it or save the message, even if redeclared.
    if (declaration === null || clearGeneration !== handler.clearGeneration) {
      return false;
    }

    if (declaration.response !== undefined) {
      handler.sendResponse(declaration.response, context);
    }

    if (this.messageSaving.enabled && messageSavingGeneration === this.messageSavingGeneration) {
      handler.saveInterceptedMessage(message, context);
    }

    return true;
  }

  // Unlike HTTP, unhandled messages have no bypass or reject action. WebSocket is not request-response, so a message
  // needs no reply and the connection stays open.
  async logUnhandledMessageIfNecessary(data: WebSocketMessageData<WebSocketSchemaMessage<Schema>>, url: string) {
    const message = await normalizeWebSocketMessageData(data);
    const strategy = await this.getUnhandledMessageStrategy(message);

    if (strategy.log ?? DEFAULT_UNHANDLED_MESSAGE_STRATEGY.log) {
      await logUnhandledMessageWarning(message, url);
    }
  }

  private async getUnhandledMessageStrategy(
    message: ReceivedWebSocketMessageData<WebSocketSchemaMessage<Schema>>,
  ): Promise<UnhandledMessageStrategy.Declaration> {
    try {
      if (typeof this.onUnhandledMessage === 'function') {
        return await this.onUnhandledMessage(message);
      }

      return this.onUnhandledMessage ?? DEFAULT_UNHANDLED_MESSAGE_STRATEGY;
    } catch (error) {
      console.error(error);
      return DEFAULT_UNHANDLED_MESSAGE_STRATEGY;
    }
  }

  addClient(client: InternalWebSocketInterceptorClient<Schema>) {
    this._clients.push(client);

    try {
      const onDisconnect = this.protocol?.onConnection?.(client as unknown as WebSocketInterceptorProtocolClient);

      if (onDisconnect) {
        this.protocolDisconnectListeners.set(client, onDisconnect);
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Every way a client stops being held ends here: the connection closing, and clearing or stopping the interceptor.
  removeClient(client: InternalWebSocketInterceptorClient<Schema>) {
    removeArrayElement(this._clients, client);

    const onDisconnect = this.protocolDisconnectListeners.get(client);
    this.protocolDisconnectListeners.delete(client);

    try {
      onDisconnect?.();
    } catch (error) {
      console.error(error);
    }
  }

  checkTimes() {
    for (const handler of this.handlers) {
      handler.checkTimes();
    }
  }

  clear() {
    return this.clearAndOptionallyUnregister({ preserveInterceptorRegistration: true });
  }

  private clearAndOptionallyUnregister(options: { preserveInterceptorRegistration: boolean }) {
    const worker = this.workerOrThrow;

    this.messageSavingGeneration = {};
    this.connectionSavingGeneration = {};

    const clearResult = worker.clearHandlers({ interceptor: this, ...options });

    this.internalProtocol?.closeClients();

    for (const handler of this.handlers) {
      handler.clear();
    }

    this.handlers.length = 0;

    return Promise.resolve(clearResult);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWebSocketInterceptorImplementation<Schema extends WebSocketSchema = any> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  WebSocketInterceptorImplementation<Schema, any>;

export default WebSocketInterceptorImplementation;
