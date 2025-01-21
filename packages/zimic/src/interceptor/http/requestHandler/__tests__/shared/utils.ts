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

  const headerLines = splitMessage.slice(0, 3);
  expect(headerLines).toEqual([firstLine, '', 'The failed `handler.times()` was declared at: ']);

  const stackTraceLines = splitMessage.slice(3, -2);
  expect(stackTraceLines.length).toBeGreaterThan(1);

  expect(stackTraceLines[0]).toEqual(expect.stringMatching(/    [^ ]+\/src\/[^ ]+\/__tests__\/[^ ]+\.ts:\d+:\d+/));

  for (const stackTraceLine of stackTraceLines.slice(1)) {
    expect(stackTraceLine).toEqual(expect.stringMatching(/    at .+/));
  }

  expect(splitMessage.at(-2)).toBe('');
  expect(splitMessage.at(-1)).toBe(
    'Learn more: https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes',
  );
}
