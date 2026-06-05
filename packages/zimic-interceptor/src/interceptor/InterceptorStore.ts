import type { AnyHttpInterceptorImplementation } from '../http/interceptor/HttpInterceptorImplementation';
import LocalHttpInterceptorWorker from '../http/interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../http/interceptorWorker/RemoteHttpInterceptorWorker';
import {
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from '../http/interceptorWorker/types/options';
import type LocalWebSocketInterceptorWorker from '../ws/interceptorWorker/LocalWebSocketInterceptorWorker';
import type { LocalWebSocketInterceptorWorkerOptions } from '../ws/interceptorWorker/types/options';

interface RemoteWorkerKeyOptions {
  auth: RemoteHttpInterceptorWorkerOptions['auth'];
}

class InterceptorStore {
  private static _localHttpWorker?: LocalHttpInterceptorWorker;
  private static _localWebSocketWorker?: LocalWebSocketInterceptorWorker;

  private static remoteHttpWorkers = new Map<string, RemoteHttpInterceptorWorker>();
  private static runningLocalHttpInterceptors = new Set<AnyHttpInterceptorImplementation>();
  private static runningRemoteHttpInterceptors = new Map<string, Set<AnyHttpInterceptorImplementation>>();

  private class = InterceptorStore;

  get localWorker() {
    return this.localHttpWorker;
  }

  get localHttpWorker() {
    return this.class._localHttpWorker;
  }

  get localWebSocketWorker() {
    return this.class._localWebSocketWorker;
  }

  private getRemoteWorkerKey(baseURL: URL, options: RemoteWorkerKeyOptions) {
    const key = [`${baseURL.origin}${baseURL.pathname}`];

    if (options.auth) {
      key.push(options.auth.token);
    }

    return key.join(':');
  }

  remoteWorker(baseURL: URL, options: RemoteWorkerKeyOptions) {
    return this.remoteHttpWorker(baseURL, options);
  }

  remoteHttpWorker(baseURL: URL, options: RemoteWorkerKeyOptions) {
    const remoteWorkerKey = this.getRemoteWorkerKey(baseURL, options);
    return this.class.remoteHttpWorkers.get(remoteWorkerKey);
  }

  get numberOfRunningLocalInterceptors() {
    return this.numberOfRunningLocalHttpInterceptors;
  }

  get numberOfRunningLocalHttpInterceptors() {
    return this.class.runningLocalHttpInterceptors.size;
  }

  numberOfRunningRemoteInterceptors(baseURL: URL) {
    return this.numberOfRunningRemoteHttpInterceptors(baseURL);
  }

  numberOfRunningRemoteHttpInterceptors(baseURL: URL) {
    const runningInterceptors = this.class.runningRemoteHttpInterceptors.get(baseURL.origin);
    return runningInterceptors?.size ?? 0;
  }

  markLocalInterceptorAsRunning(interceptor: AnyHttpInterceptorImplementation, isRunning: boolean) {
    this.markLocalHttpInterceptorAsRunning(interceptor, isRunning);
  }

  markLocalHttpInterceptorAsRunning(interceptor: AnyHttpInterceptorImplementation, isRunning: boolean) {
    if (isRunning) {
      this.class.runningLocalHttpInterceptors.add(interceptor);
    } else {
      this.class.runningLocalHttpInterceptors.delete(interceptor);
    }
  }

  markRemoteInterceptorAsRunning(interceptor: AnyHttpInterceptorImplementation, isRunning: boolean, baseURL: URL) {
    this.markRemoteHttpInterceptorAsRunning(interceptor, isRunning, baseURL);
  }

  markRemoteHttpInterceptorAsRunning(interceptor: AnyHttpInterceptorImplementation, isRunning: boolean, baseURL: URL) {
    const runningInterceptors =
      this.class.runningRemoteHttpInterceptors.get(baseURL.origin) ?? this.createRunningHttpInterceptorsSet(baseURL);

    if (isRunning) {
      runningInterceptors.add(interceptor);
    } else {
      runningInterceptors.delete(interceptor);
    }
  }

  private createRunningHttpInterceptorsSet(baseURL: URL) {
    const runningInterceptors = new Set<AnyHttpInterceptorImplementation>();
    this.class.runningRemoteHttpInterceptors.set(baseURL.origin, runningInterceptors);
    return runningInterceptors;
  }

  getOrCreateLocalWorker(workerOptions: Omit<LocalHttpInterceptorWorkerOptions, 'type'>) {
    return this.getOrCreateLocalHttpWorker(workerOptions);
  }

  getOrCreateLocalHttpWorker(workerOptions: Omit<LocalHttpInterceptorWorkerOptions, 'type'>) {
    const existingWorker = this.class._localHttpWorker;

    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = new LocalHttpInterceptorWorker({ ...workerOptions, type: 'local' });
    this.class._localHttpWorker = createdWorker;

    return createdWorker;
  }

  deleteLocalWorker() {
    this.deleteLocalHttpWorker();
  }

  deleteLocalHttpWorker() {
    this.class._localHttpWorker = undefined;
  }

  getOrCreateLocalWebSocketWorker(
    workerOptions: Omit<LocalWebSocketInterceptorWorkerOptions, 'type'>,
    createWorker: (workerOptions: LocalWebSocketInterceptorWorkerOptions) => LocalWebSocketInterceptorWorker,
  ) {
    const existingWorker = this.class._localWebSocketWorker;

    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = createWorker({ ...workerOptions, type: 'local' });
    this.class._localWebSocketWorker = createdWorker;

    return createdWorker;
  }

  deleteLocalWebSocketWorker() {
    this.class._localWebSocketWorker = undefined;
  }

  getOrCreateRemoteWorker(workerOptions: Omit<RemoteHttpInterceptorWorkerOptions, 'type'>) {
    return this.getOrCreateRemoteHttpWorker(workerOptions);
  }

  getOrCreateRemoteHttpWorker(workerOptions: Omit<RemoteHttpInterceptorWorkerOptions, 'type'>) {
    const remoteWorkerKey = this.getRemoteWorkerKey(workerOptions.serverURL, { auth: workerOptions.auth });
    const existingWorker = this.class.remoteHttpWorkers.get(remoteWorkerKey);

    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = new RemoteHttpInterceptorWorker({ ...workerOptions, type: 'remote' });
    this.class.remoteHttpWorkers.set(remoteWorkerKey, createdWorker);

    return createdWorker;
  }

  deleteRemoteWorker(baseURL: URL, options: RemoteWorkerKeyOptions) {
    this.deleteRemoteHttpWorker(baseURL, options);
  }

  deleteRemoteHttpWorker(baseURL: URL, options: RemoteWorkerKeyOptions) {
    const remoteWorkerKey = this.getRemoteWorkerKey(baseURL, options);
    this.class.remoteHttpWorkers.delete(remoteWorkerKey);
  }
}

export default InterceptorStore;
