import { expectPossiblePromise } from '@tests/utils/promises';

import LocalHttpInterceptorWorker from '../../LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../../RemoteHttpInterceptorWorker';

export function promiseIfRemote<FulfilledResult>(
  value: FulfilledResult,
  worker: LocalHttpInterceptorWorker | RemoteHttpInterceptorWorker,
): FulfilledResult {
  return expectPossiblePromise(value, {
    shouldBePromise: worker instanceof RemoteHttpInterceptorWorker,
  });
}
