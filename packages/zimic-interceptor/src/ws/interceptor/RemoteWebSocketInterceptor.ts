import { WebSocketSchema } from '@zimic/ws';

import { createWebSocketInterceptorWorker } from '../interceptorWorker/factory';
import { RemoteWebSocketMessageHandler } from '../messageHandler/RemoteWebSocketMessageHandler';
import RunningWebSocketInterceptorError from './errors/RunningWebSocketInterceptorError';
import { WebSocketInterceptorClient as PublicWebSocketInterceptorClient } from './types/messages';
import { RemoteWebSocketInterceptorOptions, WebSocketInterceptorMessageSaving } from './types/options';
import { RemoteWebSocketInterceptor as PublicRemoteWebSocketInterceptor } from './types/public';
import WebSocketInterceptorImplementation from './WebSocketInterceptorImplementation';

class RemoteWebSocketInterceptor<Schema extends WebSocketSchema> implements PublicRemoteWebSocketInterceptor<Schema> {
  implementation: WebSocketInterceptorImplementation<Schema>;
  #auth?: RemoteWebSocketInterceptorOptions['auth'];

  constructor(options: RemoteWebSocketInterceptorOptions) {
    const baseURL = new URL(options.baseURL);

    this.implementation = new WebSocketInterceptorImplementation<Schema>({
      baseURL,
      messageSaving: options.messageSaving,
      Handler: RemoteWebSocketMessageHandler,
      createWorker: () => {
        return createWebSocketInterceptorWorker({
          type: 'remote',
          serverURL: this.implementation.baseURL,
          auth: this.#auth,
        });
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

    if (this.isRunning) {
      throw new RunningWebSocketInterceptorError(cannotChangeAuthWhileRunningMessage);
    }

    if (!auth) {
      this.#auth = undefined;
      return;
    }

    this.#auth = new Proxy(auth, {
      set: (target, property, value) => {
        if (this.isRunning) {
          throw new RunningWebSocketInterceptorError(cannotChangeAuthWhileRunningMessage);
        }
        return Reflect.set(target, property, value);
      },
    });
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

  message() {
    return this.implementation.message() as RemoteWebSocketMessageHandler<Schema>;
  }

  get server(): PublicWebSocketInterceptorClient<Schema> {
    return this.implementation.server;
  }

  get clients(): PublicWebSocketInterceptorClient<Schema>[] {
    return this.implementation.clients;
  }

  async start() {
    if (this.isRunning) {
      return;
    }

    await this.implementation.start();
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    await this.clear();
    await this.implementation.stop();
  }

  checkTimes() {
    return new Promise<void>((resolve, reject) => {
      try {
        this.implementation.checkTimes();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async clear() {
    await this.implementation.clear();
  }
}

export default RemoteWebSocketInterceptor;
