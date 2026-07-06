import LocalHttpInterceptorWorker from '../interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../interceptorWorker/RemoteHttpInterceptorWorker';
import type {
  LocalHttpInterceptorWorkerOptions,
  RemoteHttpInterceptorWorkerOptions,
} from '../interceptorWorker/types/options';
import type { AnyHttpInterceptorImplementation } from './HttpInterceptorImplementation';

interface RemoteWorkerKeyOptions {
  auth: RemoteHttpInterceptorWorkerOptions['auth'];
}

class HttpInterceptorStore {
  private static localWorker?: LocalHttpInterceptorWorker;
  private static remoteWorkers = new Map<string, RemoteHttpInterceptorWorker>();
  private static runningLocalInterceptors = new Set<AnyHttpInterceptorImplementation>();
  private static runningRemoteInterceptors = new Map<string, Set<AnyHttpInterceptorImplementation>>();

  private class = HttpInterceptorStore;

  get localWorker() {
    return this.class.localWorker;
  }

  private getRemoteWorkerKey(baseURL: URL, options: RemoteWorkerKeyOptions) {
    const key = [`${baseURL.origin}${baseURL.pathname}`];

    if (options.auth) {
      key.push(options.auth.token);
    }

    return key.join(':');
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

  markLocalInterceptorAsRunning(interceptor: AnyHttpInterceptorImplementation, isRunning: boolean) {
    if (isRunning) {
      this.class.runningLocalInterceptors.add(interceptor);
    } else {
      this.class.runningLocalInterceptors.delete(interceptor);
    }
  }

  markRemoteInterceptorAsRunning(interceptor: AnyHttpInterceptorImplementation, isRunning: boolean, baseURL: URL) {
    const runningInterceptors =
      this.class.runningRemoteInterceptors.get(baseURL.origin) ?? this.createRunningInterceptorsSet(baseURL);

    if (isRunning) {
      runningInterceptors.add(interceptor);
    } else {
      runningInterceptors.delete(interceptor);
    }
  }

  private createRunningInterceptorsSet(baseURL: URL) {
    const runningInterceptors = new Set<AnyHttpInterceptorImplementation>();
    this.class.runningRemoteInterceptors.set(baseURL.origin, runningInterceptors);
    return runningInterceptors;
  }

  getOrCreateLocalWorker(workerOptions: Omit<LocalHttpInterceptorWorkerOptions, 'type'>) {
    const existingWorker = this.class.localWorker;

    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = new LocalHttpInterceptorWorker({ ...workerOptions, type: 'local' });
    this.class.localWorker = createdWorker;

    return createdWorker;
  }

  deleteLocalWorker() {
    this.class.localWorker = undefined;
  }

  getOrCreateRemoteWorker(workerOptions: Omit<RemoteHttpInterceptorWorkerOptions, 'type'>) {
    const remoteWorkerKey = this.getRemoteWorkerKey(workerOptions.serverURL, { auth: workerOptions.auth });
    const existingWorker = this.class.remoteWorkers.get(remoteWorkerKey);

    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = new RemoteHttpInterceptorWorker({ ...workerOptions, type: 'remote' });
    this.class.remoteWorkers.set(remoteWorkerKey, createdWorker);

    return createdWorker;
  }

  deleteRemoteWorker(baseURL: URL, options: RemoteWorkerKeyOptions) {
    const remoteWorkerKey = this.getRemoteWorkerKey(baseURL, options);
    this.class.remoteWorkers.delete(remoteWorkerKey);
  }
}

export default HttpInterceptorStore;
