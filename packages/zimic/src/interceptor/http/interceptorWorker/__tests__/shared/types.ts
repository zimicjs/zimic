import { HttpInterceptorPlatform, HttpInterceptorType } from '@/interceptor/http/interceptor/types/options';
import { PossiblePromise } from '@/types/utils';
import { AccessResources } from '@tests/utils/workers';

export interface SharedHttpInterceptorWorkerTestOptions {
  platform: HttpInterceptorPlatform;
  startServer?: () => PossiblePromise<void>;
  getAccessResources: (type: HttpInterceptorType) => Promise<AccessResources>;
  stopServer?: () => PossiblePromise<void>;
}
