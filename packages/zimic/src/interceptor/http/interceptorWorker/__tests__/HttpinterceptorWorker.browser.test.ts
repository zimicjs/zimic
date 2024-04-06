import { describe, expect, it } from 'vitest';

import UnknownHttpInterceptorWorkerPlatform from '../errors/UnknownHttpInterceptorWorkerPlatform';
import { createHttpInterceptorWorker } from '../factory';
import { HttpInterceptorWorkerPlatform } from '../types/options';
import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (browser)', () => {
  const platform: HttpInterceptorWorkerPlatform = 'browser';

  declareSharedHttpInterceptorWorkerTests({
    platform,
  });

  it(
    'should throw an error if trying to use a mismatched platform',
    async () => {
      const mismatchedPlatform: HttpInterceptorWorkerPlatform = 'node';
      expect(mismatchedPlatform).not.toBe(platform);

      const interceptorWorker = createHttpInterceptorWorker({
        platform: mismatchedPlatform,
      });
      expect(interceptorWorker.platform()).toBe(mismatchedPlatform);

      await expect(async () => {
        await interceptorWorker.start();
      }).rejects.toThrowError(new UnknownHttpInterceptorWorkerPlatform(mismatchedPlatform));
    },
    { timeout: 10000 },
  );
});
