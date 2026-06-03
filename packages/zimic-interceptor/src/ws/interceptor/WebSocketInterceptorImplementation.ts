import { excludeNonPathParams, validateURLProtocol } from '@zimic/utils/url';
import { WebSocketClient, WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { isServerSide } from '@/utils/environment';

import { LocalWebSocketMessageHandler } from '../messageHandler/LocalWebSocketMessageHandler';
import { RemoteWebSocketMessageHandler } from '../messageHandler/RemoteWebSocketMessageHandler';
import { InternalWebSocketMessageHandler, WebSocketMessageHandler } from '../messageHandler/types/public';
import {
  AnyWebSocketMessageHandlerImplementation,
  WebSocketMessageHandlerApplyContext,
  WebSocketMessageHandlerMessageMatch,
} from '../messageHandler/WebSocketMessageHandlerImplementation';
import { normalizeWebSocketMessageData } from '../utils/messageData';
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

  send(data: Schema): void;
  send(data: WebSocketMessageData<Schema>): void;
  send(_data: Schema | WebSocketMessageData<Schema>) {
    // TODO: Connect to the WebSocket worker transport.
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

  constructor(options: {
    baseURL: URL;
    messageSaving?: Partial<WebSocketInterceptorMessageSaving>;
    Handler: HandlerConstructor;
  }) {
    this.baseURL = options.baseURL;

    this.messageSaving = {
      enabled: options.messageSaving?.enabled ?? this.getDefaultMessageSavingEnabled(),
      safeLimit: options.messageSaving?.safeLimit ?? DEFAULT_MESSAGE_SAVING_SAFE_LIMIT,
    };

    this.Handler = options.Handler;
    this._server = this.createInMemoryClient(this.baseURLAsString);
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

  start() {
    this.isRunning = true;
    return Promise.resolve();
  }

  stop() {
    this.isRunning = false;
    return Promise.resolve();
  }

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
    }
  }

  async handleInterceptedMessage(
    data: WebSocketMessageData<Schema>,
    context?: Partial<WebSocketMessageHandlerApplyContext<Schema>>,
  ) {
    const message = normalizeWebSocketMessageData(data);
    const completeContext = this.completeMessageContext(context);
    const matchedHandler = await this.findMatchedHandler(message, completeContext);

    if (!matchedHandler) {
      return false;
    }

    await matchedHandler.applyDeclarations(message, completeContext);

    if (this.messageSaving.enabled) {
      matchedHandler.saveInterceptedMessage(message, completeContext);
    }

    return true;
  }

  private completeMessageContext(context?: Partial<WebSocketMessageHandlerApplyContext<Schema>>) {
    const sender = context?.sender ?? this.createInMemoryClient(this.baseURLAsString);

    if (!this._clients.includes(sender)) {
      this._clients.push(sender);
    }

    return {
      sender,
      receiver: context?.receiver ?? this._server,
    };
  }

  private createInMemoryClient(url: string): WebSocketInterceptorClient<Schema> {
    return new WebSocketInterceptorClientImplementation<Schema>(url);
  }

  private async findMatchedHandler(message: Schema, context: WebSocketMessageHandlerApplyContext<Schema>) {
    const failedMessageMatches = new Map<
      AnyWebSocketMessageHandlerImplementation,
      Extract<WebSocketMessageHandlerMessageMatch, { success: false }>
    >();

    for (let handlerIndex = this.handlers.length - 1; handlerIndex >= 0; handlerIndex--) {
      const handler = this.handlers[handlerIndex];
      const messageMatch = await handler.matchesMessage(message, context);

      if (messageMatch.success) {
        handler.markMessageAsMatched(message);
        return handler;
      }

      failedMessageMatches.set(handler, messageMatch);
    }

    for (let handlerIndex = this.handlers.length - 1; handlerIndex >= 0; handlerIndex--) {
      const handler = this.handlers[handlerIndex];
      const messageMatch = failedMessageMatches.get(handler);

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
    for (const handler of this.handlers) {
      handler.clear();
    }

    this.handlers.length = 0;
    this._clients.length = 0;
    this._server.messages.length = 0;

    return Promise.resolve();
  }
}

export default WebSocketInterceptorImplementation;
