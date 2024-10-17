import { HttpInterceptorPlatform, HttpInterceptorType } from '@/interceptor/http/interceptor/types/options';
import { PossiblePromise } from '@/types/utils';
import { ExtendedURL } from '@/utils/urls';

import { HttpInterceptorWorkerOptions } from '../../types/options';

export interface SharedHttpInterceptorWorkerTestOptions {
  platform: HttpInterceptorPlatform;
  defaultWorkerOptions: HttpInterceptorWorkerOptions;
  startServer?: () => PossiblePromise<void>;
  getBaseURL: (type: HttpInterceptorType) => Promise<ExtendedURL>;
  stopServer?: () => PossiblePromise<void>;
}
