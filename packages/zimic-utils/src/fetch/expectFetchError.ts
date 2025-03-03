import { expect } from 'vitest';

export interface ExpectFetchErrorOptions {
  canBeGenericFailure?: boolean;
  canBeAborted?: boolean;
}

export function createFetchErrorMessageRegExp(options: ExpectFetchErrorOptions) {
  const { canBeGenericFailure = true, canBeAborted = false } = options;

  const errorMessageOptions = [
    canBeGenericFailure && 'fetch failed',
    canBeGenericFailure && 'Failed to fetch',
    canBeAborted && 'The operation was aborted due to timeout',
    canBeAborted && 'signal timed out',
  ].filter((option) => option !== false);

  return new RegExp(`^${errorMessageOptions.join('|')}$`);
}

async function expectFetchError(responsePromise: Promise<Response>, options: ExpectFetchErrorOptions = {}) {
  await expect(responsePromise).rejects.toThrowError(createFetchErrorMessageRegExp(options));
}

export default expectFetchError;
