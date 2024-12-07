import { AnyHttpInterceptor, AnyInternalHttpInterceptor } from '@/interceptor/http/interceptor/types/public';
import { expectPossiblePromise } from '@tests/utils/promises';

import HttpInterceptorWorker from '../../HttpInterceptorWorker';

export function promiseIfRemote<FulfilledResult>(
  value: FulfilledResult,
  comparisonEntity: HttpInterceptorWorker | AnyHttpInterceptor | AnyInternalHttpInterceptor,
): FulfilledResult {
  return expectPossiblePromise(value, {
    shouldBePromise: comparisonEntity.type === 'remote',
  });
}
