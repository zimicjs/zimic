import { describe } from 'vitest';

import { HttpInterceptorOptions } from '../../types/options';
import { HttpInterceptor } from '../../types/public';
import { HttpInterceptorMethod, HttpInterceptorSchema } from '../../types/schema';
import { declareDefaultHttpInterceptorTests } from './default';
import { declareDeleteHttpInterceptorTests } from './methods/delete';
import { declareGetHttpInterceptorTests } from './methods/get';
import { declareHeadHttpInterceptorTests } from './methods/head';
import { declareOptionsHttpInterceptorTests } from './methods/options';
import { declarePatchHttpInterceptorTests } from './methods/patch';
import { declarePostHttpInterceptorTests } from './methods/post';
import { declarePutHttpInterceptorTests } from './methods/put';
import { declareTypeHttpInterceptorTests } from './typescript';

export function declareSharedHttpInterceptorTests(
  createInterceptor: <Schema extends HttpInterceptorSchema>(options: HttpInterceptorOptions) => HttpInterceptor<Schema>,
) {
  describe('Default', () => {
    declareDefaultHttpInterceptorTests(createInterceptor);
  });

  describe('Types', () => {
    declareTypeHttpInterceptorTests(createInterceptor);
  });

  describe('Methods', () => {
    const methodTestFactories: Record<HttpInterceptorMethod, () => void> = {
      GET: declareGetHttpInterceptorTests.bind(null, createInterceptor),
      POST: declarePostHttpInterceptorTests.bind(null, createInterceptor),
      PUT: declarePutHttpInterceptorTests.bind(null, createInterceptor),
      PATCH: declarePatchHttpInterceptorTests.bind(null, createInterceptor),
      DELETE: declareDeleteHttpInterceptorTests.bind(null, createInterceptor),
      HEAD: declareHeadHttpInterceptorTests.bind(null, createInterceptor),
      OPTIONS: declareOptionsHttpInterceptorTests.bind(null, createInterceptor),
    };

    for (const [method, methodTestFactory] of Object.entries(methodTestFactories)) {
      describe(method, () => {
        methodTestFactory();
      });
    }
  });
}
