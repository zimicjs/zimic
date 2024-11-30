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

export async function expectBypassedResponse(
  responsePromise: Promise<Response>,
  options: Pick<ExpectFetchErrorOptions, 'canBeAborted'> = {},
) {
  let response: Response;

  /* istanbul ignore next -- @preserve */
  // In rare cases, bypassed responses in browser local interceptors may time out. We do not know why that happens.
  // Thus, if a fetch error occurs, we check if it is a timeout. If so, we ignore it if the test does not expect it.
  try {
    response = await responsePromise;
  } catch (error) {
    const errorMessageExpression = getFetchErrorMessageRegex({
      canBeGenericFailure: false,
      canBeAborted: options.canBeAborted,
    });

    const isExpectedAbortError = error instanceof Error && errorMessageExpression.test(error.message);

    if (isExpectedAbortError) {
      return;
    } else {
      throw error;
    }
  }

  expect(response.status).toBe(GLOBAL_FALLBACK_SERVER_RESPONSE_STATUS);
  expect(Object.fromEntries(response.headers.entries())).toEqual(
    expect.objectContaining(GLOBAL_FALLBACK_SERVER_HEADERS),
  );

  expect(await response.text()).toBe('');
}
