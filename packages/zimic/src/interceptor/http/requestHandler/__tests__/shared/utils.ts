import { expect } from 'vitest';

import TimesCheckError from '../../errors/TimesCheckError';

export async function expectTimesCheckError(callback: () => Promise<void> | void, options: { firstLine: string }) {
  const { firstLine } = options;

  let timesCheckError: TimesCheckError | undefined;

  await expect(async () => {
    try {
      await callback();
    } catch (error) {
      /* istanbul ignore else -- @preserve
       * A times check error is always expected here. */
      if (error instanceof TimesCheckError) {
        timesCheckError = error;
      }
      throw error;
    }
  }).rejects.toThrowError(TimesCheckError);

  expect(timesCheckError).toBeDefined();
  expect(timesCheckError!.name).toBe('TimesCheckError');

  const splitMessage = timesCheckError!.message.split('\n');

  expect(splitMessage).toEqual([
    firstLine,
    '',
    'Learn more: https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes',
  ]);
}
