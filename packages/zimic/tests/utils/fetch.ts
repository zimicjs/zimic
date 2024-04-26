import { expect } from 'vitest';

interface ExpectFetchErrorOptions {
  canBeAborted?: boolean;
}

export async function expectFetchError(
  value: Promise<unknown> | (() => Promise<unknown>),
  options: ExpectFetchErrorOptions = {},
) {
  const { canBeAborted = false } = options;

  const errorMessageOptions = [
    'fetch failed',
    'Failed to fetch',
    canBeAborted && 'This operation was aborted',
    canBeAborted && 'The user aborted a request.',
  ].filter((option): option is string => typeof option === 'string');

  const errorMessageExpression = new RegExp(`^${errorMessageOptions.join('|')}$`);
  await expect(value).rejects.toThrowError(errorMessageExpression);
}

export async function expectFetchErrorOrDefaultOptionsResponse(
  fetchPromise: Promise<Response>,
  options: { hasDefaultResponse: boolean } & ExpectFetchErrorOptions,
) {
  if (options.hasDefaultResponse) {
    const response = await fetchPromise;
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  } else {
    await expectFetchError(fetchPromise, options);
  }
}
