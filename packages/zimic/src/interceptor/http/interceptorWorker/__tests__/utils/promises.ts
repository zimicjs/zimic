import LocalHttpInterceptor from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import { expectPossiblePromise } from '@tests/utils/promises';

import LocalHttpInterceptorWorker from '../../LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../../RemoteHttpInterceptorWorker';

export function promiseIfRemote<FulfilledResult>(
  value: FulfilledResult,
  comparisonEntity:
    | LocalHttpInterceptorWorker
    | RemoteHttpInterceptorWorker
    | LocalHttpInterceptor<any> // eslint-disable-line @typescript-eslint/no-explicit-any
    | RemoteHttpInterceptor<any>, // eslint-disable-line @typescript-eslint/no-explicit-any,
): FulfilledResult {
  return expectPossiblePromise(value, {
    shouldBePromise: comparisonEntity.type === 'remote',
  });
}
