import { WebSocketSchema } from '@zimic/ws';

import { LocalWebSocketMessageHandler } from '../messageHandler/LocalWebSocketMessageHandler';
import {
  WebSocketInterceptorClient as PublicWebSocketInterceptorClient,
  WebSocketInterceptorServer as PublicWebSocketInterceptorServer,
} from './types/messages';
import { LocalWebSocketInterceptorOptions, WebSocketInterceptorMessageSaving } from './types/options';
import { LocalWebSocketInterceptor as PublicLocalWebSocketInterceptor } from './types/public';
import WebSocketInterceptorImplementation from './WebSocketInterceptorImplementation';
import WebSocketInterceptorStore from './WebSocketInterceptorStore';

class LocalWebSocketInterceptor<Schema extends WebSocketSchema> implements PublicLocalWebSocketInterceptor<Schema> {
  private store = new WebSocketInterceptorStore();

  implementation: WebSocketInterceptorImplementation<Schema>;

  constructor(options: LocalWebSocketInterceptorOptions) {
    const baseURL = new URL(options.baseURL);

    this.implementation = new WebSocketInterceptorImplementation<Schema>({
      baseURL,
      messageSaving: options.messageSaving,
      Handler: LocalWebSocketMessageHandler,
      createWorker: () => this.store.getOrCreateLocalWorker({}),
      releaseWorker: (worker) => {
        if (!worker.isRunning) {
          this.store.deleteLocalWorker();
        }
      },
    });
  }

  get type() {
    return 'local' as const;
  }

  get baseURL() {
    return this.implementation.baseURLAsString;
  }

  set baseURL(baseURL: LocalWebSocketInterceptorOptions['baseURL']) {
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
    return this.implementation.message() as LocalWebSocketMessageHandler<Schema>;
  }

  get server(): PublicWebSocketInterceptorServer<Schema> {
    return this.implementation.server;
  }

  get clients(): readonly PublicWebSocketInterceptorClient<Schema>[] {
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

    this.clear();
    await this.implementation.stop();
  }

  checkTimes() {
    this.implementation.checkTimes();
  }

  clear() {
    void this.implementation.clear();
  }
}

export default LocalWebSocketInterceptor;
