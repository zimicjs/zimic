import { PossiblePromise } from '@zimic/utils/types';
import { excludeNonPathParams, validateURLProtocol } from '@zimic/utils/url';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { removeArrayElement } from '@/utils/arrays';
import { isServerSide } from '@/utils/environment';
import { logUnhandledMessageWarning } from '@/utils/logging';

import WebSocketInterceptorWorker from '../interceptorWorker/WebSocketInterceptorWorker';
import LocalWebSocketMessageHandler from '../messageHandler/LocalWebSocketMessageHandler';
import RemoteWebSocketMessageHandler from '../messageHandler/RemoteWebSocketMessageHandler';
import { InternalWebSocketMessageHandler, WebSocketMessageHandler } from '../messageHandler/types/public';
import {
  AnyWebSocketMessageHandlerImplementation,
  WebSocketMessageHandlerApplyContext,
} from '../messageHandler/WebSocketMessageHandlerImplementation';
import { normalizeWebSocketMessageData } from '../utils/messageData';
import NotRunningWebSocketInterceptorError from './errors/NotRunningWebSocketInterceptorError';
import RunningWebSocketInterceptorError from './errors/RunningWebSocketInterceptorError';
import type {
  ReceivedWebSocketMessageData,
  WebSocketInterceptorClient,
  WebSocketInterceptorServerSendOptions,
} from './types/messages';
import type { UnhandledMessageStrategy } from './types/options';
import type { WebSocketInterceptorConnectionListener, WebSocketInterceptorMessageSaving } from './types/public';
import {
  createWebSocketInterceptorServer,
  InternalWebSocketInterceptorClient,
  InternalWebSocketInterceptorServer,
} from './WebSocketInterceptorHandle';
import WebSocketInterceptorMessageStore from './WebSocketInterceptorMessageStore';

export const SUPPORTED_BASE_URL_PROTOCOLS = Object.freeze(['ws', 'wss']);
export const DEFAULT_MESSAGE_SAVING_SAFE_LIMIT = 1000;

const DEFAULT_UNHANDLED_MESSAGE_STRATEGY = Object.freeze({
  log: true,
}) satisfies UnhandledMessageStrategy.Declaration;

function isWebSocketInterceptorClientArray<Schema extends WebSocketSchema>(
  clients: WebSocketInterceptorServerSendOptions<Schema>['to'],
): clients is readonly WebSocketInterceptorClient<Schema>[] {
  return Array.isArray(clients);
}

export type WebSocketHandlerConstructor = typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;

class WebSocketInterceptorImplementation<
  Schema extends WebSocketSchema,
  HandlerConstructor extends WebSocketHandlerConstructor = WebSocketHandlerConstructor,
> {
  #baseURL!: URL;

  messageSaving: WebSocketInterceptorMessageSaving;
  readonly messageStore: WebSocketInterceptorMessageStore<Schema>;

  onUnhandledMessage?: UnhandledMessageStrategy;

  isRunning = false;

  private Handler: HandlerConstructor;

  private handlers: AnyWebSocketMessageHandlerImplementation[] = [];

  private _server: InternalWebSocketInterceptorServer<Schema>;
  private _clients: InternalWebSocketInterceptorClient<Schema>[] = [];
  private connectionListeners: {
    listener: WebSocketInterceptorConnectionListener<Schema>;
    once: boolean;
  }[] = [];

  private createWorker: () => WebSocketInterceptorWorker;
  private deleteWorker: () => void;
  private worker?: WebSocketInterceptorWorker;
  private startPromise?: Promise<void>;
  private numberOfPendingStarts = 0;
  private numberOfPendingStops = 0;
  private lifecycleQueue: Promise<void> = Promise.resolve();
  private messageSavingGeneration = {};

  constructor(options: {
    baseURL: URL;
    messageSaving?: Partial<WebSocketInterceptorMessageSaving>;
    onUnhandledMessage?: UnhandledMessageStrategy;
    Handler: HandlerConstructor;
    createWorker: () => WebSocketInterceptorWorker;
    deleteWorker: () => void;
  }) {
    this.baseURL = options.baseURL;

    this.messageSaving = {
      enabled: options.messageSaving?.enabled ?? this.getDefaultMessageSavingEnabled(),
      safeLimit: options.messageSaving?.safeLimit ?? DEFAULT_MESSAGE_SAVING_SAFE_LIMIT,
    };
    this.messageStore = new WebSocketInterceptorMessageStore(() => this.messageSaving.safeLimit);

    this.onUnhandledMessage = options.onUnhandledMessage;

    this.Handler = options.Handler;
    this.createWorker = options.createWorker;
    this.deleteWorker = options.deleteWorker;
    this._server = createWebSocketInterceptorServer(
      () => this.baseURLAsString,
      (data, options) => {
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

  private getDefaultMessageSavingEnabled(): boolean {
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

      this.isRunning = true;
    } catch (error) {
      await this.stopWorker();
      throw error;
    }
  }

  // Handlers declared while stopping would survive the clear before the interceptor unregisters, so declarations are
  // rejected from the moment stop is called until it completes.
  get isStopping() {
    return this.numberOfPendingStops > 0;
  }

  async stop(options: { beforeStop?: () => PossiblePromise<void> }) {
    this.startPromise = undefined;
    this.numberOfPendingStops++;

    await this.enqueueLifecycleOperation(async () => {
      try {
        await this.stopOnce(options);
      } finally {
        this.numberOfPendingStops--;
      }
    });
  }

  private async stopOnce(options: { beforeStop?: () => PossiblePromise<void> }) {
    if (!this.isRunning) {
      return;
    }

    await options.beforeStop?.();

    // Clearing keeps the interceptor registered to accept new connections, so stopping has to remove the registration.
    await this.workerOrThrow.clearHandlers({ interceptor: this });

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

  on(_event: 'connection', listener: WebSocketInterceptorConnectionListener<Schema>) {
    this.connectionListeners.push({ listener, once: false });
  }

  off(_event: 'connection', listener: WebSocketInterceptorConnectionListener<Schema>) {
    this.connectionListeners = this.connectionListeners.filter((entry) => entry.listener !== listener);
  }

  once(_event: 'connection', listener: WebSocketInterceptorConnectionListener<Schema>) {
    this.connectionListeners.push({ listener, once: true });
  }

  message() {
    return this.createWebSocketMessageHandler();
  }

  private createWebSocketMessageHandler(): WebSocketMessageHandler<Schema> {
    const handler = new this.Handler<Schema>(this);
    this.registerMessageHandler(handler);

    return handler;
  }

  registerMessageHandler<RestrictedSchema extends Schema>(
    handler: InternalWebSocketMessageHandler<Schema, RestrictedSchema>,
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

  async handleMatchedMessage(
    handler: AnyWebSocketMessageHandlerImplementation,
    message: ReceivedWebSocketMessageData<WebSocketSchema>,
    context: WebSocketMessageHandlerApplyContext<Schema>,
  ) {
    const messageSavingGeneration = this.messageSavingGeneration;

    const wasHandled = await handler.applyDeclarations(message, context);

    if (!wasHandled) {
      return false;
    }

    if (this.messageSaving.enabled && messageSavingGeneration === this.messageSavingGeneration) {
      handler.saveInterceptedMessage(message, context);
    }

    return true;
  }

  // Unlike HTTP, unhandled messages have no bypass or reject action. WebSocket is not request-response, so a message
  // needs no reply and the connection stays open.
  async logUnhandledMessageIfNecessary(data: WebSocketMessageData<Schema>, url: string) {
    const message = await normalizeWebSocketMessageData(data);
    const strategy = await this.getUnhandledMessageStrategy(message);

    if (strategy.log ?? DEFAULT_UNHANDLED_MESSAGE_STRATEGY.log) {
      await logUnhandledMessageWarning(message, url);
    }
  }

  private async getUnhandledMessageStrategy(
    message: ReceivedWebSocketMessageData<Schema>,
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

    for (const entry of [...this.connectionListeners]) {
      const listenerIndex = this.connectionListeners.indexOf(entry);

      if (listenerIndex < 0) {
        continue;
      }

      if (entry.once) {
        this.connectionListeners.splice(listenerIndex, 1);
      }

      try {
        const { listener } = entry;
        listener(client);
      } catch (error) {
        console.error(error);
      }
    }
  }

  removeClient(client: InternalWebSocketInterceptorClient<Schema>) {
    removeArrayElement(this._clients, client);
  }

  checkTimes() {
    for (const handler of this.handlers) {
      handler.checkTimes();
    }
  }

  clear() {
    const worker = this.workerOrThrow;

    this.messageSavingGeneration = {};

    const clearResult = worker.clearHandlers({ interceptor: this, preserveInterceptorRegistration: true });

    for (const handler of this.handlers) {
      handler.clear();
    }

    this.handlers.length = 0;
    this._clients.length = 0;

    return Promise.resolve(clearResult);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWebSocketInterceptorImplementation<Schema extends WebSocketSchema = any> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  WebSocketInterceptorImplementation<Schema, any>;

export default WebSocketInterceptorImplementation;
