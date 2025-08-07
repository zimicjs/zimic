import { PossiblePromise } from '@zimic/utils/types';

import { HttpInterceptorPlatform, HttpInterceptorType } from '@/http/interceptor/types/options';

import { HttpInterceptorWorkerOptions } from '../../types/options';

export interface SharedHttpInterceptorWorkerTestOptions {
  platform: HttpInterceptorPlatform;
  defaultWorkerOptions: HttpInterceptorWorkerOptions;
  startServer?: () => PossiblePromise<void>;
  getBaseURL: (type: HttpInterceptorType) => Promise<string>;
  stopServer?: () => PossiblePromise<void>;
}
