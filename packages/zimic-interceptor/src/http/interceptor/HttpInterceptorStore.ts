import { createHttpInterceptorWorker } from '../interceptorWorker/factory';
import LocalHttpInterceptorWorker from '../interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../interceptorWorker/RemoteHttpInterceptorWorker';
import {
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from '../interceptorWorker/types/options';
import { AnyHttpInterceptorClient } from './HttpInterceptorClient';

interface RemoteWorkerKeyOptions {
  auth?: RemoteHttpInterceptorWorkerOptions['auth'];
}

class HttpInterceptorStore {
  private static _localWorker?: LocalHttpInterceptorWorker;
  private static runningLocalInterceptors = new Set<AnyHttpInterceptorClient>();

  private static remoteWorkers = new Map<string, RemoteHttpInterceptorWorker>();
  private static runningRemoteInterceptors = new Map<string, Set<AnyHttpInterceptorClient>>();

  private class = HttpInterceptorStore;

  get localWorker() {
    return this.class._localWorker;
  }

  private getRemoteWorkerKey(baseURL: URL, options: RemoteWorkerKeyOptions) {
    if (!options.auth) {
      return baseURL.origin;
    }
    return `${baseURL.origin}:${options.auth.token}`;
  }

  remoteWorker(baseURL: URL, options: RemoteWorkerKeyOptions) {
    const remoteWorkerKey = this.getRemoteWorkerKey(baseURL, options);
    return this.class.remoteWorkers.get(remoteWorkerKey);
  }

  get numberOfRunningLocalInterceptors() {
    return this.class.runningLocalInterceptors.size;
  }

  numberOfRunningRemoteInterceptors(baseURL: URL) {
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

  markRemoteInterceptorAsRunning(interceptor: AnyHttpInterceptorClient, isRunning: boolean, baseURL: URL) {
    const runningInterceptors =
      this.class.runningRemoteInterceptors.get(baseURL.origin) ?? this.createRunningInterceptorsSet(baseURL);

    if (isRunning) {
      runningInterceptors.add(interceptor);
    } else {
      runningInterceptors.delete(interceptor);
    }
  }

  private createRunningInterceptorsSet(baseURL: URL) {
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

  deleteLocalWorker() {
    this.class._localWorker = undefined;
  }

  getOrCreateRemoteWorker(workerOptions: Omit<RemoteHttpInterceptorWorkerOptions, 'type'>) {
    const remoteWorkerKey = this.getRemoteWorkerKey(workerOptions.serverURL, { auth: workerOptions.auth });

    const existingWorker = this.class.remoteWorkers.get(remoteWorkerKey);
    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = createHttpInterceptorWorker({ ...workerOptions, type: 'remote' });
    this.class.remoteWorkers.set(remoteWorkerKey, createdWorker);

    return createdWorker;
  }

  deleteRemoteWorker(baseURL: URL, options: RemoteWorkerKeyOptions) {
    const remoteWorkerKey = this.getRemoteWorkerKey(baseURL, options);
    this.class.remoteWorkers.delete(remoteWorkerKey);
  }

  clear() {
    this.class._localWorker = undefined;
    this.class.runningLocalInterceptors.clear();
    this.class.remoteWorkers.clear();
    this.class.runningRemoteInterceptors.clear();
  }
}

export default HttpInterceptorStore;
