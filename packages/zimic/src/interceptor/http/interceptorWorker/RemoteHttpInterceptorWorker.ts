import { HttpMethod, HttpServiceSchema } from '@/http/types/schema';

import HttpInterceptorClient from '../interceptor/HttpInterceptorClient';
import UnknownHttpInterceptorWorkerPlatform from './errors/UnknownHttpInterceptorWorkerPlatform';
import HttpInterceptorWorker from './HttpInterceptorWorker';
import { HttpInterceptorWorkerPlatform, RemoteHttpInterceptorWorkerOptions } from './types/options';
import { PublicRemoteHttpInterceptorWorker } from './types/public';
import { HttpRequestHandler } from './types/requests';

class RemoteHttpInterceptorWorker extends HttpInterceptorWorker implements PublicRemoteHttpInterceptorWorker {
  readonly type = 'remote';

  private _mockServerURL: string;

  constructor(options: RemoteHttpInterceptorWorkerOptions) {
    super();
    this._mockServerURL = options.mockServerURL;
  }

  mockServerURL() {
    return this._mockServerURL;
  }

  async start() {
    this.setPlatform(await this.readPlatform());
    this.setIsRunning(true);
    return Promise.resolve();
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
    this.setIsRunning(false);
    return Promise.resolve();
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
