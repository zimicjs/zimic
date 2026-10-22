import { PossiblePromise } from '@zimic/utils/types';

import { HttpInterceptorPlatform, HttpInterceptorType } from '@/http/interceptor/types/options';

export interface SharedHttpInterceptorWorkerTestOptions {
  platform: HttpInterceptorPlatform;
  type: HttpInterceptorType;
  startServer?: () => PossiblePromise<void>;
  getBaseURL: (type: HttpInterceptorType) => PossiblePromise<string>;
  stopServer?: () => PossiblePromise<void>;
}
