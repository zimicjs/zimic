import { describe, expect, it } from 'vitest';

import MismatchedHttpInterceptorWorkerPlatform from '../errors/MismatchedHttpInterceptorWorkerPlatform';
import InternalHttpInterceptorWorker from '../InternalHttpInterceptorWorker';
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

    const interceptorWorker = new InternalHttpInterceptorWorker({
      platform: mismatchedPlatform,
    });
    expect(interceptorWorker.platform()).toBe(mismatchedPlatform);

    await expect(async () => {
      await interceptorWorker.start();
    }).rejects.toThrowError(new MismatchedHttpInterceptorWorkerPlatform(mismatchedPlatform));
  });
});
