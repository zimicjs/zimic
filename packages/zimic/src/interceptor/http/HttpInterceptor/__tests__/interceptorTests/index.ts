import { describe } from 'vitest';

import { HttpInterceptorClass } from '../../types/classes';
import { HttpInterceptorMethod } from '../../types/schema';
import { createDefaultHttpInterceptorTests } from './default';
import { createDeleteHttpInterceptorTests } from './methods/delete';
import { createGetHttpInterceptorTests } from './methods/get';
import { createHeadHttpInterceptorTests } from './methods/head';
import { createOptionsHttpInterceptorTests } from './methods/options';
import { createPatchHttpInterceptorTests } from './methods/patch';
import { createPostHttpInterceptorTests } from './methods/post';
import { createPutHttpInterceptorTests } from './methods/put';
import { createTypeHttpInterceptorTests } from './typescript';

export function createHttpInterceptorTests<InterceptorClass extends HttpInterceptorClass>(
  Interceptor: InterceptorClass,
) {
  describe('Default', () => {
    createDefaultHttpInterceptorTests(Interceptor);
  });

  describe('Types', () => {
    createTypeHttpInterceptorTests(Interceptor);
  });

  describe('Methods', () => {
    const methodTestFactories: Record<HttpInterceptorMethod, () => void> = {
      GET: createGetHttpInterceptorTests.bind(null, Interceptor),
      POST: createPostHttpInterceptorTests.bind(null, Interceptor),
      PUT: createPutHttpInterceptorTests.bind(null, Interceptor),
      PATCH: createPatchHttpInterceptorTests.bind(null, Interceptor),
      DELETE: createDeleteHttpInterceptorTests.bind(null, Interceptor),
      HEAD: createHeadHttpInterceptorTests.bind(null, Interceptor),
      OPTIONS: createOptionsHttpInterceptorTests.bind(null, Interceptor),
    };

    for (const [method, methodTestFactory] of Object.entries(methodTestFactories)) {
      describe(method, () => {
        methodTestFactory();
      });
    }
  });
}
