import { RemoteHttpInterceptorWorkerOptions } from './types/options';
import { RemoteHttpInterceptorWorker as PublicRemoteHttpInterceptorWorker } from './types/public';

class RemoteHttpInterceptorWorker implements PublicRemoteHttpInterceptorWorker {
  readonly type = 'remote';

  private _serverURL: string;

  constructor(options: RemoteHttpInterceptorWorkerOptions) {
    this._serverURL = options.serverURL;
  }

  serverURL() {
    return this._serverURL;
  }

  isRunning() {
    return false;
  }

  async start() {
    return Promise.resolve();
  }

  async stop() {
    return Promise.resolve();
  }
}

export default RemoteHttpInterceptorWorker;
