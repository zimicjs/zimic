import LocalWebSocketInterceptorWorker from '../interceptorWorker/LocalWebSocketInterceptorWorker';
import type { LocalWebSocketInterceptorWorkerOptions } from '../interceptorWorker/types/options';

class WebSocketInterceptorStore {
  private static localWorker?: LocalWebSocketInterceptorWorker;

  private class = WebSocketInterceptorStore;

  get localWorker() {
    return this.class.localWorker;
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
}

export default WebSocketInterceptorStore;
