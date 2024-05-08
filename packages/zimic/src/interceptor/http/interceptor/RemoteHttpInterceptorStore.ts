import { ExtendedURL } from '@/utils/fetch';

import { createHttpInterceptorWorker } from '../interceptorWorker/factory';
import RemoteHttpInterceptorWorker from '../interceptorWorker/RemoteHttpInterceptorWorker';
import { AnyHttpInterceptorClient } from './HttpInterceptorClient';
import HttpInterceptorStore from './HttpInterceptorStore';

class RemoteHttpInterceptorStore extends HttpInterceptorStore {
  private static workersByBaseURL = new Map<string, RemoteHttpInterceptorWorker>();
  private static runningInterceptors = new Map<string, Set<AnyHttpInterceptorClient>>();

  static worker(baseURL: ExtendedURL) {
    return this.workersByBaseURL.get(baseURL.raw);
  }

  static numberOfWorkers() {
    return this.workersByBaseURL.size;
  }

  numberOfRunningInterceptors(baseURL: ExtendedURL) {
    const runningInterceptors = RemoteHttpInterceptorStore.runningInterceptors.get(baseURL.raw);
    return runningInterceptors?.size ?? 0;
  }

  markInterceptorAsRunning(interceptor: AnyHttpInterceptorClient, isRunning: boolean, baseURL: ExtendedURL) {
    const runningInterceptors = RemoteHttpInterceptorStore.runningInterceptors.get(baseURL.raw) ?? new Set();

    if (isRunning) {
      runningInterceptors.add(interceptor);
    } else {
      runningInterceptors.delete(interceptor);
    }

    RemoteHttpInterceptorStore.runningInterceptors.set(baseURL.raw, runningInterceptors);
  }

  getOrCreateWorker(baseURL: ExtendedURL) {
    const existingWorker = RemoteHttpInterceptorStore.workersByBaseURL.get(baseURL.raw);
    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = createHttpInterceptorWorker({ type: 'remote', serverURL: baseURL });
    RemoteHttpInterceptorStore.workersByBaseURL.set(baseURL.raw, createdWorker);

    return createdWorker;
  }
}

export default RemoteHttpInterceptorStore;
