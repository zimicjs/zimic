import { AnyLocalHttpInterceptor } from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import { AnyRemoteHttpInterceptor } from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import { expectPossiblePromise } from '@tests/utils/promises';

import LocalHttpInterceptorWorker from '../../LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../../RemoteHttpInterceptorWorker';

export function promiseIfRemote<FulfilledResult>(
  value: FulfilledResult,
  comparisonEntity:
    | LocalHttpInterceptorWorker
    | RemoteHttpInterceptorWorker
    | AnyLocalHttpInterceptor
    | AnyRemoteHttpInterceptor,
): FulfilledResult {
  return expectPossiblePromise(value, {
    shouldBePromise: comparisonEntity.type === 'remote',
  });
}
