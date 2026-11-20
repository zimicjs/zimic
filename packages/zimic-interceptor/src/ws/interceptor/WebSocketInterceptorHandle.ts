import { HttpSearchParams } from '@zimic/utils/http';
import { IfNever } from '@zimic/utils/types';
import { WebSocketMessageData, WebSocketMessageSchema, WebSocketSchema, WebSocketSchemaMessage } from '@zimic/ws';

import type {
  BaseWebSocketInterceptorClient,
  InterceptedWebSocketInterceptorMessage,
  WebSocketInterceptorConnectionAuth,
  WebSocketInterceptorServer,
  WebSocketInterceptorServerSendOptions,
} from './types/messages';

interface BaseInternalWebSocketInterceptorClient<
  Schema extends WebSocketSchema,
  Path extends string,
> extends BaseWebSocketInterceptorClient<Schema, Path> {
  messages: InterceptedWebSocketInterceptorMessage<Schema, Path>[];
}

// Mirrors the variants of `WebSocketInterceptorClient`, so internal clients are assignable to public ones. Both variants
// extend one interface, which TypeScript compares by type arguments, so schema-erased `any` clients accept clients of
// any schema.
export type InternalWebSocketInterceptorClient<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> = IfNever<
  WebSocketInterceptorConnectionAuth<Schema, Path>,
  BaseInternalWebSocketInterceptorClient<Schema, Path>,
  BaseInternalWebSocketInterceptorClient<Schema, Path> & { auth: WebSocketInterceptorConnectionAuth<Schema, Path> }
>;

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

type SendWebSocketInterceptorClientMessage = (
  // Unserialized: connections serialize and protocols encode them.
  data: WebSocketMessageSchema | WebSocketMessageData<WebSocketMessageSchema>,
) => void;

// Workers create clients for connections of any path and interceptor, so a client is schema-erased when created.
export class WebSocketInterceptorClientImplementation implements InternalWebSocketInterceptorClient {
  #sendMessage: SendWebSocketInterceptorClientMessage;
  #closeConnection: WebSocketInterceptorClientCloser;

  searchParams: HttpSearchParams;
  messages: InterceptedWebSocketInterceptorMessage<WebSocketSchema>[] = [];

  constructor(
    public url: string,
    public protocols: readonly string[],
    // Only protocols such as Socket.IO authenticate clients, so clients of plain WebSocket connections have no `auth`.
    public auth: Record<string, unknown> | undefined,
    sendMessage: SendWebSocketInterceptorClientMessage,
    closeConnection: WebSocketInterceptorClientCloser,
  ) {
    this.searchParams = new HttpSearchParams(new URL(url).searchParams);
    this.#sendMessage = sendMessage;
    this.#closeConnection = closeConnection;
  }

  send(data: WebSocketMessageSchema | WebSocketMessageData<WebSocketMessageSchema>) {
    this.#sendMessage(data);
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
  auth?: Record<string, unknown>;
  send: SendWebSocketInterceptorClientMessage;
  close: WebSocketInterceptorClientCloser;
}): InternalWebSocketInterceptorClient {
  return new WebSocketInterceptorClientImplementation(
    options.url,
    options.protocols,
    options.auth,
    options.send,
    options.close,
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
