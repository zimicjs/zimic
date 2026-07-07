import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import { expect, vi } from 'vitest';

import { createInternalWebSocketInterceptor } from '@tests/utils/interceptors';

import WebSocketTimesCheckError from '../../../errors/WebSocketTimesCheckError';
import WebSocketTimesDeclarationPointer from '../../../errors/WebSocketTimesDeclarationPointer';
import { WebSocketInterceptorMessageSaving, WebSocketInterceptorType } from '../../../interceptor/types/options';
import {
  InternalWebSocketInterceptorClient,
  InternalWebSocketInterceptorServer,
} from '../../../interceptor/WebSocketInterceptorHandle';
import { WebSocketHandlerConstructor } from '../../../interceptor/WebSocketInterceptorImplementation';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';

type DirectWebSocketMessageHandler<Schema extends WebSocketSchema> =
  | LocalWebSocketMessageHandler<Schema>
  | RemoteWebSocketMessageHandler<Schema>;

export async function readBytes(data: Blob | ArrayBuffer) {
  const arrayBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
  return Array.from(new Uint8Array(arrayBuffer));
}

export function createBinaryMessage(firstByte: number, secondByte: number) {
  const message = new ArrayBuffer(2);
  const messageView = new Uint8Array(message);
  messageView[0] = firstByte;
  messageView[1] = secondByte;
  return message;
}

export interface DirectWebSocketPeer<Schema extends WebSocketSchema> {
  handle: InternalWebSocketInterceptorClient<Schema>;
  sentMessages: WebSocketMessageData<Schema>[];
}

export interface DirectWebSocketMessageHandlerContext<Schema extends WebSocketSchema> {
  baseURL: string;
  interceptor: ReturnType<typeof createInternalWebSocketInterceptor<Schema>>;
  handler: DirectWebSocketMessageHandler<Schema>;
  sender: DirectWebSocketPeer<Schema>;
  receiver: InternalWebSocketInterceptorServer<Schema>;
  receivedMessages: WebSocketMessageData<Schema>[];
  createSender: (url?: string) => DirectWebSocketPeer<Schema>;
  handleMessage: (
    message: Schema,
    options?: { sender?: InternalWebSocketInterceptorClient<Schema> },
  ) => Promise<boolean>;
}

export async function usingDirectWebSocketMessageHandler<Schema extends WebSocketSchema>(
  options: {
    type: WebSocketInterceptorType;
    baseURL: string;
    Handler: WebSocketHandlerConstructor;
    messageSaving?: Partial<WebSocketInterceptorMessageSaving>;
  },
  callback: (context: DirectWebSocketMessageHandlerContext<Schema>) => PossiblePromise<void>,
) {
  const interceptor = createInternalWebSocketInterceptor<Schema>({
    type: options.type,
    baseURL: options.baseURL,
    ...(options.messageSaving ? { messageSaving: options.messageSaving } : {}),
  });
  interceptor.implementation.isRunning = true;

  const handler = new options.Handler<Schema>(interceptor.implementation) as DirectWebSocketMessageHandler<Schema>;
  interceptor.implementation.registerMessageHandler(handler);

  function createSender(url = options.baseURL) {
    const sentMessages: WebSocketMessageData<Schema>[] = [];
    const handle = interceptor.implementation.createClient(url, {
      send: vi.fn((data: WebSocketMessageData<Schema>) => {
        sentMessages.push(data);
      }),
    });
    interceptor.implementation.addClient(handle);
    return { handle, sentMessages };
  }

  const sender = createSender();
  const receivedMessages: WebSocketMessageData<Schema>[] = [];
  const receiver: InternalWebSocketInterceptorServer<Schema> = interceptor.implementation.server;
  vi.spyOn(receiver, 'send').mockImplementation((data: WebSocketMessageData<Schema>) => {
    receivedMessages.push(data);
  });

  try {
    await callback({
      baseURL: options.baseURL,
      interceptor,
      handler,
      sender,
      receiver,
      receivedMessages,
      createSender,
      handleMessage: (message, handleOptions = {}) =>
        interceptor.implementation.handleInterceptedMessage(message as WebSocketMessageData<Schema>, {
          sender: handleOptions.sender ?? sender.handle,
          receiver,
        }),
    });
  } finally {
    await interceptor.implementation.clear();
    interceptor.implementation.isRunning = false;
  }
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
    'Learn more: https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlertimes',
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
