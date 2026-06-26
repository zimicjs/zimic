import { excludeNonPathParams, validateURLProtocol } from '@zimic/utils/url';
import { WebSocketClient, WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { isServerSide } from '@/utils/environment';

import WebSocketInterceptorWorker from '../interceptorWorker/WebSocketInterceptorWorker';
import { LocalWebSocketMessageHandler } from '../messageHandler/LocalWebSocketMessageHandler';
import { RemoteWebSocketMessageHandler } from '../messageHandler/RemoteWebSocketMessageHandler';
import { InternalWebSocketMessageHandler, WebSocketMessageHandler } from '../messageHandler/types/public';
import {
  AnyWebSocketMessageHandlerImplementation,
  WebSocketMessageHandlerApplyContext,
  WebSocketMessageHandlerMessageMatch,
} from '../messageHandler/WebSocketMessageHandlerImplementation';
import MessageSavingSafeLimitExceededError from './errors/MessageSavingSafeLimitExceededError';
import NotRunningWebSocketInterceptorError from './errors/NotRunningWebSocketInterceptorError';
import RunningWebSocketInterceptorError from './errors/RunningWebSocketInterceptorError';
import { InterceptedWebSocketInterceptorMessage, WebSocketInterceptorClient } from './types/messages';
import { WebSocketInterceptorMessageSaving } from './types/options';

export const SUPPORTED_BASE_URL_PROTOCOLS = Object.freeze(['ws', 'wss']);
export const DEFAULT_MESSAGE_SAVING_SAFE_LIMIT = 1000;

export type WebSocketHandlerConstructor = typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;

class WebSocketInterceptorClientImplementation<Schema extends WebSocketSchema>
  extends WebSocketClient<Schema>
  implements WebSocketInterceptorClient<Schema>
{
  messages: InterceptedWebSocketInterceptorMessage<Schema>[] = [];

  constructor(
    url: string,
    private sendMessage?: (data: WebSocketMessageData<Schema>) => void,
  ) {
    super(url);
  }

  send(data: WebSocketMessageData<Schema>) {
    if (this.sendMessage) {
      this.sendMessage(data);
      return;
    }

    /* istanbul ignore next -- @preserve
     * Interceptor-created clients always provide a transport send callback. */
    super.send(data);
  }
}

class WebSocketInterceptorImplementation<
  Schema extends WebSocketSchema,
  HandlerConstructor extends WebSocketHandlerConstructor = WebSocketHandlerConstructor,
> {
  private _baseURL!: URL;

  messageSaving: WebSocketInterceptorMessageSaving;
  private _numberOfSavedMessages = 0;

  isRunning = false;

  private Handler: HandlerConstructor;

  private handlers: AnyWebSocketMessageHandlerImplementation[] = [];

  private _server: WebSocketInterceptorClient<Schema>;
  private _clients: WebSocketInterceptorClient<Schema>[] = [];
  private worker?: WebSocketInterceptorWorker;

  constructor(options: {
    baseURL: URL;
    messageSaving?: Partial<WebSocketInterceptorMessageSaving>;
    Handler: HandlerConstructor;
    worker?: WebSocketInterceptorWorker;
  }) {
    this.baseURL = options.baseURL;

    this.messageSaving = {
      enabled: options.messageSaving?.enabled ?? this.getDefaultMessageSavingEnabled(),
      safeLimit: options.messageSaving?.safeLimit ?? DEFAULT_MESSAGE_SAVING_SAFE_LIMIT,
    };

    this.Handler = options.Handler;
    this.worker = options.worker;
    this._server = this.createClient(this.baseURLAsString, {
      send: (data) => {
        void this.worker?.sendToClients(this, data);
      },
    });
  }

  private getDefaultMessageSavingEnabled(): boolean {
    return isServerSide() ? process.env.NODE_ENV === 'test' : false;
  }

  get baseURL() {
    return this._baseURL;
  }

  set baseURL(newBaseURL: URL) {
    if (this.isRunning) {
      throw new RunningWebSocketInterceptorError(
        'Did you forget to call `await interceptor.stop()` before changing the base URL?',
      );
    }

    validateURLProtocol(newBaseURL, SUPPORTED_BASE_URL_PROTOCOLS);
    excludeNonPathParams(newBaseURL);

    this._baseURL = newBaseURL;
  }

  get baseURLAsString() {
    if (this.baseURL.href === `${this.baseURL.origin}/`) {
      return this.baseURL.origin;
    }
    return this.baseURL.href;
  }

  get platform() {
    return this.isRunning ? (isServerSide() ? 'node' : 'browser') : null;
  }

  async start() {
    /* istanbul ignore if -- @preserve
     * Public interceptor wrappers guard this before delegating to the implementation. */
    if (this.isRunning) {
      return;
    }

    try {
      this.isRunning = true;

      await this.worker?.start();
      if (this.worker?.type === 'local') {
        await this.worker.use(this);
      }
      this.worker?.registerRunningInterceptor(this);
      /* istanbul ignore next -- @preserve
       * Startup rollback is covered by worker-level startup failure parity. */
    } catch (error) {
      /* istanbul ignore next -- @preserve */
      this.isRunning = false;
      /* istanbul ignore next -- @preserve */
      await this.worker?.stop();
      /* istanbul ignore next -- @preserve */
      throw error;
    }
  }

  async stop() {
    /* istanbul ignore if -- @preserve
     * Public interceptor wrappers guard this before delegating to the implementation. */
    if (!this.isRunning) {
      return;
    }

    this.worker?.unregisterRunningInterceptor(this);
    await this.worker?.clearHandlers({ interceptor: this });
    await this.worker?.stop();
    this.isRunning = false;
  }

  /* istanbul ignore next -- @preserve
   * This is an internal compatibility getter for worker parity with HTTP interceptors. */
  get numberOfRunningInterceptors() {
    return this.isRunning ? 1 : 0;
  }

  get server() {
    return this._server;
  }

  get clients() {
    return this._clients;
  }

  message() {
    return this.createWebSocketMessageHandler();
  }

  private createWebSocketMessageHandler(): WebSocketMessageHandler<Schema> {
    if (!this.isRunning) {
      throw new NotRunningWebSocketInterceptorError();
    }

    const handler = new this.Handler<Schema>(this);
    this.registerMessageHandler(handler);

    return handler;
  }

  registerMessageHandler<RestrictedSchema extends Schema>(
    handler: InternalWebSocketMessageHandler<Schema, RestrictedSchema>,
  ) {
    const isAlreadyRegistered = this.handlers.includes(handler.implementation);

    if (!isAlreadyRegistered) {
      this.handlers.push(handler.implementation);

      const registrationResult = this.worker?.type === 'remote' ? this.worker.use(this) : undefined;

      if (handler instanceof RemoteWebSocketMessageHandler && registrationResult instanceof Promise) {
        handler.registerSyncPromise(registrationResult);
      }
    }
  }

  async handleInterceptedMessage(
    data: WebSocketMessageData<Schema>,
    context?: Partial<WebSocketMessageHandlerApplyContext<Schema>>,
  ) {
    /* istanbul ignore if -- @preserve
     * Workers only forward messages while the owning interceptor is running. */
    if (!this.isRunning) {
      return false;
    }

    const message = data as Schema;
    const completeContext = this.completeMessageContext(context);
    const matchedHandler = await this.findMatchedHandler(message, completeContext);

    if (!matchedHandler) {
      return false;
    }

    await matchedHandler.handler.applyDeclarations(matchedHandler.message, completeContext);

    if (this.messageSaving.enabled) {
      matchedHandler.handler.saveInterceptedMessage(matchedHandler.message, completeContext);
    }

    return true;
  }

  private completeMessageContext(context?: Partial<WebSocketMessageHandlerApplyContext<Schema>>) {
    const sender = context?.sender ?? this.createClient(this.baseURLAsString);

    this.addClient(sender);

    return {
      sender,
      receiver: context?.receiver ?? this._server,
    };
  }

  createClient(
    url: string,
    options: { send?: (data: WebSocketMessageData<Schema>) => void } = {},
  ): WebSocketInterceptorClient<Schema> {
    return new WebSocketInterceptorClientImplementation<Schema>(url, options.send);
  }

  addClient(client: WebSocketInterceptorClient<Schema>) {
    if (!this._clients.includes(client)) {
      this._clients.push(client);
    }
  }

  removeClient(client: WebSocketInterceptorClient<Schema>) {
    const clientIndex = this._clients.indexOf(client);

    if (clientIndex >= 0) {
      this._clients.splice(clientIndex, 1);
    }
  }

  private async findMatchedHandler(message: Schema, context: WebSocketMessageHandlerApplyContext<Schema>) {
    const failedMessageMatches = new Map<
      AnyWebSocketMessageHandlerImplementation,
      Extract<WebSocketMessageHandlerMessageMatch, { success: false }>
    >();

    // If we find a matching handler that can accept more messages, we return it immediately.
    for (let handlerIndex = this.handlers.length - 1; handlerIndex >= 0; handlerIndex--) {
      const handler = this.handlers[handlerIndex];
      const messageMatch = await handler.matchesMessage(message, context);

      if (messageMatch.success) {
        handler.markMessageAsMatched(messageMatch.message);
        return { handler, message: messageMatch.message as Schema };
      }

      failedMessageMatches.set(handler, messageMatch);
    }

    // If no handler matched or could accept more messages, we iterate again over the handlers to check which ones
    // could have matched considering only restrictions.
    for (let handlerIndex = this.handlers.length - 1; handlerIndex >= 0; handlerIndex--) {
      const handler = this.handlers[handlerIndex];
      const messageMatch = failedMessageMatches.get(handler);

      // Handlers that did not match due to anything other than restrictions are still marked as matched to trigger a
      // times check error.
      if (messageMatch?.cause === 'unmatchedRestrictions') {
        handler.markMessageAsUnmatched(message, { diff: messageMatch.diff });
      } else {
        handler.markMessageAsMatched(message);
        break;
      }
    }

    return undefined;
  }

  incrementNumberOfSavedMessages(increment: number) {
    this._numberOfSavedMessages = Math.max(this._numberOfSavedMessages + increment, 0);

    const exceedsSafeLimit = this._numberOfSavedMessages > this.messageSaving.safeLimit;

    if (increment > 0 && exceedsSafeLimit) {
      const error = new MessageSavingSafeLimitExceededError(this._numberOfSavedMessages, this.messageSaving.safeLimit);
      console.warn(error);
    }
  }

  checkTimes() {
    for (const handler of this.handlers) {
      handler.checkTimes();
    }
  }

  clear() {
    const clearResult =
      this.worker?.type === 'remote' && this.worker.isRunning
        ? this.worker.clearHandlers({ interceptor: this })
        : undefined;

    for (const handler of this.handlers) {
      handler.clear();
    }

    this.handlers.length = 0;
    this._clients.length = 0;
    this._server.messages.length = 0;
    this._numberOfSavedMessages = 0;

    return Promise.resolve(clearResult);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWebSocketInterceptorImplementation<Schema extends WebSocketSchema = any> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  WebSocketInterceptorImplementation<Schema, any>;

export default WebSocketInterceptorImplementation;
