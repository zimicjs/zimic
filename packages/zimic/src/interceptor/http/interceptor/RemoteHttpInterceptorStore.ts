import { ExtendedURL } from '@/utils/fetch';

import RemoteHttpInterceptorWorker from '../interceptorWorker/RemoteHttpInterceptorWorker';

class RemoteHttpInterceptorStore {
  private static workersByServerURL = new Map<string, RemoteHttpInterceptorWorker>();

  getOrCreateWorker(serverURL: ExtendedURL) {
    const existingWorker = RemoteHttpInterceptorStore.workersByServerURL.get(serverURL.origin);
    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = new RemoteHttpInterceptorWorker({ serverURL });
    RemoteHttpInterceptorStore.workersByServerURL.set(serverURL.origin, createdWorker);

    return createdWorker;
  }
}

export default RemoteHttpInterceptorStore;
