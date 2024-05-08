import { ExtendedURL } from '@/utils/fetch';

import { createHttpInterceptorWorker } from '../interceptorWorker/factory';
import RemoteHttpInterceptorWorker from '../interceptorWorker/RemoteHttpInterceptorWorker';
import { AnyHttpInterceptorClient } from './HttpInterceptorClient';
import HttpInterceptorStore from './HttpInterceptorStore';

class RemoteHttpInterceptorStore extends HttpInterceptorStore {
  private static workersByBaseURL = new Map<string, RemoteHttpInterceptorWorker>();
  private static runningInterceptors = new Map<string, Set<AnyHttpInterceptorClient>>();

  static worker(baseURL: ExtendedURL) {
    return this.workersByBaseURL.get(baseURL.toString());
  }

  static numberOfWorkers() {
    return this.workersByBaseURL.size;
  }

  private class = RemoteHttpInterceptorStore;

  numberOfRunningInterceptors(baseURL: ExtendedURL) {
    const runningInterceptors = this.class.runningInterceptors.get(baseURL.toString());
    return runningInterceptors?.size ?? 0;
  }

  markInterceptorAsRunning(interceptor: AnyHttpInterceptorClient, isRunning: boolean, baseURL: ExtendedURL) {
    const runningInterceptors =
      this.class.runningInterceptors.get(baseURL.toString()) ?? this.createRunningInterceptorsSet(baseURL);

    if (isRunning) {
      runningInterceptors.add(interceptor);
    } else {
      runningInterceptors.delete(interceptor);
    }
  }

  private createRunningInterceptorsSet(baseURL: ExtendedURL) {
    const runningInterceptors = new Set<AnyHttpInterceptorClient>();
    this.class.runningInterceptors.set(baseURL.toString(), runningInterceptors);
    return runningInterceptors;
  }

  getOrCreateWorker(baseURL: ExtendedURL) {
    const existingWorker = this.class.workersByBaseURL.get(baseURL.toString());
    if (existingWorker) {
      return existingWorker;
    }

    const createdWorker = createHttpInterceptorWorker({ type: 'remote', serverURL: baseURL });
    this.class.workersByBaseURL.set(baseURL.toString(), createdWorker);

    return createdWorker;
  }
}

export default RemoteHttpInterceptorStore;
