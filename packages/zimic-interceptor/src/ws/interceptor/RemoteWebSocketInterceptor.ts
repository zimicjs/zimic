import { WebSocketSchema } from '@zimic/ws';

import RemoteWebSocketMessageHandler from '../messageHandler/RemoteWebSocketMessageHandler';
import RunningWebSocketInterceptorError from './errors/RunningWebSocketInterceptorError';
import {
  WebSocketInterceptorClient as PublicWebSocketInterceptorClient,
  WebSocketInterceptorServer as PublicWebSocketInterceptorServer,
} from './types/messages';
import { RemoteWebSocketInterceptorOptions, UnhandledMessageStrategy } from './types/options';
import {
  RemoteWebSocketInterceptor as PublicRemoteWebSocketInterceptor,
  type WebSocketInterceptorConnectionListener,
  WebSocketInterceptorMessageSaving,
} from './types/public';
import WebSocketInterceptorImplementation from './WebSocketInterceptorImplementation';
import WebSocketInterceptorStore from './WebSocketInterceptorStore';

class RemoteWebSocketInterceptor<Schema extends WebSocketSchema> implements PublicRemoteWebSocketInterceptor<Schema> {
  private store = new WebSocketInterceptorStore();
  implementation: WebSocketInterceptorImplementation<Schema>;
  #auth?: RemoteWebSocketInterceptorOptions['auth'];

  constructor(options: RemoteWebSocketInterceptorOptions) {
    const baseURL = new URL(options.baseURL);

    this.implementation = new WebSocketInterceptorImplementation<Schema>({
      baseURL,
      messageSaving: options.messageSaving,
      onUnhandledMessage: options.onUnhandledMessage,
      Handler: RemoteWebSocketMessageHandler,
      createWorker: () => {
        return this.store.getOrCreateRemoteWorker({
          serverURL: this.implementation.baseURL,
          auth: this.#auth,
        });
      },
      deleteWorker: () => {
        this.store.deleteRemoteWorker(this.implementation.baseURL, { auth: this.#auth });
      },
    });

    this.auth = options.auth;
  }

  get type() {
    return 'remote' as const;
  }

  get baseURL() {
    return this.implementation.baseURLAsString;
  }

  set baseURL(baseURL: RemoteWebSocketInterceptorOptions['baseURL']) {
    this.implementation.baseURL = new URL(baseURL);
  }

  get auth() {
    return this.#auth;
  }

  set auth(auth: RemoteWebSocketInterceptorOptions['auth'] | undefined) {
    const cannotChangeAuthWhileRunningMessage =
      'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?';

    if (this.isRunning || this.implementation.isStarting) {
      throw new RunningWebSocketInterceptorError(cannotChangeAuthWhileRunningMessage);
    }

    if (!auth) {
      this.#auth = undefined;
      return;
    }

    this.#auth = new Proxy(
      { ...auth },
      {
        set: (target, property, value) => {
          if (this.isRunning || this.implementation.isStarting) {
            throw new RunningWebSocketInterceptorError(cannotChangeAuthWhileRunningMessage);
          }
          return Reflect.set(target, property, value);
        },
      },
    );
  }

  get platform() {
    return this.implementation.platform;
  }

  get isRunning() {
    return this.implementation.isRunning;
  }

  get messageSaving() {
    return this.implementation.messageSaving;
  }

  set messageSaving(messageSaving: WebSocketInterceptorMessageSaving) {
    this.implementation.messageSaving = messageSaving;
  }

  get onUnhandledMessage() {
    return this.implementation.onUnhandledMessage;
  }

  set onUnhandledMessage(onUnhandledMessage: UnhandledMessageStrategy | undefined) {
    this.implementation.onUnhandledMessage = onUnhandledMessage;
  }

  message() {
    return this.implementation.message() as RemoteWebSocketMessageHandler<Schema>;
  }

  get server(): PublicWebSocketInterceptorServer<Schema> {
    return this.implementation.server;
  }

  get clients(): readonly PublicWebSocketInterceptorClient<Schema>[] {
    return this.implementation.clients;
  }

  on(_event: 'connection', listener: WebSocketInterceptorConnectionListener<Schema>) {
    this.implementation.on('connection', listener);
  }

  off(_event: 'connection', listener: WebSocketInterceptorConnectionListener<Schema>) {
    this.implementation.off('connection', listener);
  }

  once(_event: 'connection', listener: WebSocketInterceptorConnectionListener<Schema>) {
    this.implementation.once('connection', listener);
  }

  async start() {
    await this.implementation.start();
  }

  async stop() {
    await this.implementation.stop({ beforeStop: () => this.clear() });
  }

  async checkTimes() {
    this.implementation.checkTimes();
    return Promise.resolve();
  }

  async clear() {
    await this.implementation.clear();
  }
}

export default RemoteWebSocketInterceptor;
