import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HttpMethod } from '@/http/types/schema';
import { PossiblePromise } from '@/types/utils';
import { ExtendedURL } from '@/utils/urls';
import { createInternalHttpInterceptor } from '@tests/utils/interceptors';

import UnknownHttpInterceptorTypeError from '../../errors/UnknownHttpInterceptorTypeError';
import { HttpInterceptorType } from '../../types/options';
import { declareBaseURLHttpInterceptorTests } from './baseURLs';
import { declareBodyHttpInterceptorTests } from './bodies';
import { declareBypassHttpInterceptorTests } from './bypass';
import { declareClearHttpInterceptorTests } from './clear';
import { declareDeclareHttpInterceptorTests } from './default';
import { declareDynamicPathsHttpInterceptorTests } from './dynamicPaths';
import { declareDeleteHttpInterceptorTests } from './methods/delete';
import { declareGetHttpInterceptorTests } from './methods/get';
import { declareHeadHttpInterceptorTests } from './methods/head';
import { declareOptionsHttpInterceptorTests } from './methods/options';
import { declarePatchHttpInterceptorTests } from './methods/patch';
import { declarePostHttpInterceptorTests } from './methods/post';
import { declarePutHttpInterceptorTests } from './methods/put';
import { SharedHttpInterceptorTestsOptions, RuntimeSharedHttpInterceptorTestsOptions } from './types';
import { declareTypeHttpInterceptorTests } from './typescript';

export function declareSharedHttpInterceptorTests(options: SharedHttpInterceptorTestsOptions) {
  const { startServer, getBaseURL, stopServer } = options;

  it('should throw an error if created with an unknown type', () => {
    // @ts-expect-error Forcing an unknown type.
    const unknownType: HttpInterceptorType = 'unknown';

    expect(() => {
      // @ts-expect-error
      createInternalHttpInterceptor({ type: unknownType });
    }).toThrowError(new UnknownHttpInterceptorTypeError(unknownType));
  });

  const interceptorTypes: HttpInterceptorType[] = ['local', 'remote'];

  describe.each(interceptorTypes)("Type '%s'", (type) => {
    let baseURL: ExtendedURL;

    beforeAll(async () => {
      if (type === 'remote') {
        await startServer?.();
      }

      baseURL = await getBaseURL(type);
    });

    afterAll(async () => {
      if (type === 'remote') {
        await stopServer?.();
      }
    });

    const runtimeOptions: RuntimeSharedHttpInterceptorTestsOptions = {
      ...options,
      type,
      getBaseURL() {
        return baseURL;
      },
      getInterceptorOptions() {
        return { type, baseURL };
      },
    };

    describe('Default', () => {
      declareDeclareHttpInterceptorTests(runtimeOptions);
    });

    describe('Types', () => {
      declareTypeHttpInterceptorTests(runtimeOptions);
    });

    describe('Base URLs', () => {
      declareBaseURLHttpInterceptorTests(runtimeOptions);
    });

    describe('Bodies', async () => {
      await declareBodyHttpInterceptorTests(runtimeOptions);
    });

    describe('Dynamic paths', async () => {
      await declareDynamicPathsHttpInterceptorTests(runtimeOptions);
    });

    describe('Bypass', () => {
      declareBypassHttpInterceptorTests(runtimeOptions);
    });

    describe('Clear', () => {
      declareClearHttpInterceptorTests(runtimeOptions);
    });

    describe('Methods', () => {
      const methodTestFactories: Record<HttpMethod, () => PossiblePromise<void>> = {
        GET: declareGetHttpInterceptorTests.bind(null, runtimeOptions),
        POST: declarePostHttpInterceptorTests.bind(null, runtimeOptions),
        PUT: declarePutHttpInterceptorTests.bind(null, runtimeOptions),
        PATCH: declarePatchHttpInterceptorTests.bind(null, runtimeOptions),
        DELETE: declareDeleteHttpInterceptorTests.bind(null, runtimeOptions),
        HEAD: declareHeadHttpInterceptorTests.bind(null, runtimeOptions),
        OPTIONS: declareOptionsHttpInterceptorTests.bind(null, runtimeOptions),
      };

      for (const [method, methodTestFactory] of Object.entries(methodTestFactories)) {
        describe(method, async () => {
          await methodTestFactory();
        });
      }
    });
  });
}
