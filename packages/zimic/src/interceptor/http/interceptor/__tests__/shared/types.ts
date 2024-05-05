import LocalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/RemoteHttpInterceptorWorker';
import { PossiblePromise } from '@/types/utils';
import { AccessResources } from '@tests/utils/workers';

import { HttpInterceptorPlatform, HttpInterceptorType, HttpInterceptorOptions } from '../../types/options';

export interface SharedHttpInterceptorTestsOptions {
  platform: HttpInterceptorPlatform;
  startServer?: () => PossiblePromise<void>;
  getAccessResources: (type: HttpInterceptorType) => Promise<AccessResources>;
  stopServer?: () => PossiblePromise<void>;
}

export interface RuntimeSharedHttpInterceptorTestsOptions extends SharedHttpInterceptorTestsOptions {
  type: HttpInterceptorType;
  getWorker: () => LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker;
  getBaseURL: () => string;
  getPathPrefix: () => string;
  getInterceptorOptions: () => HttpInterceptorOptions;
}
