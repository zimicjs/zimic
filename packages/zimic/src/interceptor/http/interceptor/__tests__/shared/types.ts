import { PossiblePromise } from '@/types/utils';
import { ExtendedURL } from '@/utils/urls';

import { HttpInterceptorPlatform, HttpInterceptorType, HttpInterceptorOptions } from '../../types/options';

export interface SharedHttpInterceptorTestsOptions {
  platform: HttpInterceptorPlatform;
  startServer?: () => PossiblePromise<void>;
  getBaseURL: (type: HttpInterceptorType) => Promise<ExtendedURL>;
  stopServer?: () => PossiblePromise<void>;
}

export interface RuntimeSharedHttpInterceptorTestsOptions
  extends Omit<SharedHttpInterceptorTestsOptions, 'getBaseURL'> {
  type: HttpInterceptorType;
  getBaseURL: () => ExtendedURL;
  getInterceptorOptions: () => HttpInterceptorOptions;
}
