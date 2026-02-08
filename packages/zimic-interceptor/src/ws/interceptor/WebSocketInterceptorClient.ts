import { excludeNonPathParams, validateURLProtocol } from '@zimic/utils/url';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { isServerSide } from '@/utils/environment';

import { LocalWebSocketMessageHandler } from '../messageHandler/LocalWebSocketMessageHandler';
import { RemoteWebSocketMessageHandler } from '../messageHandler/RemoteWebSocketMessageHandler';
import { WebSocketMessageHandler } from '../messageHandler/types/public';
import NotRunningWebSocketInterceptorError from './errors/NotRunningWebSocketInterceptorError';
import RunningWebSocketInterceptorError from './errors/RunningWebSocketInterceptorError';
import { WebSocketInterceptorMessageSaving } from './types/options';

export const SUPPORTED_BASE_URL_PROTOCOLS = Object.freeze(['ws', 'wss']);
export const DEFAULT_MESSAGE_SAVING_SAFE_LIMIT = 1000;

export type WebSocketHandlerConstructor = typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;

class WebSocketInterceptorClient<
  Schema extends WebSocketSchema,
  HandlerConstructor extends WebSocketHandlerConstructor = WebSocketHandlerConstructor,
> {
  private _baseURL!: URL;

  messageSaving: WebSocketInterceptorMessageSaving;
  private numberOfSavedMessages = 0;

  isRunning = false;

  private Handler: HandlerConstructor;

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
    // TODO
    return null;
  }

  async start() {
    // TODO
  }

  async stop() {
    // TODO
  }

  get numberOfRunningInterceptors() {
    // TODO
    return 0;
  }

  on(_type: 'message') {
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

  registerMessageHandler(_handler: WebSocketMessageHandler<Schema>) {
    // TODO
  }

  async handleInterceptedMessage(_message: WebSocketMessageData<Schema>) {
    // TODO
  }

  checkTimes() {
    // TODO
  }

  clear() {
    // TODO
    return Promise.resolve();
  }
}

export default WebSocketInterceptorClient;
