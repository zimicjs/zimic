import { PossiblePromise } from '@zimic/utils/types';

import { WebSocketMessageData, WebSocketSchema } from '@/types/schema';

import { closeClientSocket, openClientSocket } from './utils/lifecycle';

export namespace WebSocketClient {
  export type ReadyState =
    | typeof WebSocketClient.CONNECTING
    | typeof WebSocketClient.OPEN
    | typeof WebSocketClient.CLOSING
    | typeof WebSocketClient.CLOSED;

  // The schema is not used in the event types, but it's included for consistency and future extensibility.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export type OpenEvent<_Schema extends WebSocketSchema> = globalThis.Event;

  export type MessageEvent<Schema extends WebSocketSchema> = globalThis.MessageEvent<WebSocketMessageData<Schema>>;

  // The schema is not used in the event types, but it's included for consistency and future extensibility.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export type CloseEvent<_Schema extends WebSocketSchema> = globalThis.CloseEvent;

  // The schema is not used in the event types, but it's included for consistency and future extensibility.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export type ErrorEvent<_Schema extends WebSocketSchema> = globalThis.Event;

  interface Events<Schema extends WebSocketSchema = WebSocketSchema> {
    open: OpenEvent<Schema>;
    message: MessageEvent<Schema>;
    close: CloseEvent<Schema>;
    error: ErrorEvent<Schema>;
  }

  export type EventType = keyof Events<WebSocketSchema>;

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

  export type EventListener<Schema extends WebSocketSchema, Type extends EventType> = (
    this: WebSocketClient<Schema>,
    ...parameters: EventListenerParameters<Schema>[Type]
  ) => PossiblePromise<void>;
}

type WebSocketClientRawEventListener = (this: WebSocket, event: Event) => PossiblePromise<void>;

export class WebSocketClient<Schema extends WebSocketSchema> implements Omit<
  WebSocket,
  `${string}EventListener` | `on${string}`
> {
  private socket?: WebSocket;

  #url: string;
  #protocols?: string | string[];
  #binaryType: BinaryType = 'blob';

  #onopen: WebSocketClient.EventListener<Schema, 'open'> | null = null;
  #onmessage: WebSocketClient.EventListener<Schema, 'message'> | null = null;
  #onclose: WebSocketClient.EventListener<Schema, 'close'> | null = null;
  #onerror: WebSocketClient.EventListener<Schema, 'error'> | null = null;

  private listeners: {
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

  constructor(socket: WebSocket);
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

  static CONNECTING = WebSocket.CONNECTING;

  get CONNECTING() {
    return WebSocketClient.CONNECTING;
  }

  static OPEN = WebSocket.OPEN;

  get OPEN() {
    return WebSocketClient.OPEN;
  }

  static CLOSING = WebSocket.CLOSING;

  get CLOSING() {
    return WebSocketClient.CLOSING;
  }

  static CLOSED = WebSocket.CLOSED;

  get CLOSED() {
    return WebSocketClient.CLOSED;
  }

  get binaryType() {
    return this.socket?.binaryType ?? this.#binaryType;
  }

  set binaryType(value: 'blob' | 'arraybuffer') {
    this.#binaryType = value;

    if (this.socket) {
      this.socket.binaryType = value;
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
    return readyState as WebSocketClient.ReadyState;
  }

  get bufferedAmount() {
    return this.socket?.bufferedAmount ?? 0;
  }

  async open(options: { timeout?: number } = {}) {
    const socket = new WebSocket(this.#url, this.#protocols);

    if (socket.binaryType !== this.binaryType) {
      socket.binaryType = this.binaryType;
    }

    this.applyListeners(socket);

    await openClientSocket(socket, options);

    this.socket = socket;
  }

  private applyListeners(socket: WebSocket) {
    for (const type of ['open', 'message', 'close', 'error'] as const) {
      const unitaryListener = this[`on${type}`] as WebSocketClient.EventListener<Schema, typeof type> | null;
      const rawUnitaryListener = unitaryListener ? this.listeners[type].get(unitaryListener) : undefined;

      if (rawUnitaryListener) {
        socket[`on${type}`] = rawUnitaryListener;
      }

      for (const rawListener of this.listeners[type].values()) {
        socket.addEventListener(type, rawListener);
      }
    }
  }

  async close(code?: number, reason?: string, options: { timeout?: number } = {}) {
    if (!this.socket) {
      return;
    }

    try {
      await closeClientSocket(this.socket, { ...options, code, reason });
    } finally {
      this.socket = undefined;
    }
  }

  send(data: WebSocketMessageData<Schema>) {
    this.socket?.send(data);
  }

  addEventListener<Type extends WebSocketClient.EventType>(
    type: Type,
    listener: WebSocketClient.EventListener<Schema, Type>,
    options?: boolean | AddEventListenerOptions,
  ) {
    const rawListener = listener.bind(this) as WebSocketClientRawEventListener;

    this.socket?.addEventListener(type, rawListener, options);
    this.listeners[type].set(listener, rawListener);
  }

  removeEventListener<Type extends WebSocketClient.EventType>(
    type: Type,
    listener: WebSocketClient.EventListener<Schema, Type>,
    options?: boolean | EventListenerOptions,
  ) {
    const rawListener = this.listeners[type].get(listener);

    if (rawListener) {
      this.socket?.removeEventListener(type, rawListener, options);
      this.listeners[type].delete(listener);
    }
  }

  get onopen() {
    return this.#onopen;
  }

  set onopen(listener: WebSocketClient.EventListener<Schema, 'open'> | null) {
    this.setEventListener('open', listener);
  }

  get onmessage() {
    return this.#onmessage;
  }

  set onmessage(listener: WebSocketClient.EventListener<Schema, 'message'> | null) {
    this.setEventListener('message', listener);
  }

  get onclose() {
    return this.#onclose;
  }

  set onclose(listener: WebSocketClient.EventListener<Schema, 'close'> | null) {
    this.setEventListener('close', listener);
  }

  get onerror() {
    return this.#onerror;
  }

  set onerror(listener: WebSocketClient.EventListener<Schema, 'error'> | null) {
    this.setEventListener('error', listener);
  }

  private setEventListener<
    Type extends WebSocketClient.EventType,
    Listener extends WebSocketClient.EventListener<Schema, Type> | null,
  >(type: Type, listener: Listener) {
    const listenerProperty = `_on${type}` as keyof WebSocketClient<Schema>;

    if (listener) {
      const rawListener = listener.bind(this) as WebSocketClientRawEventListener;
      this.listeners[type].set(listener, rawListener);

      if (this.socket) {
        this.socket[`on${type}`] = rawListener;
      }

      (this[listenerProperty] as Listener) = listener;
    } else {
      const currentListener = this[listenerProperty] as Listener;

      if (currentListener) {
        this.listeners[type].delete(currentListener);
      }

      if (this.socket) {
        this.socket[`on${type}`] = null;
      }

      (this[listenerProperty] as Listener | null) = null;
    }
  }

  dispatchEvent<Type extends WebSocketClient.EventType>(event: WebSocketClient.Event<Schema, Type>) {
    return this.socket?.dispatchEvent(event) ?? false;
  }
}
