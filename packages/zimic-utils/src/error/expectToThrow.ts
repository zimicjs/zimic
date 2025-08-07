import { PossiblePromise } from '@/types';

export class ExpectedToThrowError extends Error {
  constructor() {
    super('Expected an error to be thrown, but succeeded instead.');
  }
}

async function expectToThrow<ExpectedError extends Error = Error>(
  promiseOrCallback: Promise<unknown> | (() => PossiblePromise<unknown>),
  isExpectedError: (error: unknown) => error is ExpectedError,
): Promise<ExpectedError> {
  try {
    if (promiseOrCallback instanceof Promise) {
      await promiseOrCallback;
    } else {
      await promiseOrCallback();
    }
    throw new ExpectedToThrowError();
  } catch (error) {
    if (error instanceof ExpectedToThrowError) {
      throw error;
    }

    if (!isExpectedError(error)) {
      throw error;
    }

    return error;
  }
}

export default expectToThrow;
