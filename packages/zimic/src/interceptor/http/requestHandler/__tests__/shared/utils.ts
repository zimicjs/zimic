import { expect } from 'vitest';

import TimesCheckError from '../../errors/TimesCheckError';
import TimesDeclarationPointer from '../../errors/TimesDeclarationPointer';

export async function expectTimesCheckError(
  callback: () => Promise<void> | void,
  options: {
    message: string;
  } & (
    | {
        numberOfRequests: number;
      }
    | {
        minNumberOfRequests: number;
        maxNumberOfRequests?: number;
      }
  ),
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
    'Learn more: https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes',
  ].join('\n');

  expect(timesCheckError!.message).toEqual(expectedMessage);

  const timesDeclarationPointer = timesCheckError!.cause! as TimesDeclarationPointer;
  expect(timesDeclarationPointer).toBeInstanceOf(TimesDeclarationPointer);

  if ('numberOfRequests' in options) {
    expect(timesDeclarationPointer.name).toBe(`handler.times(${options.numberOfRequests})`);
  } else if (options.maxNumberOfRequests === undefined) {
    expect(timesDeclarationPointer.name).toBe(`handler.times(${options.minNumberOfRequests})`);
  } else {
    expect(timesDeclarationPointer.name).toBe(
      `handler.times(${options.minNumberOfRequests}, ${options.maxNumberOfRequests})`,
    );
  }

  expect(timesDeclarationPointer.message).toBe('declared at:');
}
