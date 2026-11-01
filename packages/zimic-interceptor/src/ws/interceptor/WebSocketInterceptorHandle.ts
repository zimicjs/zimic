import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import type {
  InterceptedWebSocketInterceptorMessage,
  WebSocketInterceptorClient,
  WebSocketInterceptorServer,
  WebSocketInterceptorServerSendOptions,
  webSocketInterceptorClientRole,
  webSocketInterceptorServerRole,
} from './types/messages';

export interface InternalWebSocketInterceptorClient<
  Schema extends WebSocketSchema,
> extends WebSocketInterceptorClient<Schema> {
  messages: InterceptedWebSocketInterceptorMessage<Schema>[];
}

// The limit of `WebSocket.close()`, so the reason fits in a control frame after the close code.
const MAX_CLOSE_REASON_BYTE_LENGTH = 123;

const MAX_UNSIGNED_SHORT = 65535;

// The WebIDL `[Clamp] unsigned short` conversion `WebSocket.close()` applies to its code: NaN becomes 0, other values
// are clamped to the unsigned short range and rounded to the nearest integer, with ties to even.
function clampToUnsignedShort(value: number) {
  if (Number.isNaN(value)) {
    return 0;
  }

  const clampedValue = Math.min(Math.max(value, 0), MAX_UNSIGNED_SHORT);
  const integerPart = Math.floor(clampedValue);
  const fractionalPart = clampedValue - integerPart;

  const roundsUp = fractionalPart > 0.5 || (fractionalPart === 0.5 && integerPart % 2 === 1);
  return roundsUp ? integerPart + 1 : integerPart;
}

function isUserCloseCode(code: number) {
  return code === 1000 || (code >= 3000 && code <= 4999);
}

type WebSocketInterceptorClientCloser = (code?: number, reason?: string) => void;

class WebSocketInterceptorClientImplementation<
  Schema extends WebSocketSchema,
> implements InternalWebSocketInterceptorClient<Schema> {
  #sendMessage: (data: WebSocketMessageData<Schema>) => void;
  #closeConnection: WebSocketInterceptorClientCloser;

  declare readonly [webSocketInterceptorClientRole]: true;

  readonly messages: InterceptedWebSocketInterceptorMessage<Schema>[] = [];

  constructor(
    readonly url: string,
    sendMessage: (data: WebSocketMessageData<Schema>) => void,
    closeConnection: WebSocketInterceptorClientCloser,
  ) {
    this.#sendMessage = sendMessage;
    this.#closeConnection = closeConnection;
  }

  send(data: WebSocketMessageData<Schema>) {
    this.#sendMessage(data);
  }

  // Validates the arguments and throws the same errors as `WebSocket.close()`, even if the client is already closed.
  close(rawCode?: number, reason?: string) {
    const code = rawCode === undefined ? undefined : clampToUnsignedShort(rawCode);

    if (code !== undefined && !isUserCloseCode(code)) {
      throw new DOMException(
        `The close code must be either 1000, or between 3000 and 4999. ${code} is neither.`,
        'InvalidAccessError',
      );
    }

    if (reason !== undefined && new TextEncoder().encode(reason).byteLength > MAX_CLOSE_REASON_BYTE_LENGTH) {
      throw new DOMException(
        `The close reason must not be greater than ${MAX_CLOSE_REASON_BYTE_LENGTH} UTF-8 bytes.`,
        'SyntaxError',
      );
    }

    // A close frame without a code has no body, so the reason is sent only with a code.
    this.#closeConnection(code, code === undefined ? undefined : reason);
  }
}

export function createWebSocketInterceptorClient<Schema extends WebSocketSchema>(
  url: string,
  send: (data: WebSocketMessageData<Schema>) => void,
  close: WebSocketInterceptorClientCloser,
): InternalWebSocketInterceptorClient<Schema> {
  return new WebSocketInterceptorClientImplementation(url, send, close);
}

export interface InternalWebSocketInterceptorServer<
  Schema extends WebSocketSchema,
> extends WebSocketInterceptorServer<Schema> {
  messages: InterceptedWebSocketInterceptorMessage<Schema>[];
}

class WebSocketInterceptorServerImplementation<
  Schema extends WebSocketSchema,
> implements InternalWebSocketInterceptorServer<Schema> {
  #getURL: () => string;
  #sendMessage: (data: WebSocketMessageData<Schema>, options?: WebSocketInterceptorServerSendOptions<Schema>) => void;

  declare readonly [webSocketInterceptorServerRole]: true;

  readonly messages: InterceptedWebSocketInterceptorMessage<Schema>[] = [];

  constructor(
    getURL: () => string,
    sendMessage: (data: WebSocketMessageData<Schema>, options?: WebSocketInterceptorServerSendOptions<Schema>) => void,
  ) {
    this.#getURL = getURL;
    this.#sendMessage = sendMessage;
  }

  get url() {
    return this.#getURL();
  }

  send(data: WebSocketMessageData<Schema>, options?: WebSocketInterceptorServerSendOptions<Schema>) {
    this.#sendMessage(data, options);
  }
}

export function createWebSocketInterceptorServer<Schema extends WebSocketSchema>(
  getURL: () => string,
  send: (data: WebSocketMessageData<Schema>, options?: WebSocketInterceptorServerSendOptions<Schema>) => void,
): InternalWebSocketInterceptorServer<Schema> {
  return new WebSocketInterceptorServerImplementation(getURL, send);
}
