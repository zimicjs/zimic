import { PossiblePromise } from '@zimic/utils/types';
import { expect } from 'vitest';

import WebSocketTimesCheckError from '../../../errors/WebSocketTimesCheckError';
import WebSocketTimesDeclarationPointer from '../../../errors/WebSocketTimesDeclarationPointer';

export async function expectWebSocketTimesCheckError(
  callback: () => PossiblePromise<void>,
  options: {
    message: string;
    expectedNumberOfMessages: number | { min: number; max: number };
    unmatchedMessages?: string;
  },
) {
  let timesCheckError: WebSocketTimesCheckError | undefined;

  await expect(async () => {
    try {
      await callback();
    } catch (error) {
      if (error instanceof WebSocketTimesCheckError) {
        timesCheckError = error;
      }
      throw error;
    }
  }).rejects.toThrow(WebSocketTimesCheckError);

  expect(timesCheckError).toBeDefined();
  expect(timesCheckError!.name).toBe('WebSocketTimesCheckError');

  const expectedMessage = [
    options.message,
    options.unmatchedMessages && ['Unmatched messages:', '', options.unmatchedMessages].join('\n'),
    'Learn more: https://zimic.dev/docs/interceptor/api/http-message-handler#handlertimes',
  ]
    .filter(Boolean)
    .join('\n\n');

  expect(timesCheckError!.message).toEqual(expectedMessage);

  const timesDeclarationPointer = timesCheckError!.cause! as WebSocketTimesDeclarationPointer;
  expect(timesDeclarationPointer).toBeInstanceOf(WebSocketTimesDeclarationPointer);

  if (typeof options.expectedNumberOfMessages === 'number') {
    expect(timesDeclarationPointer.name).toBe(`handler.times(${options.expectedNumberOfMessages})`);
  } else {
    expect(timesDeclarationPointer.name).toBe(
      `handler.times(${options.expectedNumberOfMessages.min}, ${options.expectedNumberOfMessages.max})`,
    );
  }

  expect(timesDeclarationPointer.message).toBe('declared at:');
}
