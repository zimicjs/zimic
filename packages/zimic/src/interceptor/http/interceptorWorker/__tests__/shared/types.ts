import { PossiblePromise } from '@/types/utils';
import { AccessResources } from '@tests/utils/workers';

import { HttpInterceptorWorkerPlatform, HttpInterceptorWorkerType } from '../../types/options';

export interface SharedHttpInterceptorWorkerTestOptions {
  platform: HttpInterceptorWorkerPlatform;
  startServer?: () => PossiblePromise<void>;
  getAccessResources: (type: HttpInterceptorWorkerType) => Promise<AccessResources>;
  stopServer?: () => PossiblePromise<void>;
}
