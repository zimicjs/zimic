import LocalHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/RemoteHttpInterceptorWorker';
import {
  HttpInterceptorWorkerPlatform,
  HttpInterceptorWorkerType,
} from '@/interceptor/http/interceptorWorker/types/options';
import { PossiblePromise } from '@/types/utils';
import { AccessResources } from '@tests/utils/workers';

import { HttpInterceptorOptions } from '../../types/options';

export interface SharedHttpInterceptorTestsOptions {
  platform: HttpInterceptorWorkerPlatform;
  startServer?: () => PossiblePromise<void>;
  getAccessResources: (type: HttpInterceptorWorkerType) => Promise<AccessResources>;
  stopServer?: () => PossiblePromise<void>;
}

export interface RuntimeSharedHttpInterceptorTestsOptions extends SharedHttpInterceptorTestsOptions {
  type: HttpInterceptorWorkerType;
  getWorker: () => LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker;
  getBaseURL: () => string;
  getPathPrefix: () => string;
  getInterceptorOptions: () => HttpInterceptorOptions;
}
