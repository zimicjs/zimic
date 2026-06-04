import { WebSocketSchema } from '@zimic/ws';

import { createWebSocketInterceptorWorker } from '../interceptorWorker/factory';
import { LocalWebSocketMessageHandler } from '../messageHandler/LocalWebSocketMessageHandler';
import { WebSocketInterceptorClient as PublicWebSocketInterceptorClient } from './types/messages';
import { LocalWebSocketInterceptorOptions, WebSocketInterceptorMessageSaving } from './types/options';
import { LocalWebSocketInterceptor as PublicLocalWebSocketInterceptor } from './types/public';
import WebSocketInterceptorImplementation from './WebSocketInterceptorImplementation';

class LocalWebSocketInterceptor<Schema extends WebSocketSchema> implements PublicLocalWebSocketInterceptor<Schema> {
  implementation: WebSocketInterceptorImplementation<Schema>;

  constructor(options: LocalWebSocketInterceptorOptions) {
    const baseURL = new URL(options.baseURL);
    const worker = createWebSocketInterceptorWorker({ type: 'local' });

    this.implementation = new WebSocketInterceptorImplementation<Schema>({
      baseURL,
      messageSaving: options.messageSaving,
      Handler: LocalWebSocketMessageHandler,
      worker,
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
