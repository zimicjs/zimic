import { expect } from 'vitest';

import { PossiblePromise } from '@/types/utils';
import { waitForDelay } from '@/utils/time';

function prepareWaitForTimeoutError(lastError: unknown, timeout: number) {
  const timeoutErrorMessage = `Assertion did not succeed after retrying for ${timeout}ms`;

  /* istanbul ignore else -- @preserve
   * The else is a fallback for when the error is not an instance of Error. */
  if (lastError instanceof Error) {
    lastError.message = `${timeoutErrorMessage}: ${lastError.message}`;
    return lastError;
  } else {
    const genericError = new Error(timeoutErrorMessage);
    return genericError;
  }
}

export interface WaitForOptions {
  timeout?: number;
  interval?: number;
}

export function waitFor<ReturnType>(
  callback: () => PossiblePromise<ReturnType>,
  options: WaitForOptions = {},
): Promise<Awaited<ReturnType>> {
  const { timeout = 1000, interval = 50 } = options;

  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    let isSettled = false;
    let lastError: unknown = null;

    const waitRejectTimeout = setTimeout(() => {
      isSettled = true;
      const timeoutError = prepareWaitForTimeoutError(lastError, timeout);
      reject(timeoutError);
    }, timeout);

    while (!isSettled) {
      try {
        const result = await callback();
        clearTimeout(waitRejectTimeout);
        isSettled = true;
        resolve(result);
      } catch (error) {
        lastError = error;
        await waitForDelay(interval);
      }
    }
  });
}

export async function waitForNot(callback: () => PossiblePromise<void>, options?: WaitForOptions) {
  await expect(
    waitFor(callback, {
      timeout: 100,
      ...options,
    }),
  ).rejects.toThrowError();
}
