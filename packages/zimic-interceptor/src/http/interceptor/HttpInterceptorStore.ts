import { ExtendedURL } from '@/utils/urls';

import { createHttpInterceptorWorker } from '../interceptorWorker/factory';
import LocalHttpInterceptorWorker from '../interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../interceptorWorker/RemoteHttpInterceptorWorker';
import {
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from '../interceptorWorker/types/options';
import { AnyHttpInterceptorClient } from './HttpInterceptorClient';

class HttpInterceptorStore {
  private static _localWorker?: LocalHttpInterceptorWorker;
  private static runningLocalInterceptors = new Set<AnyHttpInterceptorClient>();

  private static remoteWorkers = new Map<string, RemoteHttpInterceptorWorker>();
  private static runningRemoteInterceptors = new Map<string, Set<AnyHttpInterceptorClient>>();

  private class = HttpInterceptorStore;

  localWorker() {
    return this.class._localWorker;
  }

  remoteWorker(baseURL: ExtendedURL) {
    return this.class.remoteWorkers.get(baseURL.origin);
  }

  numberOfRunningLocalInterceptors() {
    return this.class.runningLocalInterceptors.size;
  }

  numberOfRunningRemoteInterceptors(baseURL: ExtendedURL) {
    const runningInterceptors = this.class.runningRemoteInterceptors.get(baseURL.origin);
    return runningInterceptors?.size ?? 0;
  }

  markLocalInterceptorAsRunning(interceptor: AnyHttpInterceptorClient, isRunning: boolean) {
    if (isRunning) {
      this.class.runningLocalInterceptors.add(interceptor);
    } else {
      this.class.runningLocalInterceptors.delete(interceptor);
    }
  }

  markRemoteInterceptorAsRunning(interceptor: AnyHttpInterceptorClient, isRunning: boolean, baseURL: ExtendedURL) {
    const runningInterceptors =
      this.class.runningRemoteInterceptors.get(baseURL.origin) ?? this.createRunningInterceptorsSet(baseURL);

    if (isRunning) {
      runningInterceptors.add(interceptor);
    } else {
      runningInterceptors.delete(interceptor);
    }
  }

  private createRunningInterceptorsSet(baseURL: ExtendedURL) {
    const runningInterceptors = new Set<AnyHttpInterceptorClient>();
    this.class.runningRemoteInterceptors.set(baseURL.origin, runningInterceptors);
    return runningInterceptors;
  }

  getOrCreateLocalWorker(workerOptions: Omit<LocalHttpInterceptorWorkerOptions, 'type'>) {
    const existingWorker = this.class._localWorker;
    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = createHttpInterceptorWorker({ ...workerOptions, type: 'local' });
    this.class._localWorker = createdWorker;

    return createdWorker;
  }

  getOrCreateRemoteWorker(workerOptions: Omit<RemoteHttpInterceptorWorkerOptions, 'type'>) {
    const existingWorker = this.class.remoteWorkers.get(workerOptions.serverURL.origin);
    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = createHttpInterceptorWorker({ ...workerOptions, type: 'remote' });
    this.class.remoteWorkers.set(workerOptions.serverURL.origin, createdWorker);

    return createdWorker;
  }

  clear() {
    this.class._localWorker = undefined;
    this.class.runningLocalInterceptors.clear();
    this.class.remoteWorkers.clear();
    this.class.runningRemoteInterceptors.clear();
  }
}

export default HttpInterceptorStore;
