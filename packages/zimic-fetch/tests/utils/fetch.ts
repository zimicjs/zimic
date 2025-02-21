import { expect } from 'vitest';

interface ExpectFetchErrorOptions {
  canBeGenericFailure?: boolean;
  canBeAborted?: boolean;
}

function getFetchErrorMessageRegex(options: ExpectFetchErrorOptions) {
  const { canBeGenericFailure = true, canBeAborted = false } = options;

  const errorMessageOptions = [
    canBeGenericFailure && 'fetch failed',
    canBeGenericFailure && 'Failed to fetch',
    canBeAborted && 'This operation was aborted',
    canBeAborted && 'signal is aborted without reason',
  ].filter((option) => option !== false);

  return new RegExp(`^${errorMessageOptions.join('|')}$`);
}

export async function expectFetchError(responsePromise: Promise<Response>, options: ExpectFetchErrorOptions = {}) {
  const errorMessageExpression = getFetchErrorMessageRegex(options);
  await expect(responsePromise).rejects.toThrowError(errorMessageExpression);
}
