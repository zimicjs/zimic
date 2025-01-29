import { expect } from 'vitest';

import TimesCheckError from '../../errors/TimesCheckError';
import TimesDeclarationError from '../../errors/TimesDeclarationError';

export async function expectTimesCheckError(
  callback: () => Promise<void> | void,
  options: {
    firstLine: string;
  } & ({ numberOfRequests: number } | { minNumberOfRequests: number; maxNumberOfRequests?: number }),
) {
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

  expect(timesCheckError!.message).toEqual(
    [
      firstLine,
      '',
      'Learn more: https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes',
    ].join('\n'),
  );

  const timesDeclarationError = timesCheckError!.cause! as TimesDeclarationError;
  expect(timesDeclarationError).toBeInstanceOf(TimesDeclarationError);

  if ('numberOfRequests' in options) {
    expect(timesDeclarationError.name).toBe(`handler.times(${options.numberOfRequests})`);
  } else if (options.maxNumberOfRequests === undefined) {
    expect(timesDeclarationError.name).toBe(`handler.times(${options.minNumberOfRequests})`);
  } else {
    expect(timesDeclarationError.name).toBe(
      `handler.times(${options.minNumberOfRequests}, ${options.maxNumberOfRequests})`,
    );
  }

  expect(timesDeclarationError.message).toBe('declared at:');
}
