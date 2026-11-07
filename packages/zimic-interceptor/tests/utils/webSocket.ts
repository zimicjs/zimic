import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { expect } from 'vitest';

import { isServerSide } from '@/utils/environment';
import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';
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

interface RefusedWebSocketBehavior {
  eventTypes: string[];
  closeCode: number | undefined;
  settlingEventTypes: ('open' | 'error' | 'close')[];
}

// Node 22's native WebSocket dispatches only `error` when a server refuses the handshake. Browsers and Node 24+ follow
// the spec and dispatch `error`, then `close` with an abnormal closure code. Remove this check when Node 22 support ends.
/* istanbul ignore next -- @preserve
 * Ignoring because each test run covers only the behavior of its Node.js version. */
const refusedWebSocketBehavior: RefusedWebSocketBehavior =
  isServerSide() && Number(process.versions.node.split('.')[0]) < 24
    ? { eventTypes: ['error'], closeCode: undefined, settlingEventTypes: ['open', 'error', 'close'] }
    : {
        eventTypes: ['error', 'close'],
        closeCode: WEB_SOCKET_CLOSE_CODES.ABNORMAL_CLOSURE,
        settlingEventTypes: ['open', 'close'],
      };

export const REFUSED_WEB_SOCKET_EVENT_TYPES = refusedWebSocketBehavior.eventTypes;
export const REFUSED_WEB_SOCKET_CLOSE_CODE = refusedWebSocketBehavior.closeCode;

// A native socket exposes the events of a connection that fails to open, which `WebSocketClient.open()` reports only as
// a rejection. Resolves once the connection opens, closes, or has its refusal settled, so callers close the sockets
// that opened.
export async function openWebSocketUntilSettled(url: string, protocols?: string | string[]) {
  const socket = new WebSocket(url, protocols);
  const eventTypes: string[] = [];

  for (const type of ['open', 'error', 'close'] as const) {
    socket.addEventListener(type, () => {
      eventTypes.push(type);
    });
  }

  // Snapshots the event types when the connection settles, because local interceptors may dispatch `close` in the same
  // tick as `error`.
  const settled = await new Promise<{ event: Event; eventTypes: string[] }>((resolve) => {
    for (const type of refusedWebSocketBehavior.settlingEventTypes) {
      socket.addEventListener(type, (event) => resolve({ event, eventTypes: [...eventTypes] }), { once: true });
    }
  });

  return {
    socket,
    eventTypes: settled.eventTypes,
    closeEvent: settled.event.type === 'close' ? (settled.event as CloseEvent) : undefined,
  };
}

export function expectWebSocketAttemptToBeRefused({
  eventTypes,
  closeEvent,
}: Awaited<ReturnType<typeof openWebSocketUntilSettled>>) {
  expect(eventTypes).toEqual(REFUSED_WEB_SOCKET_EVENT_TYPES);
  expect(closeEvent?.code).toBe(REFUSED_WEB_SOCKET_CLOSE_CODE);
}

// A refused connection fails without opening, as when a server answers its handshake with an error.
export async function expectWebSocketConnectionToBeRefused(url: string, protocols?: string | string[]) {
  expectWebSocketAttemptToBeRefused(await openWebSocketUntilSettled(url, protocols));
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
