import { HttpSearchParams } from '@zimic/utils/http';
import { WebSocketMessageData, WebSocketMessageSchema, WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';

import { serializeWebSocketMessageDataForSocket } from '../utils/messageData';
import type {
  InterceptedWebSocketInterceptorMessage,
  WebSocketInterceptorClient,
  WebSocketInterceptorServer,
  WebSocketInterceptorServerSendOptions,
} from './types/messages';
import type { WebSocketInterceptorProtocol, WebSocketInterceptorProtocolFrame } from './types/protocol';

export interface InternalWebSocketInterceptorClient<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> extends WebSocketInterceptorClient<Schema, Path> {
  messages: InterceptedWebSocketInterceptorMessage<Schema, Path>[];
  readonly connectionId: string;
  sendFrame: (frame: WebSocketInterceptorProtocolFrame) => void;
}

export const MAX_CLOSE_REASON_BYTE_LENGTH = 123;

const MAX_UNSIGNED_SHORT = 2 ** 16 - 1;

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

export function isUserCloseCode(code: number) {
  return code === 1000 || (code >= 3000 && code <= 4999);
}

type WebSocketInterceptorClientCloser = (code?: number, reason?: string) => void;

type SendWebSocketInterceptorClientMessage = (data: WebSocketMessageData<WebSocketMessageSchema>) => void;

// Workers create clients for connections of any path and interceptor, so a client is schema-erased when created.
class WebSocketInterceptorClientImplementation implements InternalWebSocketInterceptorClient {
  #sendMessage: SendWebSocketInterceptorClientMessage;
  #closeConnection: WebSocketInterceptorClientCloser;
  #protocol: WebSocketInterceptorProtocol | undefined;

  searchParams: HttpSearchParams;
  messages: InterceptedWebSocketInterceptorMessage<WebSocketSchema>[] = [];

  constructor(
    public url: string,
    public protocols: readonly string[],
    public connectionId: string,
    sendMessage: SendWebSocketInterceptorClientMessage,
    closeConnection: WebSocketInterceptorClientCloser,
    protocol: WebSocketInterceptorProtocol | undefined,
  ) {
    this.searchParams = new HttpSearchParams(new URL(url).searchParams);
    this.#sendMessage = sendMessage;
    this.#closeConnection = closeConnection;
    this.#protocol = protocol;
  }

  send(data: WebSocketMessageSchema | WebSocketMessageData<WebSocketMessageSchema>) {
    // A protocol encodes the message itself, including binary values JSON would lose.
    if (!this.#protocol) {
      this.#sendMessage(serializeWebSocketMessageDataForSocket<WebSocketMessageSchema>(data));
      return;
    }

    for (const frame of this.#protocol.encode(data, this)) {
      this.sendFrame(frame);
    }
  }

  sendFrame(frame: WebSocketInterceptorProtocolFrame) {
    this.#sendMessage(frame);
  }

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

    this.#closeConnection(code, code === undefined ? undefined : reason);
  }
}

export function createWebSocketInterceptorClient(options: {
  url: string;
  protocols: readonly string[];
  connectionId: string;
  send: SendWebSocketInterceptorClientMessage;
  close: WebSocketInterceptorClientCloser;
  protocol: WebSocketInterceptorProtocol | undefined;
}): InternalWebSocketInterceptorClient {
  return new WebSocketInterceptorClientImplementation(
    options.url,
    options.protocols,
    options.connectionId,
    options.send,
    options.close,
    options.protocol,
  );
}

export interface InternalWebSocketInterceptorServer<
  Schema extends WebSocketSchema,
> extends WebSocketInterceptorServer<Schema> {
  messages: InterceptedWebSocketInterceptorMessage<Schema>[];
}

type SendWebSocketInterceptorServerMessage<Schema extends WebSocketSchema> = (
  data: WebSocketSchemaMessage<Schema> | WebSocketMessageData<WebSocketSchemaMessage<Schema>>,
  options?: WebSocketInterceptorServerSendOptions<Schema>,
) => void;

class WebSocketInterceptorServerImplementation<
  Schema extends WebSocketSchema,
> implements InternalWebSocketInterceptorServer<Schema> {
  #getURL: () => string;
  #sendMessage: SendWebSocketInterceptorServerMessage<Schema>;

  readonly messages: InterceptedWebSocketInterceptorMessage<Schema>[] = [];

  constructor(getURL: () => string, sendMessage: SendWebSocketInterceptorServerMessage<Schema>) {
    this.#getURL = getURL;
    this.#sendMessage = sendMessage;
  }

  get url() {
    return this.#getURL();
  }

  send(
    data: WebSocketSchemaMessage<Schema> | WebSocketMessageData<WebSocketSchemaMessage<Schema>>,
    options?: WebSocketInterceptorServerSendOptions<Schema>,
  ) {
    this.#sendMessage(data, options);
  }
}

export function createWebSocketInterceptorServer<Schema extends WebSocketSchema>(
  getURL: () => string,
  send: SendWebSocketInterceptorServerMessage<Schema>,
): InternalWebSocketInterceptorServer<Schema> {
  return new WebSocketInterceptorServerImplementation(getURL, send);
}
