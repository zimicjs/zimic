import { expect } from 'vitest';

export async function expectFetchError(
  value: Promise<unknown> | (() => Promise<unknown>),
  options: { canBeAborted?: boolean } = {},
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
