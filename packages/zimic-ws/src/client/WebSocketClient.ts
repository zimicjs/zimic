import { PossiblePromise, UnionHasMoreThanOneType } from '@zimic/utils/types';
import { closeWebSocketClient } from '@zimic/utils/ws';

import { WebSocketMessageData, WebSocketSchema, WebSocketSchemaMessage, WebSocketSchemaPath } from '@/types/schema';

import { openWebSocketClient, WebSocketClientCloseOptions, WebSocketClientOpenOptions } from './utils/lifecycle';

/**
 * The path of a client when no path type argument is given: the only path of the schema, or `never` if the schema has
 * multiple paths and the client cannot tell which one it connects to.
 */
export type WebSocketClientDefaultPath<Schema extends WebSocketSchema> =
  UnionHasMoreThanOneType<WebSocketSchemaPath.Literal<Schema>> extends true
    ? never
    : WebSocketSchemaPath.Literal<Schema>;

// URLs are plain strings, so a client cannot infer its path from them. Replacing the type of the first constructor
// argument makes the compiler show this text when the path is missing.
type WebSocketClientConstructorArgument<Path extends string, Argument> = [Path] extends [never]
  ? "This schema has multiple paths. Declare the path of the client: new WebSocketClient<Schema, '/path'>(url)."
  : Argument;

export namespace WebSocketClient {
  export type ReadyState =
    | typeof WebSocketClient.CONNECTING
    | typeof WebSocketClient.OPEN
    | typeof WebSocketClient.CLOSING
    | typeof WebSocketClient.CLOSED;

  // The schema is not used in the event types, but it's included for consistency and future extensibility.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export type OpenEvent<_Schema extends WebSocketSchema> = globalThis.Event;

  export type MessageEvent<
    Schema extends WebSocketSchema,
    Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketClientDefaultPath<Schema>,
  > = globalThis.MessageEvent<WebSocketMessageData<WebSocketSchemaMessage<Schema, Path>>>;

  // The schema is not used in the event types, but it's included for consistency and future extensibility.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export type CloseEvent<_Schema extends WebSocketSchema> = globalThis.CloseEvent;

  // The schema is not used in the event types, but it's included for consistency and future extensibility.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export type ErrorEvent<_Schema extends WebSocketSchema> = globalThis.Event;

  interface Events<
    Schema extends WebSocketSchema = WebSocketSchema,
    Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketClientDefaultPath<Schema>,
  > {
    open: OpenEvent<Schema>;
    message: MessageEvent<Schema, Path>;
    close: CloseEvent<Schema>;
    error: ErrorEvent<Schema>;
  }

  export type EventType = keyof Events;

  export type Event<
    Schema extends WebSocketSchema = WebSocketSchema,
    Type extends EventType = EventType,
    Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketClientDefaultPath<Schema>,
  > = Events<Schema, Path>[Type];

  interface EventListenerParameters<Schema extends WebSocketSchema, Path extends WebSocketSchemaPath.Literal<Schema>> {
    open: [event: Event<Schema, 'open', Path>];
    message: [event: Event<Schema, 'message', Path>];
    close: [event: Event<Schema, 'close', Path>];
    error: [event: Event<Schema, 'error', Path>];
  }

  export type EventListener<
    Schema extends WebSocketSchema,
    Type extends EventType,
    Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketClientDefaultPath<Schema>,
  > = (
    this: WebSocketClient<Schema, Path>,
    ...parameters: EventListenerParameters<Schema, Path>[Type]
  ) => PossiblePromise<void>;
}

type WebSocketClientRawEventListener = (this: WebSocket, event: Event) => PossiblePromise<void>;

/**
 * A native-like `WebSocket` client typed with a {@link WebSocketSchema}. Schemas with multiple paths require the path of
 * the client as the second type argument, such as `new WebSocketClient<Schema, '/rooms/:roomId'>(url)`.
 */
export class WebSocketClient<
  Schema extends WebSocketSchema,
  Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketClientDefaultPath<Schema>,
> implements Omit<WebSocket, `${string}EventListener` | `on${string}`> {
  private socket?: WebSocket;
  private openingSocket?: WebSocket;

  #url: string;
  #protocols?: string | string[];
  #binaryType: BinaryType = 'blob';

  private unitaryListeners: {
    [Type in WebSocketClient.EventType]: WebSocketClient.EventListener<Schema, Type, Path> | null;
  } = {
    open: null,
    message: null,
    close: null,
    error: null,
  };

  private listenerToRawListener: {
    [Type in WebSocketClient.EventType]: Map<
      WebSocketClient.EventListener<Schema, Type, Path>,
      WebSocketClientRawEventListener
    >;
  } = {
    open: new Map(),
    message: new Map(),
    close: new Map(),
    error: new Map(),
  };

  constructor(socket: WebSocketClientConstructorArgument<Path, WebSocket>);
  constructor(_url: WebSocketClientConstructorArgument<Path, string>, protocols?: string | string[]);
  constructor(urlOrSocket: WebSocket | string, protocols?: string | string[]) {
    if (typeof urlOrSocket === 'string') {
      this.#url = urlOrSocket;
    } else {
      this.#url = urlOrSocket.url;
      this.socket = urlOrSocket;
    }

    this.#protocols = protocols;
  }

  static get CONNECTING() {
    return WebSocket.CONNECTING;
  }

  get CONNECTING() {
    return WebSocketClient.CONNECTING;
  }

  static get OPEN() {
    return WebSocket.OPEN;
  }

  get OPEN() {
    return WebSocketClient.OPEN;
  }

  static get CLOSING() {
    return WebSocket.CLOSING;
  }

  get CLOSING() {
    return WebSocketClient.CLOSING;
  }

  static get CLOSED() {
    return WebSocket.CLOSED;
  }

  get CLOSED() {
    return WebSocketClient.CLOSED;
  }

  get binaryType() {
    return this.socket?.binaryType ?? this.#binaryType;
  }

  set binaryType(value: 'blob' | 'arraybuffer') {
    this.#binaryType = value;

    // The socket being opened is not exposed yet, but it decodes the messages it receives as soon as it opens, so
    // it needs the binary type set while opening, such as in open listeners.
    const socket = this.socket ?? this.openingSocket;

    if (socket) {
      socket.binaryType = value;
    }
  }

  get url() {
    return this.socket?.url ?? this.#url;
  }

  get protocol() {
    return this.socket?.protocol ?? '';
  }

  get extensions() {
    return this.socket?.extensions ?? '';
  }

  get readyState(): WebSocketClient.ReadyState {
    const readyState = this.socket?.readyState ?? WebSocket.CLOSED;
    return readyState;
  }

  get bufferedAmount() {
    return this.socket?.bufferedAmount ?? 0;
  }

  async open(options?: WebSocketClientOpenOptions) {
    if (this.readyState === WebSocketClient.OPEN) {
      return;
    }

    await this.close();

    const socket = new WebSocket(this.#url, this.#protocols);
    this.openingSocket = socket;

    try {
      if (socket.binaryType !== this.binaryType) {
        socket.binaryType = this.binaryType;
      }

      this.applyListeners(socket);

      await openWebSocketClient(socket, options);
    } catch (error) {
      socket.close();
      throw error;
    } finally {
      this.openingSocket = undefined;
    }

    this.socket = socket;
  }

  private applyListeners(socket: WebSocket) {
    for (const type of ['open', 'message', 'close', 'error'] as const) {
      const unitaryListener = this[`on${type}`] as WebSocketClient.EventListener<Schema, typeof type, Path> | null;
      const rawUnitaryListener = unitaryListener ? this.listenerToRawListener[type].get(unitaryListener) : undefined;

      if (rawUnitaryListener) {
        socket[`on${type}`] = rawUnitaryListener;
      }

      for (const rawListener of this.listenerToRawListener[type].values()) {
        const isRawUnitaryListener = rawListener === rawUnitaryListener;

        if (!isRawUnitaryListener) {
          socket.addEventListener(type, rawListener);
        }
      }
    }
  }

  async close(code?: number, reason?: string, options?: WebSocketClientCloseOptions) {
    if (!this.socket) {
      return;
    }

    try {
      await closeWebSocketClient(this.socket, { ...options, code, reason });
    } finally {
      this.socket = undefined;
    }
  }

  send(data: WebSocketMessageData<WebSocketSchemaMessage<Schema, Path>>) {
    this.socket?.send(data);
  }

  addEventListener<Type extends WebSocketClient.EventType>(
    type: Type,
    listener: WebSocketClient.EventListener<Schema, Type, Path>,
    options?: boolean | AddEventListenerOptions,
  ) {
    const rawListener = listener.bind(this) as WebSocketClientRawEventListener;

    this.socket?.addEventListener(type, rawListener, options);
    this.listenerToRawListener[type].set(listener, rawListener);
  }

  removeEventListener<Type extends WebSocketClient.EventType>(
    type: Type,
    listener: WebSocketClient.EventListener<Schema, Type, Path>,
    options?: boolean | EventListenerOptions,
  ) {
    const rawListener = this.listenerToRawListener[type].get(listener);

    if (rawListener) {
      this.socket?.removeEventListener(type, rawListener, options);
      this.listenerToRawListener[type].delete(listener);
    }
  }

  get onopen() {
    return this.unitaryListeners.open;
  }

  set onopen(listener: WebSocketClient.EventListener<Schema, 'open', Path> | null) {
    this.setEventListener('open', listener);
  }

  get onmessage() {
    return this.unitaryListeners.message;
  }

  set onmessage(listener: WebSocketClient.EventListener<Schema, 'message', Path> | null) {
    this.setEventListener('message', listener);
  }

  get onclose() {
    return this.unitaryListeners.close;
  }

  set onclose(listener: WebSocketClient.EventListener<Schema, 'close', Path> | null) {
    this.setEventListener('close', listener);
  }

  get onerror() {
    return this.unitaryListeners.error;
  }

  set onerror(listener: WebSocketClient.EventListener<Schema, 'error', Path> | null) {
    this.setEventListener('error', listener);
  }

  private setEventListener<
    Type extends WebSocketClient.EventType,
    Listener extends WebSocketClient.EventListener<Schema, Type, Path> | null,
  >(type: Type, listener: Listener) {
    const currentListener = this.unitaryListeners[type];

    if (currentListener) {
      const rawListener = this.listenerToRawListener[type].get(currentListener);

      if (this.socket && rawListener) {
        this.socket[`on${type}`] = null;
      }

      this.listenerToRawListener[type].delete(currentListener);
    }

    if (listener) {
      const rawListener = listener.bind(this) as WebSocketClientRawEventListener;
      this.listenerToRawListener[type].set(listener, rawListener);

      if (this.socket) {
        this.socket[`on${type}`] = rawListener;
      }

      (this.unitaryListeners[type] as Listener) = listener;
    } else {
      if (this.socket) {
        this.socket[`on${type}`] = null;
      }

      (this.unitaryListeners[type] as Listener | null) = null;
    }
  }

  dispatchEvent<Type extends WebSocketClient.EventType>(event: WebSocketClient.Event<Schema, Type, Path>) {
    return this.socket?.dispatchEvent(event) ?? false;
  }
}
