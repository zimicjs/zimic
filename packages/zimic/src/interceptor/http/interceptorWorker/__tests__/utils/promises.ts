import { AnyLocalHttpInterceptor } from '@/interceptor/http/interceptor/LocalHttpInterceptor';
import { AnyRemoteHttpInterceptor } from '@/interceptor/http/interceptor/RemoteHttpInterceptor';
import { AnyLocalHttpRequestHandler } from '@/interceptor/http/requestHandler/LocalHttpRequestHandler';
import { AnyRemoteHttpRequestHandler } from '@/interceptor/http/requestHandler/RemoteHttpRequestHandler';
import { expectPossiblePromise } from '@tests/utils/promises';

import LocalHttpInterceptorWorker from '../../LocalHttpInterceptorWorker';
import RemoteHttpInterceptorWorker from '../../RemoteHttpInterceptorWorker';

export function promiseIfRemote<FulfilledResult>(
  value: FulfilledResult,
  comparisonEntity:
    | LocalHttpInterceptorWorker
    | RemoteHttpInterceptorWorker
    | AnyLocalHttpRequestHandler
    | AnyRemoteHttpRequestHandler
    | AnyRemoteHttpInterceptor
    | AnyLocalHttpInterceptor,
): FulfilledResult {
  return expectPossiblePromise(value, {
    shouldBePromise: comparisonEntity.type === 'remote',
  });
}
