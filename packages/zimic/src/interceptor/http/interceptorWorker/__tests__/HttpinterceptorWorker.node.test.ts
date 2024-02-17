import { describe, expect, it } from 'vitest';

import MismatchedHttpInterceptorWorkerPlatform from '../errors/MismatchedHttpInterceptorWorkerPlatform';
import { createHttpInterceptorWorker } from '../factory';
import { HttpInterceptorWorkerPlatform } from '../types/options';
import { declareSharedHttpInterceptorWorkerTests } from './shared/workerTests';

describe('HttpInterceptorWorker (Node.js)', () => {
  const platform: HttpInterceptorWorkerPlatform = 'node';

  declareSharedHttpInterceptorWorkerTests({
    platform,
  });

  it('should throw an error if trying to use a mismatched platform', async () => {
    const mismatchedPlatform: HttpInterceptorWorkerPlatform = 'browser';
    expect(mismatchedPlatform).not.toBe(platform);

    const interceptorWorker = createHttpInterceptorWorker({
      platform: mismatchedPlatform,
    });
    expect(interceptorWorker.platform()).toBe(mismatchedPlatform);

    await expect(async () => {
      await interceptorWorker.start();
    }).rejects.toThrowError(new MismatchedHttpInterceptorWorkerPlatform(mismatchedPlatform));
  });
});
