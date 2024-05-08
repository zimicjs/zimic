import LocalHttpInterceptorWorker from '../interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../interceptorWorker/RemoteHttpInterceptorWorker';
import { AnyHttpInterceptorClient } from './HttpInterceptorClient';

abstract class HttpInterceptorStore {
  abstract numberOfRunningInterceptors(options: {}): number;

  abstract markInterceptorAsRunning(interceptor: AnyHttpInterceptorClient, isRunning: boolean, options: {}): void;

  abstract getOrCreateWorker(options: {}): LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker;
}

export default HttpInterceptorStore;
