import { createHttpInterceptorWorker } from '../interceptorWorker/factory';
import LocalHttpInterceptorWorker from '../interceptorWorker/LocalHttpInterceptorWorker';
import { AnyHttpInterceptorClient } from './HttpInterceptorClient';
import HttpInterceptorStore from './HttpInterceptorStore';

class LocalHttpInterceptorStore extends HttpInterceptorStore {
  private static _worker?: LocalHttpInterceptorWorker = createHttpInterceptorWorker({ type: 'local' });
  private static runningInterceptors = new Set<AnyHttpInterceptorClient>();

  static worker() {
    return this._worker;
  }

  static numberOfWorkers() {
    return this._worker ? 1 : 0;
  }

  numberOfRunningInterceptors() {
    return LocalHttpInterceptorStore.runningInterceptors.size;
  }

  markInterceptorAsRunning(interceptor: AnyHttpInterceptorClient, isRunning: boolean) {
    if (isRunning) {
      LocalHttpInterceptorStore.runningInterceptors.add(interceptor);
    } else {
      LocalHttpInterceptorStore.runningInterceptors.delete(interceptor);
    }
  }

  getOrCreateWorker() {
    const existingWorker = LocalHttpInterceptorStore._worker;
    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = createHttpInterceptorWorker({ type: 'local' });
    LocalHttpInterceptorStore._worker = createdWorker;
    return createdWorker;
  }
}

export default LocalHttpInterceptorStore;
