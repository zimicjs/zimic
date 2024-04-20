import { HttpMethod, HttpServiceSchema } from '@/http/types/schema';
import WebSocketClient from '@/websocket/WebSocketClient';

import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import UnknownHttpInterceptorWorkerPlatform from './errors/UnknownHttpInterceptorWorkerPlatform';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpInterceptorWorkerPlatform, RemoteHttpInterceptorWorkerOptions } from './types/options';
import { PublicRemoteHttpInterceptorWorker } from './types/public';
import { HttpRequestHandler } from './types/requests';

class RemoteHttpInterceptorWorker extends HttpInterceptorWorker implements PublicRemoteHttpInterceptorWorker {
  readonly type = 'remote';

  private _httpServerURL: URL;
  private websocketClient: WebSocketClient<{}>;

  constructor(options: RemoteHttpInterceptorWorkerOptions) {
    super();

    this._httpServerURL = new URL(options.mockServerURL);

    const webSocketServerURL = new URL(this._httpServerURL);
    webSocketServerURL.protocol = 'ws';

    this.websocketClient = new WebSocketClient({
      url: webSocketServerURL.toString(),
    });
  }

  mockServerURL() {
    return this._httpServerURL.toString();
  }

  async start() {
    this.setPlatform(await this.readPlatform());
    await this.websocketClient.start();
    this.setIsRunning(true);
  }

  private async readPlatform() {
    const { setupServer } = await import('msw/node');
    if (typeof setupServer !== 'undefined') {
      return 'node' satisfies HttpInterceptorWorkerPlatform;
    }

    const { setupWorker } = await import('msw/browser');
    if (typeof setupWorker !== 'undefined') {
      return 'browser' satisfies HttpInterceptorWorkerPlatform;
    }

    throw new UnknownHttpInterceptorWorkerPlatform();
  }

  async stop() {
    await this.websocketClient.stop();
    this.setIsRunning(false);
  }

  use<Schema extends HttpServiceSchema>(
    _interceptor: HttpInterceptorClient<Schema>,
    _method: HttpMethod,
    _url: string,
    _handler: HttpRequestHandler,
  ) {
    return Promise.resolve();
  }

  clearHandlers() {
    return Promise.resolve();
  }

  clearInterceptorHandlers<Schema extends HttpServiceSchema>(_interceptor: HttpInterceptorClient<Schema>) {
    return Promise.resolve();
  }

  interceptorsWithHandlers() {
    return [];
  }
}

export default RemoteHttpInterceptorWorker;
