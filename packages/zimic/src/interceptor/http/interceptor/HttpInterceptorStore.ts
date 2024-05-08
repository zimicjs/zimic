import { ExtendedURL } from '@/utils/fetch';

import LocalHttpInterceptorWorker from '../interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../interceptorWorker/RemoteHttpInterceptorWorker';
import { AnyHttpInterceptorClient } from './HttpInterceptorClient';

abstract class HttpInterceptorStore {
  abstract numberOfRunningInterceptors(baseURL: ExtendedURL): number;

  abstract markInterceptorAsRunning(
    interceptor: AnyHttpInterceptorClient,
    isRunning: boolean,
    baseURL: ExtendedURL,
  ): void;

  abstract getOrCreateWorker(baseURL: ExtendedURL): LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker;
}

export default HttpInterceptorStore;
