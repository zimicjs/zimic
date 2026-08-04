import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';
import { expect } from 'vitest';

import WebSocketTimesCheckError from '../../../errors/WebSocketTimesCheckError';
import WebSocketTimesDeclarationPointer from '../../../errors/WebSocketTimesDeclarationPointer';
import { WebSocketInterceptorPlatform, WebSocketInterceptorType } from '../../../interceptor/types/options';

export interface SharedWebSocketMessageHandlerTestOptions {
  platform: WebSocketInterceptorPlatform;
  startServer?: () => PossiblePromise<void>;
  stopServer?: () => PossiblePromise<void>;
  getBaseURL: (type: WebSocketInterceptorType) => PossiblePromise<string>;
}

export type ChatMessage =
  | {
      type: 'create';
      body: { text: string; priority?: number };
    }
  | {
      type: 'delete';
      id: string;
    };

export type Schema = WebSocketSchema<ChatMessage>;

export function createBinaryMessage(firstByte: number, secondByte: number) {
  const message = new ArrayBuffer(2);
  const messageView = new Uint8Array(message);
  messageView[0] = firstByte;
  messageView[1] = secondByte;
  return message;
}

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
      timesCheckError = error as WebSocketTimesCheckError;
      throw error;
    }
  }).rejects.toThrow(WebSocketTimesCheckError);

  expect(timesCheckError).toBeDefined();
  expect(timesCheckError!.name).toBe('WebSocketTimesCheckError');

  const expectedMessage = [
    options.message,
    options.unmatchedMessages && ['Unmatched messages:', '', options.unmatchedMessages].join('\n'),
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
