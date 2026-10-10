import { expect, it, vi } from 'vitest';

import { createInternalWebSocketInterceptor } from '@tests/utils/interceptors';

import type { Schema } from '../../../messageHandler/__tests__/shared/types';

interface SharedWebSocketInterceptorTimesTestOptions {
  getBaseURL: () => string;
}

export function declareTimesWebSocketInterceptorTests(options: SharedWebSocketInterceptorTimesTestOptions) {
  const { getBaseURL } = options;

  it('should check times immediately and return a promise for synchronous failures', async () => {
    const interceptor = createInternalWebSocketInterceptor<Schema>({ type: 'remote', baseURL: getBaseURL() });
    const checkTimes = vi.spyOn(interceptor.implementation, 'checkTimes');

    const successfulCheck = interceptor.checkTimes();
    expect(checkTimes).toHaveBeenCalledOnce();
    expect(successfulCheck).toBeInstanceOf(Promise);
    await expect(successfulCheck).resolves.toBeUndefined();

    const error = new Error('times check failed');
    checkTimes.mockImplementationOnce(() => {
      throw error;
    });

    let failedCheck: Promise<void> | undefined;
    expect(() => {
      failedCheck = interceptor.checkTimes();
    }).not.toThrow();

    expect(checkTimes).toHaveBeenCalledTimes(2);
    expect(failedCheck).toBeInstanceOf(Promise);
    await expect(failedCheck).rejects.toBe(error);
  });
}
