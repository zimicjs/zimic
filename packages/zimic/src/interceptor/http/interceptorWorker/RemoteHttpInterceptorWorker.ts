import { HttpMethod, HttpServiceSchema } from '@/http/types/schema';

import { HttpInterceptor } from '../interceptor/types/public';
import UnknownHttpInterceptorWorkerPlatform from './errors/UnknownHttpInterceptorWorkerPlatform';
import { HttpInterceptorWorkerPlatform, RemoteHttpInterceptorWorkerOptions } from './types/options';
import {
  InternalHttpInterceptorWorker,
  RemoteHttpInterceptorWorker as PublicRemoteHttpInterceptorWorker,
} from './types/public';
import { HttpRequestHandler } from './types/requests';

class RemoteHttpInterceptorWorker implements PublicRemoteHttpInterceptorWorker, InternalHttpInterceptorWorker {
  readonly type = 'remote';

  private _mockServerURL: string;
  private _platform: HttpInterceptorWorkerPlatform | null = null;
  private _isRunning = false;

  constructor(options: RemoteHttpInterceptorWorkerOptions) {
    this._mockServerURL = options.mockServerURL;
  }

  mockServerURL() {
    return this._mockServerURL;
  }

  platform() {
    return this._platform;
  }

  isRunning() {
    return this._isRunning;
  }

  async start() {
    this._platform = await this.readPlatform();
    this._isRunning = true;
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
    this._isRunning = false;
    return Promise.resolve();
  }

  use<Schema extends HttpServiceSchema>(
    _interceptor: HttpInterceptor<Schema>,
    _method: HttpMethod,
    _url: string,
    _handler: HttpRequestHandler,
  ) {
    return Promise.resolve();
  }

  clearHandlers() {
    return Promise.resolve();
  }

  clearInterceptorHandlers<Schema extends HttpServiceSchema>(_interceptor: HttpInterceptor<Schema>) {
    return Promise.resolve();
  }

  interceptorsWithHandlers() {
    return Promise.resolve([]);
  }
}

export default RemoteHttpInterceptorWorker;
