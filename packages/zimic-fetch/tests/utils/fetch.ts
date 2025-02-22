import { expect } from 'vitest';

function getFetchErrorMessageRegex() {
  const errorMessageOptions = ['fetch failed', 'Failed to fetch'];
  return new RegExp(`^${errorMessageOptions.join('|')}$`);
}

export async function expectFetchError(responsePromise: Promise<Response>) {
  const errorMessageExpression = getFetchErrorMessageRegex();
  await expect(responsePromise).rejects.toThrowError(errorMessageExpression);
}
