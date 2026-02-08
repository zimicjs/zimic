import { WebSocketSchema } from '@zimic/ws';

import { LocalWebSocketMessageHandler } from '../messageHandler/LocalWebSocketMessageHandler';
import { WebSocketInterceptorClient as PublicWebSocketInterceptorClient } from './types/messages';
import { LocalWebSocketInterceptorOptions, WebSocketInterceptorMessageSaving } from './types/options';
import { LocalWebSocketInterceptor as PublicLocalWebSocketInterceptor } from './types/public';
import WebSocketInterceptorClient from './WebSocketInterceptorClient';

class LocalWebSocketInterceptor<Schema extends WebSocketSchema> implements PublicLocalWebSocketInterceptor<Schema> {
  client: WebSocketInterceptorClient<Schema>;

  constructor(options: LocalWebSocketInterceptorOptions) {
    const baseURL = new URL(options.baseURL);

    this.client = new WebSocketInterceptorClient<Schema>({
      baseURL,
      Handler: LocalWebSocketMessageHandler,
    });
  }

  get type() {
    return 'local' as const;
  }

  get baseURL() {
    return this.client.baseURLAsString;
  }

  set baseURL(baseURL: LocalWebSocketInterceptorOptions['baseURL']) {
    this.client.baseURL = new URL(baseURL);
  }

  get platform() {
    return this.client.platform;
  }

  get isRunning() {
    return this.client.isRunning;
  }

  get messageSaving() {
    return this.client.messageSaving;
  }

  set messageSaving(messageSaving: WebSocketInterceptorMessageSaving) {
    this.client.messageSaving = messageSaving;
  }

  on(type: 'message') {
    return this.client.on(type) as LocalWebSocketMessageHandler<Schema>;
  }

  // TODO
  server!: PublicWebSocketInterceptorClient<Schema>;

  // TODO
  clients!: PublicWebSocketInterceptorClient<Schema>[];

  async start() {
    if (this.isRunning) {
      return;
    }

    await this.client.start();
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.clear();
    await this.client.stop();
  }

  checkTimes() {
    this.client.checkTimes();
  }

  clear() {
    void this.client.clear();
  }
}

export default LocalWebSocketInterceptor;
