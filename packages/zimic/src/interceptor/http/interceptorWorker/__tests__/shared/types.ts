import { HttpInterceptorPlatform, HttpInterceptorType } from '@/interceptor/http/interceptor/types/options';
import { PossiblePromise } from '@/types/utils';
import { ExtendedURL } from '@/utils/urls';

export interface SharedHttpInterceptorWorkerTestOptions {
  platform: HttpInterceptorPlatform;
  startServer?: () => PossiblePromise<void>;
  getBaseURL: (type: HttpInterceptorType) => Promise<ExtendedURL>;
  stopServer?: () => PossiblePromise<void>;
}
