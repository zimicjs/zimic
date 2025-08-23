import { PossiblePromise } from '@zimic/utils/types';
import { expect } from 'vitest';

import TimesCheckError from '../../errors/TimesCheckError';
import TimesDeclarationPointer from '../../errors/TimesDeclarationPointer';

export async function expectTimesCheckError(
  callback: () => PossiblePromise<void>,
  options: {
    message: string;
    expectedNumberOfRequests: number | { min: number; max: number };
  },
) {
  const { message } = options;

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

  const expectedMessage = [
    message,
    '',
    'Learn more: https://zimic.dev/docs/interceptor/api/http-request-handler#handlertimes',
  ].join('\n');

  expect(timesCheckError!.message).toEqual(expectedMessage);

  const timesDeclarationPointer = timesCheckError!.cause! as TimesDeclarationPointer;
  expect(timesDeclarationPointer).toBeInstanceOf(TimesDeclarationPointer);

  if (typeof options.expectedNumberOfRequests === 'number') {
    expect(timesDeclarationPointer.name).toBe(`handler.times(${options.expectedNumberOfRequests})`);
  } else {
    expect(timesDeclarationPointer.name).toBe(
      `handler.times(${options.expectedNumberOfRequests.min}, ${options.expectedNumberOfRequests.max})`,
    );
  }

  expect(timesDeclarationPointer.message).toBe('declared at:');
}
