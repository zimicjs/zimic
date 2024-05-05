import LocalHttpInterceptorWorker from '../interceptorWorker/LocalHttpInterceptorWorker';

class LocalHttpInterceptorStore {
  private static worker?: LocalHttpInterceptorWorker;

  getOrCreateWorker() {
    const existingWorker = LocalHttpInterceptorStore.worker;

    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = new LocalHttpInterceptorWorker();
    LocalHttpInterceptorStore.worker = createdWorker;
    return createdWorker;
  }
}

export default LocalHttpInterceptorStore;
