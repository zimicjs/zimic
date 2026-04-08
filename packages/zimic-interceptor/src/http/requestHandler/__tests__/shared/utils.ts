import { HttpMethodSchema, HttpStatusCode } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';
import { expect } from 'vitest';

import HttpTimesCheckError, { TimesCheckError } from '@/http/errors/HttpTimesCheckError';
import HttpTimesDeclarationPointer from '@/http/errors/HttpTimesDeclarationPointer';

import {
  HttpRequestHandlerResponseDeclaration,
  HttpRequestHandlerStatusResponseDeclaration,
} from '../../types/requests';

export async function expectHttpTimesCheckError(
  callback: () => PossiblePromise<void>,
  options: {
    message: string;
    expectedNumberOfRequests: number | { min: number; max: number };
  },
) {
  const { message } = options;

  let timesCheckError: HttpTimesCheckError | undefined;

  await expect(async () => {
    try {
      await callback();
    } catch (error) {
      /* istanbul ignore else -- @preserve
       * A times check error is always expected here. */
      if (error instanceof HttpTimesCheckError) {
        timesCheckError = error;
      }
      throw error;
    }
  }).rejects.toThrow(HttpTimesCheckError);

  expect(timesCheckError).toBeDefined();
  expect(timesCheckError).toBeInstanceOf(HttpTimesCheckError);
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  expect(timesCheckError).toBeInstanceOf(TimesCheckError);
  expect(timesCheckError!.name).toBe('HttpTimesCheckError');

  const expectedMessage = [
    message,
    '',
    'Learn more: https://zimic.dev/docs/interceptor/api/http-request-handler#handlertimes',
  ].join('\n');

  expect(timesCheckError!.message).toEqual(expectedMessage);

  const timesDeclarationPointer = timesCheckError!.cause! as HttpTimesDeclarationPointer;
  expect(timesDeclarationPointer).toBeInstanceOf(HttpTimesDeclarationPointer);

  if (typeof options.expectedNumberOfRequests === 'number') {
    expect(timesDeclarationPointer.name).toBe(`handler.times(${options.expectedNumberOfRequests})`);
  } else {
    expect(timesDeclarationPointer.name).toBe(
      `handler.times(${options.expectedNumberOfRequests.min}, ${options.expectedNumberOfRequests.max})`,
    );
  }

  expect(timesDeclarationPointer.message).toBe('declared at:');
}

export function expectStatusResponseDeclaration<
  MethodSchema extends HttpMethodSchema = HttpMethodSchema,
  StatusCode extends HttpStatusCode = HttpStatusCode,
>(
  declaration: HttpRequestHandlerResponseDeclaration<MethodSchema, StatusCode>,
): asserts declaration is HttpRequestHandlerStatusResponseDeclaration<MethodSchema, StatusCode> {
  expect(declaration).toHaveProperty('status');
  expect(declaration).not.toHaveProperty('action');
}
