import { describe } from 'vitest';

import { HttpInterceptorType } from '@/interceptor/http/interceptor/types/options';

import LocalHttpRequestHandler from '../../LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '../../RemoteHttpRequestHandler';
import { declareDefaultHttpRequestHandlerTests } from './default';
import { declareRestrictionHttpRequestHandlerTests } from './restrictions';
import { SharedHttpRequestHandlerTestOptions } from './types';

export function declareSharedHttpRequestHandlerTests(options: SharedHttpRequestHandlerTestOptions) {
  const optionsArray: [
    { type: HttpInterceptorType; Handler: typeof LocalHttpRequestHandler },
    { type: HttpInterceptorType; Handler: typeof RemoteHttpRequestHandler },
  ] = [
    { type: 'local', Handler: LocalHttpRequestHandler },
    { type: 'remote', Handler: RemoteHttpRequestHandler },
  ];

  describe.each(optionsArray)('Shared (type $workerOptions.type)', ({ type, Handler }) => {
    describe('Default', () => {
      declareDefaultHttpRequestHandlerTests({ ...options, type, Handler });
    });

    describe('Restrictions', () => {
      declareRestrictionHttpRequestHandlerTests({ ...options, type, Handler });
    });
  });
}
