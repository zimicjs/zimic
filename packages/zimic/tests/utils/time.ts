import { waitForDelay } from '@/utils/time';

/* istanbul ignore next -- @preserve
 * Wait for timeouts are not expected in the normal execution of tests. */
function prepareWaitForTimeoutError(lastError: unknown, timeout: number) {
  const timeoutErrorMessage = `Assertion did not succeed after retrying for ${timeout}ms`;

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
  callback: () => Promise<ReturnType> | ReturnType,
  options: WaitForOptions = {},
): Promise<Awaited<ReturnType>> {
  const { timeout = 1000, interval = 50 } = options;

  return new Promise(async (resolve, reject) => {
    let isSettled = false;
    let lastError: unknown = null;

    /* istanbul ignore next -- @preserve
     * Wait for timeouts are not expected in the normal execution of tests. */
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
