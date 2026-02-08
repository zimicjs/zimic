import { WebSocketSchema } from '@zimic/ws';

import { RemoteWebSocketMessageHandler } from '../messageHandler/RemoteWebSocketMessageHandler';
import { WebSocketInterceptorClient as PublicWebSocketInterceptorClient } from './types/messages';
import { RemoteWebSocketInterceptorOptions, WebSocketInterceptorMessageSaving } from './types/options';
import { RemoteWebSocketInterceptor as PublicRemoteWebSocketInterceptor } from './types/public';
import WebSocketInterceptorClient from './WebSocketInterceptorClient';

class RemoteWebSocketInterceptor<Schema extends WebSocketSchema> implements PublicRemoteWebSocketInterceptor<Schema> {
  client: WebSocketInterceptorClient<Schema>;

  constructor(options: RemoteWebSocketInterceptorOptions) {
    const baseURL = new URL(options.baseURL);

    this.client = new WebSocketInterceptorClient<Schema>({
      baseURL,
      Handler: RemoteWebSocketMessageHandler,
    });
  }

  get type() {
    return 'remote' as const;
  }

  get baseURL() {
    return this.client.baseURLAsString;
  }

  set baseURL(baseURL: RemoteWebSocketInterceptorOptions['baseURL']) {
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
    return this.client.on(type) as RemoteWebSocketMessageHandler<Schema>;
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

    await this.clear();
    await this.client.stop();
  }

  checkTimes() {
    return new Promise<void>((resolve, reject) => {
      try {
        this.client.checkTimes();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async clear() {
    await this.client.clear();
  }
}

export default RemoteWebSocketInterceptor;
