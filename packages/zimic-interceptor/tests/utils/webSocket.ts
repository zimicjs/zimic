import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { expect } from 'vitest';

import WebSocketTimesCheckError from '@/ws/errors/WebSocketTimesCheckError';
import WebSocketTimesDeclarationPointer from '@/ws/errors/WebSocketTimesDeclarationPointer';

export async function usingWebSocketClient<Schema extends WebSocketSchema>(
  url: string,
  callback: (client: WebSocketClient<Schema>) => PossiblePromise<void>,
) {
  const client = new WebSocketClient<Schema>(url);

  try {
    await client.open();
    await callback(client);
  } finally {
    await client.close();
  }
}

export function waitForWebSocketClientMessage<Schema extends WebSocketSchema>(client: WebSocketClient<Schema>) {
  return new Promise<WebSocketClient.MessageEvent<Schema>['data']>((resolve) => {
    client.addEventListener('message', (event) => resolve(event.data), { once: true });
  });
}

export function collectWebSocketClientMessages<Schema extends WebSocketSchema>(client: WebSocketClient<Schema>) {
  const messages: WebSocketClient.MessageEvent<Schema>['data'][] = [];

  client.addEventListener('message', (event) => {
    messages.push(event.data);
  });

  return messages;
}

export function waitForWebSocketClientClose<Schema extends WebSocketSchema>(client: WebSocketClient<Schema>) {
  return new Promise<WebSocketClient.CloseEvent<Schema>>((resolve) => {
    client.addEventListener('close', resolve, { once: true });
  });
}

export function createBinaryMessage(firstByte: number, secondByte: number) {
  const message = new ArrayBuffer(2);
  const messageView = new Uint8Array(message);
  messageView[0] = firstByte;
  messageView[1] = secondByte;
  return message;
}

export async function readBytes(data: Blob | ArrayBuffer) {
  const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new Uint8Array(data);
  return Array.from(bytes);
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
