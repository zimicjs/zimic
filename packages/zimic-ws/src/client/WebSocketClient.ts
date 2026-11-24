import { createPromiseWithResolvers } from '@zimic/utils/data';
import { PossiblePromise, UnionHasMoreThanOneType } from '@zimic/utils/types';
import {
  closeWebSocketClient,
  DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT,
  WebSocketCloseTimeoutError,
  WebSocketOpenTimeoutError,
} from '@zimic/utils/ws';

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

interface WebSocketClientOpenAttempt {
  socket: WebSocket;
  opening: Promise<unknown>;
  // The outcome of the `open()` that started the attempt, which later calls join.
  opened: Promise<void>;
  closing: Promise<CloseEvent>;
  // A later `open()` starts a new attempt instead of joining an abandoned one.
  isAbandoned: boolean;
}

/** @see {@link https://zimic.dev/docs/ws/api/websocket-client `WebSocketClient` API reference} */
export class WebSocketClient<
  Schema extends WebSocketSchema,
  Path extends WebSocketSchemaPath.Literal<Schema> = WebSocketClientDefaultPath<Schema>,
> implements Omit<WebSocket, `${string}EventListener` | `on${string}`> {
  private socket?: WebSocket;
  private openAttempt?: WebSocketClientOpenAttempt;

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
    const socket = this.socket ?? this.openAttempt?.socket;

    if (socket) {
      socket.binaryType = value;
    }
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clienturl `client.url` API reference} */
  get url() {
    return (this.socket ?? this.openAttempt?.socket)?.url ?? this.#url;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientprotocol `client.protocol` API reference} */
  get protocol() {
    return (this.socket ?? this.openAttempt?.socket)?.protocol ?? '';
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientextensions `client.extensions` API reference} */
  get extensions() {
    return (this.socket ?? this.openAttempt?.socket)?.extensions ?? '';
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientreadystate `client.readyState` API reference} */
  get readyState(): WebSocketClient.ReadyState {
    const socket = this.socket ?? this.openAttempt?.socket;
    return socket ? socket.readyState : this.#readyStateWithoutSocket;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientbufferedamount `client.bufferedAmount` API reference} */
  get bufferedAmount() {
    return (this.socket ?? this.openAttempt?.socket)?.bufferedAmount ?? 0;
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientopen `client.open()` API reference} */
  async open(options?: WebSocketClientOpenOptions) {
    const pendingAttempt = this.openAttempt;

    if (pendingAttempt && !pendingAttempt.isAbandoned) {
      await pendingAttempt.opened;
      return;
    }

    if (this.readyState === WebSocketClient.OPEN) {
      return;
    }

    // The new socket replaces the previous one before any await, so a `close()` called while reopening closes the
    // socket being opened instead of only the previous one.
    const previousSocket = this.socket;
    this.socket = undefined;
    this.#readyStateWithoutSocket = WebSocketClient.CLOSED;

    const socket = new WebSocket(this.#url, this.#protocols);

    if (socket.binaryType !== this.binaryType) {
      socket.binaryType = this.binaryType;
    }

    this.applyListeners(socket);

    const opened = createPromiseWithResolvers<void>();

    const { timeout: timeoutDuration = DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT } = options ?? {};

    // One timeout covers the whole open, including closing the previous socket. It starts before the timeouts of each
    // step, so it fires first when they have the same duration.
    const timedOut = createPromiseWithResolvers<never>();

    const openTimeout = setTimeout(() => {
      timedOut.reject(new WebSocketOpenTimeoutError(timeoutDuration));
    }, timeoutDuration);

    const attempt: WebSocketClientOpenAttempt = {
      socket,
      opening: Promise.all([
        previousSocket && closeWebSocketClient(previousSocket, { timeout: timeoutDuration }),
        openWebSocketClient(socket, { timeout: timeoutDuration }),
      ]),
      opened,
      closing: new Promise((resolve) => {
        socket.addEventListener('close', resolve, { once: true });
      }),
      isAbandoned: false,
    };

    this.openAttempt = attempt;

    // Some runtimes leave a socket closed while connecting in the `CLOSING` state after its `close` event, so the
    // client stops reading the state of the attempt once its socket closes.
    socket.addEventListener(
      'close',
      () => {
        if (this.openAttempt === attempt) {
          this.openAttempt = undefined;
        }
      },
      { once: true },
    );

    void this.adoptOpenAttemptSocket(attempt, timedOut)
      .finally(() => {
        clearTimeout(openTimeout);
      })
      .then(opened.resolve, opened.reject);

    await opened;
  }

  private async adoptOpenAttemptSocket(attempt: WebSocketClientOpenAttempt, timedOut: Promise<never>) {
    const { socket } = attempt;

    try {
      await Promise.race([attempt.opening, timedOut]);
    } catch (error) {
      attempt.isAbandoned = true;
      socket.close();
      throw error;
    }

    // While the previous socket is still closing, this socket can open and then be closed by `close()` or by the
    // server. The open then fails like a connection closed before opening, and leaves the state of newer attempts.
    if (attempt.isAbandoned || this.openAttempt !== attempt) {
      const closedAfterOpening = new Promise<never>((_resolve, reject) => {
        void attempt.closing.then(reject);
      });

      await Promise.race([closedAfterOpening, timedOut]);
    }

    this.socket = socket;
    this.openAttempt = undefined;
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
    const attempt = this.openAttempt;

    if (attempt) {
      // Like a native socket, closing while connecting fails the connection, so the pending `open()` rejects and a
      // later `open()` starts a new connection.
      attempt.isAbandoned = true;
      attempt.socket.close(code, reason);

      const { timeout: timeoutDuration = DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT } = options ?? {};

      await new Promise<void>((resolve, reject) => {
        const closeTimeout = setTimeout(() => {
          reject(new WebSocketCloseTimeoutError(timeoutDuration));
        }, timeoutDuration);

        void attempt.closing.then(() => {
          clearTimeout(closeTimeout);
          resolve();
        });
      });

      return;
    }

    const socket = this.socket;

    if (!socket) {
      return;
    }

    try {
      await closeWebSocketClient(socket, { ...options, code, reason });
    } finally {
      // An `open()` started while closing may have already taken over a newer socket, which must stay.
      if (this.socket === socket) {
        this.socket = undefined;
      }

      this.#readyStateWithoutSocket = WebSocketClient.CLOSED;
    }
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientsend `client.send()` API reference} */
  send(data: WebSocketMessageData<WebSocketSchemaMessage<Schema, Path>>) {
    const socket = this.socket ?? this.openAttempt?.socket;

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

    const socket = this.socket ?? this.openAttempt?.socket;
    socket?.addEventListener(type, rawListener, options);

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
      const socket = this.socket ?? this.openAttempt?.socket;
      socket?.removeEventListener(type, rawListener, options);

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
    const socket = this.socket ?? this.openAttempt?.socket;
    const currentListener = this.unitaryListeners[type];

    if (currentListener) {
      const rawListener = this.listenerToRawListener[type].get(currentListener);

      if (socket && rawListener) {
        socket[`on${type}`] = null;
      }

      this.listenerToRawListener[type].delete(currentListener);
    }

    if (listener) {
      const rawListener = listener.bind(this) as WebSocketClientRawEventListener;
      this.listenerToRawListener[type].set(listener, rawListener);

      if (socket) {
        socket[`on${type}`] = rawListener;
      }

      (this.unitaryListeners[type] as Listener) = listener;
    } else {
      if (socket) {
        socket[`on${type}`] = null;
      }

      (this.unitaryListeners[type] as Listener | null) = null;
    }
  }

  /** @see {@link https://zimic.dev/docs/ws/api/websocket-client#clientdispatchevent `client.dispatchEvent()` API reference} */
  dispatchEvent<Type extends WebSocketClient.EventType>(event: WebSocketClient.Event<Schema, Type, Path>) {
    return (this.socket ?? this.openAttempt?.socket)?.dispatchEvent(event) ?? false;
  }
}
