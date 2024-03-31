import { describe } from 'vitest';

import { HttpMethod } from '@/http/types/schema';
import { HttpInterceptorWorkerPlatform } from '@/interceptor/http/interceptorWorker/types/options';

import { declareBaseURLHttpInterceptorTests } from './baseURLs';
import { declareDeleteHttpInterceptorTests } from './methods/delete';
import { declareGetHttpInterceptorTests } from './methods/get';
import { declareHeadHttpInterceptorTests } from './methods/head';
import { declareOptionsHttpInterceptorTests } from './methods/options';
import { declarePatchHttpInterceptorTests } from './methods/patch';
import { declarePostHttpInterceptorTests } from './methods/post';
import { declarePutHttpInterceptorTests } from './methods/put';
import { declareTypeHttpInterceptorTests } from './typescript';

export interface SharedHttpInterceptorTestsOptions {
  platform: HttpInterceptorWorkerPlatform;
}

export function declareSharedHttpInterceptorTests(options: SharedHttpInterceptorTestsOptions) {
  describe('Types', () => {
    declareTypeHttpInterceptorTests(options);
  });

  describe('Base URLs', () => {
    declareBaseURLHttpInterceptorTests(options);
  });

  describe('Methods', () => {
    const methodTestFactories: Record<HttpMethod, () => Promise<void> | void> = {
      GET: declareGetHttpInterceptorTests.bind(null, options),
      POST: declarePostHttpInterceptorTests.bind(null, options),
      PUT: declarePutHttpInterceptorTests.bind(null, options),
      PATCH: declarePatchHttpInterceptorTests.bind(null, options),
      DELETE: declareDeleteHttpInterceptorTests.bind(null, options),
      HEAD: declareHeadHttpInterceptorTests.bind(null, options),
      OPTIONS: declareOptionsHttpInterceptorTests.bind(null, options),
    };

    for (const [method, methodTestFactory] of Object.entries(methodTestFactories)) {
      describe(method, async () => {
        await methodTestFactory();
      });
    }
  });
}
