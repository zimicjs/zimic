import { PossiblePromise, UnionHasMoreThanOneType } from '@zimic/utils/types';
import { closeWebSocketClient } from '@zimic/utils/ws';

import { WebSocketMessageData, WebSocketSchema, WebSocketSchemaMessage, WebSocketSchemaPath } from '@/types/schema';

import { openWebSocketClient, WebSocketClientCloseOptions, WebSocketClientOpenOptions } from './utils/lifecycle';

/** @see {@link https://zimic.dev/docs/ws/guides/schemas#using-schemas-with-clients Using schemas with clients} */
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
  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientreadystate `client.readyState` API reference} */
  export type ReadyState =
    | typeof WebSocketClient.CONNECTING
    | typeof WebSocketClient.OPEN
    | typeof WebSocketClient.CLOSING
    | typeof WebSocketClient.CLOSED;

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientonopen `client.onopen` API reference} */
  // The schema is not used in the event types, but it's included for consistency and future extensibility.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export type OpenEvent<_Schema extends WebSocketSchema> = globalThis.Event;

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientonmessage `client.onmessage` API reference} */
  export type MessageEvent<
    Schema extends WebSocketSchema,
    Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketClientDefaultPath<Schema>,
  > = globalThis.MessageEvent<WebSocketMessageData<WebSocketSchemaMessage<Schema, Path>>>;

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientonclose `client.onclose` API reference} */
  // The schema is not used in the event types, but it's included for consistency and future extensibility.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export type CloseEvent<_Schema extends WebSocketSchema> = globalThis.CloseEvent;

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientonerror `client.onerror` API reference} */
  // The schema is not used in the event types, but it's included for consistency and future extensibility.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export type ErrorEvent<_Schema extends WebSocketSchema> = globalThis.Event;

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientaddeventlistener `client.addEventListener()` API reference} */
  interface Events<
    Schema extends WebSocketSchema = WebSocketSchema,
    Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketClientDefaultPath<Schema>,
  > {
    open: OpenEvent<Schema>;
    message: MessageEvent<Schema, Path>;
    close: CloseEvent<Schema>;
    error: ErrorEvent<Schema>;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientaddeventlistener `client.addEventListener()` API reference} */
  export type EventType = keyof Events;

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientaddeventlistener `client.addEventListener()` API reference} */
  export type Event<
    Schema extends WebSocketSchema = WebSocketSchema,
    Type extends EventType = EventType,
    Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketClientDefaultPath<Schema>,
  > = Events<Schema, Path>[Type];

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientaddeventlistener `client.addEventListener()` API reference} */
  interface EventListenerParameters<Schema extends WebSocketSchema, Path extends WebSocketSchemaPath.Literal<Schema>> {
    open: [event: Event<Schema, 'open', Path>];
    message: [event: Event<Schema, 'message', Path>];
    close: [event: Event<Schema, 'close', Path>];
    error: [event: Event<Schema, 'error', Path>];
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientaddeventlistener `client.addEventListener()` API reference} */
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

/** @see {@link https://zimic.dev/docs/ws/api/websocket-client `WebSocketClient` API reference} */
export class WebSocketClient<
  Schema extends WebSocketSchema,
  Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketClientDefaultPath<Schema>,
> implements Omit<WebSocket, `${string}EventListener` | `on${string}`> {
  private socket?: WebSocket;
  private openingSocket?: WebSocket;
  private openingPromise?: Promise<void>;

  // A client created with a URL has not connected yet, which matches a native socket that is still connecting. After
  // an open attempt or a close, a client without a socket is closed.
  #readyStateWithoutSocket: WebSocketClient.ReadyState = WebSocketClient.CONNECTING;

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

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#constructor `WebSocketClient` constructor API reference} */
  constructor(socket: WebSocketClientConstructorArgument<Path, WebSocket>);
  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#constructor `WebSocketClient` constructor API reference} */
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

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientconnecting `client.CONNECTING` API reference} */
  static get CONNECTING() {
    return WebSocket.CONNECTING;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientconnecting `client.CONNECTING` API reference} */
  get CONNECTING() {
    return WebSocketClient.CONNECTING;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientopen-1 `client.OPEN` API reference} */
  static get OPEN() {
    return WebSocket.OPEN;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientopen-1 `client.OPEN` API reference} */
  get OPEN() {
    return WebSocketClient.OPEN;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientclosing `client.CLOSING` API reference} */
  static get CLOSING() {
    return WebSocket.CLOSING;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientclosing `client.CLOSING` API reference} */
  get CLOSING() {
    return WebSocketClient.CLOSING;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientclosed `client.CLOSED` API reference} */
  static get CLOSED() {
    return WebSocket.CLOSED;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientclosed `client.CLOSED` API reference} */
  get CLOSED() {
    return WebSocketClient.CLOSED;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientbinarytype `client.binaryType` API reference} */
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

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clienturl `client.url` API reference} */
  get url() {
    return this.socket?.url ?? this.#url;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientprotocol `client.protocol` API reference} */
  get protocol() {
    return this.socket?.protocol ?? '';
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientextensions `client.extensions` API reference} */
  get extensions() {
    return this.socket?.extensions ?? '';
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientreadystate `client.readyState` API reference} */
  get readyState(): WebSocketClient.ReadyState {
    const socket = this.socket ?? this.openingSocket;
    return socket ? socket.readyState : this.#readyStateWithoutSocket;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientbufferedamount `client.bufferedAmount` API reference} */
  get bufferedAmount() {
    return this.socket?.bufferedAmount ?? 0;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientopen `client.open()` API reference} */
  async open(options?: WebSocketClientOpenOptions) {
    this.openingPromise ??= this.openSocket(options).finally(() => {
      this.openingPromise = undefined;
    });

    await this.openingPromise;
  }

  private async openSocket(options?: WebSocketClientOpenOptions) {
    if (this.readyState === WebSocketClient.OPEN) {
      return;
    }

    // Creating the socket synchronously when there is none lets a `close()` right after `open()` find and close it.
    if (this.socket) {
      await this.close();
    }

    const socket = new WebSocket(this.#url, this.#protocols);
    this.openingSocket = socket;
    this.#readyStateWithoutSocket = WebSocketClient.CLOSED;

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

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientclose `client.close()` API reference} */
  async close(code?: number, reason?: string, options?: WebSocketClientCloseOptions) {
    if (!this.socket) {
      if (this.openingSocket) {
        // Like a native socket, closing while connecting fails the connection, so the pending `open()` rejects with
        // the error and this waits only for it to settle.
        this.openingSocket.close(code, reason);
        await Promise.allSettled([this.openingPromise]);
      }

      return;
    }

    try {
      await closeWebSocketClient(this.socket, { ...options, code, reason });
    } finally {
      this.socket = undefined;
      this.#readyStateWithoutSocket = WebSocketClient.CLOSED;
    }
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientsend `client.send()` API reference} */
  send(data: WebSocketMessageData<WebSocketSchemaMessage<Schema, Path>>) {
    const socket = this.socket ?? this.openingSocket;

    // Like a native socket, a client without a socket throws while connecting and discards the data once closed.
    if (socket) {
      socket.send(data);
    } else if (this.#readyStateWithoutSocket === WebSocketClient.CONNECTING) {
      throw new DOMException('Still in CONNECTING state.', 'InvalidStateError');
    }
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientaddeventlistener `client.addEventListener()` API reference} */
  addEventListener<Type extends WebSocketClient.EventType>(
    type: Type,
    listener: WebSocketClient.EventListener<Schema, Type, Path>,
    options?: boolean | AddEventListenerOptions,
  ) {
    const rawListener = listener.bind(this) as WebSocketClientRawEventListener;

    this.socket?.addEventListener(type, rawListener, options);
    this.listenerToRawListener[type].set(listener, rawListener);
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientremoveeventlistener `client.removeEventListener()` API reference} */
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

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientonopen `client.onopen` API reference} */
  get onopen() {
    return this.unitaryListeners.open;
  }

  set onopen(listener: WebSocketClient.EventListener<Schema, 'open', Path> | null) {
    this.setEventListener('open', listener);
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientonmessage `client.onmessage` API reference} */
  get onmessage() {
    return this.unitaryListeners.message;
  }

  set onmessage(listener: WebSocketClient.EventListener<Schema, 'message', Path> | null) {
    this.setEventListener('message', listener);
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientonclose `client.onclose` API reference} */
  get onclose() {
    return this.unitaryListeners.close;
  }

  set onclose(listener: WebSocketClient.EventListener<Schema, 'close', Path> | null) {
    this.setEventListener('close', listener);
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientonerror `client.onerror` API reference} */
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

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientdispatchevent `client.dispatchEvent()` API reference} */
  dispatchEvent<Type extends WebSocketClient.EventType>(event: WebSocketClient.Event<Schema, Type, Path>) {
    return this.socket?.dispatchEvent(event) ?? false;
  }
}
