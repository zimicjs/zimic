import { createHttpInterceptorWorker } from '../interceptorWorker/factory';
import LocalHttpInterceptorWorker from '../interceptorWorker/LocalHttpInterceptorWorker';
import { AnyHttpInterceptorClient } from './HttpInterceptorClient';
import HttpInterceptorStore from './HttpInterceptorStore';

class LocalHttpInterceptorStore extends HttpInterceptorStore {
  private static _worker?: LocalHttpInterceptorWorker;
  private static runningInterceptors = new Set<AnyHttpInterceptorClient>();

  static worker() {
    return this._worker;
  }

  private class = LocalHttpInterceptorStore;

  numberOfRunningInterceptors() {
    return this.class.runningInterceptors.size;
  }

  markInterceptorAsRunning(interceptor: AnyHttpInterceptorClient, isRunning: boolean) {
    if (isRunning) {
      this.class.runningInterceptors.add(interceptor);
    } else {
      this.class.runningInterceptors.delete(interceptor);
    }
  }

  getOrCreateWorker() {
    const existingWorker = this.class._worker;
    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = createHttpInterceptorWorker({ type: 'local' });
    this.class._worker = createdWorker;

    return createdWorker;
  }
}

export default LocalHttpInterceptorStore;
