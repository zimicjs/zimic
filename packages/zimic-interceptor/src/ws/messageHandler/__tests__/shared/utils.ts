import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { expect } from 'vitest';

import WebSocketTimesCheckError from '../../../errors/WebSocketTimesCheckError';
import WebSocketTimesDeclarationPointer from '../../../errors/WebSocketTimesDeclarationPointer';

export async function usingWebSocketClient<Schema extends WebSocketSchema>(
  baseURL: string,
  callback: (client: WebSocketClient<Schema>) => PossiblePromise<void>,
) {
  const client = new WebSocketClient<Schema>(baseURL);

  try {
    await client.open();
    await callback(client);
  } finally {
    await client.close();
  }
}

export async function waitForWebSocketMessage<Schema extends WebSocketSchema>(client: WebSocketClient<Schema>) {
  const event = await new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
    client.addEventListener('message', resolve, { once: true });
  });

  if (typeof event.data === 'string' && /^[{[]/.test(event.data.trim())) {
    return JSON.parse(event.data);
  }

  return event.data;
}

export async function readBytes(data: Blob | BufferSource) {
  const arrayBuffer = data instanceof Blob ? await data.arrayBuffer() : data;

  if (arrayBuffer instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(arrayBuffer));
  }

  return Array.from(new Uint8Array(arrayBuffer.buffer, arrayBuffer.byteOffset, arrayBuffer.byteLength));
}

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
