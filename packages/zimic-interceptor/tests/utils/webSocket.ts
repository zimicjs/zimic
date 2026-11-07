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

// A native socket exposes the events of a connection that fails to open, which `WebSocketClient.open()` reports only as
// a rejection. Resolves on the first event of the connection, so callers close the sockets that opened. A refusal
// settles on `error` because some runtimes, such as Node 22, never dispatch `close` for a refused handshake.
export async function openWebSocketUntilSettled(url: string, protocols?: string | string[]) {
  const socket = new WebSocket(url, protocols);

  const settlingEvent = await new Promise<Event>((resolve) => {
    for (const type of ['open', 'error', 'close'] as const) {
      socket.addEventListener(type, resolve, { once: true });
    }
  });

  return {
    socket,
    eventTypes: [settlingEvent.type],
    closeEvent: settlingEvent.type === 'close' ? (settlingEvent as CloseEvent) : undefined,
  };
}

// A refused connection fails without opening, as when a server answers its handshake with an error.
export async function expectWebSocketConnectionToBeRefused(url: string, protocols?: string | string[]) {
  const { eventTypes } = await openWebSocketUntilSettled(url, protocols);
  expect(eventTypes).toEqual(['error']);
}

export async function expectWebSocketConnectionToOpen(url: string, protocols?: string | string[]) {
  const { socket, eventTypes } = await openWebSocketUntilSettled(url, protocols);

  try {
    expect(eventTypes).toEqual(['open']);
  } finally {
    socket.close();
  }
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
    expectedNumberOfMatches: number | { min: number; max: number };
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

  expect(timesCheckError!.message).toEqual(options.message);

  const timesDeclarationPointer = timesCheckError!.cause! as WebSocketTimesDeclarationPointer;
  expect(timesDeclarationPointer).toBeInstanceOf(WebSocketTimesDeclarationPointer);

  if (typeof options.expectedNumberOfMatches === 'number') {
    expect(timesDeclarationPointer.name).toBe(`handler.times(${options.expectedNumberOfMatches})`);
  } else {
    expect(timesDeclarationPointer.name).toBe(
      `handler.times(${options.expectedNumberOfMatches.min}, ${options.expectedNumberOfMatches.max})`,
    );
  }

  expect(timesDeclarationPointer.message).toBe('declared at:');
}
