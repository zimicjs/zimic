import LocalWebSocketInterceptorWorker from '../interceptorWorker/LocalWebSocketInterceptorWorker';
import RemoteWebSocketInterceptorWorker from '../interceptorWorker/RemoteWebSocketInterceptorWorker';
import type {
  LocalWebSocketInterceptorWorkerOptions,
  RemoteWebSocketInterceptorWorkerOptions,
} from '../interceptorWorker/types/options';

interface RemoteWorkerKeyOptions {
  auth: RemoteWebSocketInterceptorWorkerOptions['auth'];
}

class WebSocketInterceptorStore {
  private static localWorker?: LocalWebSocketInterceptorWorker;
  private static remoteWorkers = new Map<string, RemoteWebSocketInterceptorWorker>();

  private class = WebSocketInterceptorStore;

  get localWorker() {
    return this.class.localWorker;
  }

  private getRemoteWorkerKey(baseURL: URL, options: RemoteWorkerKeyOptions) {
    const key = [`${baseURL.origin}${baseURL.pathname}`];

    if (options.auth) {
      key.push(options.auth.token);
    }

    return key.join(':');
  }

  getRemoteWorker(baseURL: URL, options: RemoteWorkerKeyOptions) {
    const remoteWorkerKey = this.getRemoteWorkerKey(baseURL, options);
    return this.class.remoteWorkers.get(remoteWorkerKey);
  }

  getOrCreateLocalWorker(workerOptions: Omit<LocalWebSocketInterceptorWorkerOptions, 'type'>) {
    const existingWorker = this.class.localWorker;

    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = new LocalWebSocketInterceptorWorker({ ...workerOptions, type: 'local' });
    this.class.localWorker = createdWorker;

    return createdWorker;
  }

  deleteLocalWorker() {
    this.class.localWorker = undefined;
  }

  getOrCreateRemoteWorker(workerOptions: Omit<RemoteWebSocketInterceptorWorkerOptions, 'type'>) {
    const remoteWorkerKey = this.getRemoteWorkerKey(workerOptions.serverURL, { auth: workerOptions.auth });
    const existingWorker = this.class.remoteWorkers.get(remoteWorkerKey);

    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = new RemoteWebSocketInterceptorWorker({ ...workerOptions, type: 'remote' });
    this.class.remoteWorkers.set(remoteWorkerKey, createdWorker);

    return createdWorker;
  }

  deleteRemoteWorker(baseURL: URL, options: RemoteWorkerKeyOptions) {
    const remoteWorkerKey = this.getRemoteWorkerKey(baseURL, options);
    this.class.remoteWorkers.delete(remoteWorkerKey);
  }
}

export default WebSocketInterceptorStore;
