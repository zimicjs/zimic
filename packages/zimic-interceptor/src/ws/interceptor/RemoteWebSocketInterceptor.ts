import { WebSocketSchema } from '@zimic/ws';

import { RemoteWebSocketMessageHandler } from '../messageHandler/RemoteWebSocketMessageHandler';
import { WebSocketInterceptorClient as PublicWebSocketInterceptorClient } from './types/messages';
import { RemoteWebSocketInterceptorOptions, WebSocketInterceptorMessageSaving } from './types/options';
import { RemoteWebSocketInterceptor as PublicRemoteWebSocketInterceptor } from './types/public';
import WebSocketInterceptorImplementation from './WebSocketInterceptorImplementation';

class RemoteWebSocketInterceptor<Schema extends WebSocketSchema> implements PublicRemoteWebSocketInterceptor<Schema> {
  implementation: WebSocketInterceptorImplementation<Schema>;

  constructor(options: RemoteWebSocketInterceptorOptions) {
    const baseURL = new URL(options.baseURL);

    this.implementation = new WebSocketInterceptorImplementation<Schema>({
      baseURL,
      Handler: RemoteWebSocketMessageHandler,
    });
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

  // TODO
  server!: PublicWebSocketInterceptorClient<Schema>;

  // TODO
  clients!: PublicWebSocketInterceptorClient<Schema>[];

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
