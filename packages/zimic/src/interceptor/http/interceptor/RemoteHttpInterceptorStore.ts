import { ExtendedURL } from '@/utils/fetch';

import { createHttpInterceptorWorker } from '../interceptorWorker/factory';
import RemoteHttpInterceptorWorker from '../interceptorWorker/RemoteHttpInterceptorWorker';
import { RemoteHttpInterceptorWorkerOptions } from '../interceptorWorker/types/options';
import { AnyHttpInterceptorClient } from './HttpInterceptorClient';
import HttpInterceptorStore from './HttpInterceptorStore';

class RemoteHttpInterceptorStore extends HttpInterceptorStore {
  private static workersByServerURL = new Map<string, RemoteHttpInterceptorWorker>();
  private static runningInterceptors = new Map<string, Set<AnyHttpInterceptorClient>>();

  static worker(baseURL: ExtendedURL) {
    return this.workersByServerURL.get(baseURL.origin);
  }

  private class = RemoteHttpInterceptorStore;

  numberOfRunningInterceptors(options: { baseURL: ExtendedURL }) {
    const runningInterceptors = this.class.runningInterceptors.get(options.baseURL.origin);
    return runningInterceptors?.size ?? 0;
  }

  markInterceptorAsRunning(
    interceptor: AnyHttpInterceptorClient,
    isRunning: boolean,
    options: { baseURL: ExtendedURL },
  ) {
    const runningInterceptors =
      this.class.runningInterceptors.get(options.baseURL.origin) ?? this.createRunningInterceptorsSet(options.baseURL);

    if (isRunning) {
      runningInterceptors.add(interceptor);
    } else {
      runningInterceptors.delete(interceptor);
    }
  }

  private createRunningInterceptorsSet(baseURL: ExtendedURL) {
    const runningInterceptors = new Set<AnyHttpInterceptorClient>();
    this.class.runningInterceptors.set(baseURL.origin, runningInterceptors);
    return runningInterceptors;
  }

  getOrCreateWorker(options: {
    serverURL: ExtendedURL;
    workerOptions: Omit<RemoteHttpInterceptorWorkerOptions, 'type' | 'serverURL'>;
  }) {
    const existingWorker = this.class.workersByServerURL.get(options.serverURL.origin);
    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = createHttpInterceptorWorker({
      ...options.workerOptions,
      type: 'remote',
      serverURL: options.serverURL,
    });
    this.class.workersByServerURL.set(options.serverURL.origin, createdWorker);

    return createdWorker;
  }
}

export default RemoteHttpInterceptorStore;
