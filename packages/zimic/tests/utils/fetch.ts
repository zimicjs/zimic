import { expect } from 'vitest';

import { DEFAULT_ACCESS_CONTROL_HEADERS, DEFAULT_PREFLIGHT_STATUS_CODE } from '@/interceptor/server/constants';

interface ExpectFetchErrorOptions {
  canBeAborted?: boolean;
}

export async function expectFetchError(fetchPromise: Promise<Response>, options: ExpectFetchErrorOptions = {}) {
  const { canBeAborted = false } = options;

  const errorMessageOptions = [
    'fetch failed',
    'Failed to fetch',
    canBeAborted && 'This operation was aborted',
    canBeAborted && 'The user aborted a request.',
  ].filter((option): option is string => typeof option === 'string');

  const errorMessageExpression = new RegExp(`^${errorMessageOptions.join('|')}$`);
  await expect(fetchPromise).rejects.toThrowError(errorMessageExpression);
}

export async function expectFetchErrorOrPreflightResponse(
  fetchPromise: Promise<Response>,
  options: { shouldBePreflight: boolean } & ExpectFetchErrorOptions,
) {
  if (options.shouldBePreflight) {
    const response = await fetchPromise;
    expect(response.status).toBe(DEFAULT_PREFLIGHT_STATUS_CODE);
    expect(await response.text()).toBe('');

    for (const [header, value] of Object.entries(DEFAULT_ACCESS_CONTROL_HEADERS)) {
      expect(response.headers.get(header)).toBe(value);
    }
  } else {
    await expectFetchError(fetchPromise, options);
  }
}
