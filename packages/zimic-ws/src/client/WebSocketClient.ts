import { PossiblePromise } from '@zimic/utils/types';

import { WebSocketMessageData, WebSocketSchema } from '@/types/schema';

import {
  closeWebSocketClient,
  openWebSocketClient,
  WebSocketClientCloseOptions,
  WebSocketClientOpenOptions,
} from './utils/lifecycle';

export namespace WebSocketClient {
  /** The ready states supported by the wrapped WebSocket. */
  export type ReadyState =
    | typeof WebSocketClient.CONNECTING
    | typeof WebSocketClient.OPEN
    | typeof WebSocketClient.CLOSING
    | typeof WebSocketClient.CLOSED;

  /** The event sent when the connection opens. */
  // The schema is not used in the event types, but it's included for consistency and future extensibility.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export type OpenEvent<_Schema extends WebSocketSchema> = globalThis.Event;

  /** The event sent when a message arrives, with data inferred from the schema. */
  export type MessageEvent<Schema extends WebSocketSchema> = globalThis.MessageEvent<WebSocketMessageData<Schema>>;

  /** The event sent when the connection closes. */
  // The schema is not used in the event types, but it's included for consistency and future extensibility.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export type CloseEvent<_Schema extends WebSocketSchema> = globalThis.CloseEvent;

  /** The event sent when a connection error occurs. */
  // The schema is not used in the event types, but it's included for consistency and future extensibility.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export type ErrorEvent<_Schema extends WebSocketSchema> = globalThis.Event;

  interface Events<Schema extends WebSocketSchema = WebSocketSchema> {
    open: OpenEvent<Schema>;
    message: MessageEvent<Schema>;
    close: CloseEvent<Schema>;
    error: ErrorEvent<Schema>;
  }

  /** The event names supported by a client. */
  export type EventType = keyof Events<WebSocketSchema>;

  /** An event type selected by its name. */
  export type Event<
    Schema extends WebSocketSchema = WebSocketSchema,
    Type extends EventType = EventType,
  > = Events<Schema>[Type];

  interface EventListenerParameters<Schema extends WebSocketSchema> {
    open: [event: Event<Schema, 'open'>];
    message: [event: Event<Schema, 'message'>];
    close: [event: Event<Schema, 'close'>];
    error: [event: Event<Schema, 'error'>];
  }

  /** A listener for a client event. The listener's `this` value is the client. */
  export type EventListener<Schema extends WebSocketSchema, Type extends EventType> = (
    this: WebSocketClient<Schema>,
    ...parameters: EventListenerParameters<Schema>[Type]
  ) => PossiblePromise<void>;
}

type WebSocketClientRawEventListener = (this: WebSocket, event: Event) => PossiblePromise<void>;

/**
 * A schema-aware wrapper around a browser WebSocket client.
 *
 * @see {@link https://zimic.dev/docs/ws `@zimic/ws` documentation}
 */
export class WebSocketClient<Schema extends WebSocketSchema> implements Omit<
  WebSocket,
  `${string}EventListener` | `on${string}`
> {
  private socket?: WebSocket;

  #url: string;
  #protocols?: string | string[];
  #binaryType: BinaryType = 'blob';

  private unitaryListeners: {
    [Type in WebSocketClient.EventType]: WebSocketClient.EventListener<Schema, Type> | null;
  } = {
    open: null,
    message: null,
    close: null,
    error: null,
  };

  private listenerToRawListener: {
    [Type in WebSocketClient.EventType]: Map<
      WebSocketClient.EventListener<Schema, Type>,
      WebSocketClientRawEventListener
    >;
  } = {
    open: new Map(),
    message: new Map(),
    close: new Map(),
    error: new Map(),
  };

  /** Wraps an existing WebSocket. */
  constructor(socket: WebSocket);
  /** Creates a client that will connect to the URL when {@link WebSocketClient.open} is called. */
  constructor(_url: string, protocols?: string | string[]);
  constructor(urlOrSocket: WebSocket | string, protocols?: string | string[]) {
    if (typeof urlOrSocket === 'string') {
      this.#url = urlOrSocket;
    } else {
      this.#url = urlOrSocket.url;
      this.socket = urlOrSocket;
    }

    this.#protocols = protocols;
  }

  /** The WebSocket `CONNECTING` ready state. */
  static get CONNECTING() {
    return WebSocket.CONNECTING;
  }

  /** The WebSocket `CONNECTING` ready state. */
  get CONNECTING() {
    return WebSocketClient.CONNECTING;
  }

  /** The WebSocket `OPEN` ready state. */
  static get OPEN() {
    return WebSocket.OPEN;
  }

  /** The WebSocket `OPEN` ready state. */
  get OPEN() {
    return WebSocketClient.OPEN;
  }

  /** The WebSocket `CLOSING` ready state. */
  static get CLOSING() {
    return WebSocket.CLOSING;
  }

  /** The WebSocket `CLOSING` ready state. */
  get CLOSING() {
    return WebSocketClient.CLOSING;
  }

  /** The WebSocket `CLOSED` ready state. */
  static get CLOSED() {
    return WebSocket.CLOSED;
  }

  /** The WebSocket `CLOSED` ready state. */
  get CLOSED() {
    return WebSocketClient.CLOSED;
  }

  /** Gets or sets the binary data format for received messages. */
  get binaryType() {
    return this.socket?.binaryType ?? this.#binaryType;
  }

  set binaryType(value: 'blob' | 'arraybuffer') {
    this.#binaryType = value;

    if (this.socket) {
      this.socket.binaryType = value;
    }
  }

  /** Gets the URL used by this client. */
  get url() {
    return this.socket?.url ?? this.#url;
  }

  /** Gets the negotiated subprotocol, or an empty string before the connection opens. */
  get protocol() {
    return this.socket?.protocol ?? '';
  }

  /** Gets the negotiated extensions. */
  get extensions() {
    return this.socket?.extensions ?? '';
  }

  /** Gets the current connection state. */
  get readyState(): WebSocketClient.ReadyState {
    const readyState = this.socket?.readyState ?? WebSocket.CLOSED;
    return readyState;
  }

  /** Gets the number of bytes queued by {@link WebSocketClient.send}. */
  get bufferedAmount() {
    return this.socket?.bufferedAmount ?? 0;
  }

  /** Opens the connection and waits for it to become ready. */
  async open(options?: WebSocketClientOpenOptions) {
    if (this.readyState === WebSocketClient.OPEN) {
      return;
    }

    await this.close();

    const socket = new WebSocket(this.#url, this.#protocols);

    try {
      if (socket.binaryType !== this.binaryType) {
        socket.binaryType = this.binaryType;
      }

      this.applyListeners(socket);

      await openWebSocketClient(socket, options);
    } catch (error) {
      socket.close();
      throw error;
    }

    this.socket = socket;
  }

  private applyListeners(socket: WebSocket) {
    for (const type of ['open', 'message', 'close', 'error'] as const) {
      const unitaryListener = this[`on${type}`] as WebSocketClient.EventListener<Schema, typeof type> | null;
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

  /** Closes the connection and waits for it to close. */
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

  /** Sends schema-compatible message data when the connection is open. */
  send(data: WebSocketMessageData<Schema>) {
    this.socket?.send(data);
  }

  /** Registers a listener for a WebSocket event. */
  addEventListener<Type extends WebSocketClient.EventType>(
    type: Type,
    listener: WebSocketClient.EventListener<Schema, Type>,
    options?: boolean | AddEventListenerOptions,
  ) {
    const rawListener = listener.bind(this) as WebSocketClientRawEventListener;

    this.socket?.addEventListener(type, rawListener, options);
    this.listenerToRawListener[type].set(listener, rawListener);
  }

  /** Removes a listener previously registered with {@link WebSocketClient.addEventListener}. */
  removeEventListener<Type extends WebSocketClient.EventType>(
    type: Type,
    listener: WebSocketClient.EventListener<Schema, Type>,
    options?: boolean | EventListenerOptions,
  ) {
    const rawListener = this.listenerToRawListener[type].get(listener);

    if (rawListener) {
      this.socket?.removeEventListener(type, rawListener, options);
      this.listenerToRawListener[type].delete(listener);
    }
  }

  /** Gets or sets the listener called when the connection opens. */
  get onopen() {
    return this.unitaryListeners.open;
  }

  set onopen(listener: WebSocketClient.EventListener<Schema, 'open'> | null) {
    this.setEventListener('open', listener);
  }

  /** Gets or sets the listener called when a message arrives. */
  get onmessage() {
    return this.unitaryListeners.message;
  }

  set onmessage(listener: WebSocketClient.EventListener<Schema, 'message'> | null) {
    this.setEventListener('message', listener);
  }

  /** Gets or sets the listener called when the connection closes. */
  get onclose() {
    return this.unitaryListeners.close;
  }

  set onclose(listener: WebSocketClient.EventListener<Schema, 'close'> | null) {
    this.setEventListener('close', listener);
  }

  /** Gets or sets the listener called when a connection error occurs. */
  get onerror() {
    return this.unitaryListeners.error;
  }

  set onerror(listener: WebSocketClient.EventListener<Schema, 'error'> | null) {
    this.setEventListener('error', listener);
  }

  private setEventListener<
    Type extends WebSocketClient.EventType,
    Listener extends WebSocketClient.EventListener<Schema, Type> | null,
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

  /** Dispatches an event on the underlying WebSocket. */
  dispatchEvent<Type extends WebSocketClient.EventType>(event: WebSocketClient.Event<Schema, Type>) {
    return this.socket?.dispatchEvent(event) ?? false;
  }
}
