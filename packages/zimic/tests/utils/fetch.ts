import { expect } from 'vitest';

import { DEFAULT_ACCESS_CONTROL_HEADERS, DEFAULT_PREFLIGHT_STATUS_CODE } from '@/interceptor/server/constants';
import { GLOBAL_FALLBACK_SERVER_RESPONSE_STATUS, GLOBAL_FALLBACK_SERVER_HEADERS } from '@tests/setup/global/shared';

export async function expectPreflightResponse(responsePromise: Promise<Response>) {
  const response = await responsePromise;
  expect(response.status).toBe(DEFAULT_PREFLIGHT_STATUS_CODE);
  expect(await response.text()).toBe('');

  for (const [header, value] of Object.entries(DEFAULT_ACCESS_CONTROL_HEADERS)) {
    expect(response.headers.get(header)).toBe(value);
  }
}

interface ExpectFetchErrorOptions {
  canBeAborted?: boolean;
}

export async function expectFetchError(responsePromise: Promise<Response>, options: ExpectFetchErrorOptions = {}) {
  const { canBeAborted = false } = options;

  const errorMessageOptions = [
    'fetch failed',
    'Failed to fetch',
    canBeAborted && 'This operation was aborted',
    canBeAborted && 'signal is aborted without reason',
  ].filter((option) => option !== false);

  const errorMessageExpression = new RegExp(`^${errorMessageOptions.join('|')}$`);
  await expect(responsePromise).rejects.toThrowError(errorMessageExpression);
}

export async function expectBypassedResponse(responsePromise: Promise<Response>) {
  const response = await responsePromise;

  expect(response.status).toBe(GLOBAL_FALLBACK_SERVER_RESPONSE_STATUS);
  expect(Object.fromEntries(response.headers.entries())).toEqual(
    expect.objectContaining(GLOBAL_FALLBACK_SERVER_HEADERS),
  );

  expect(await response.text()).toBe('');
}
