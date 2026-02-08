import { WebSocketEvent, WebSocketEventType, WebSocketMessageData, WebSocketSchema } from '@/types/schema';

import { ClientSocket } from './ClientSocket';
import { closeClientSocket, openClientSocket } from './utils/lifecycle';

export type WebSocketClientEventListener<Schema extends WebSocketSchema, Type extends WebSocketEventType<Schema>> = (
  this: WebSocketClient<Schema>,
  event: WebSocketEvent<Schema, Type>,
) => unknown;

type WebSocketClientRawEventListener = (this: ClientSocket, event: Event) => unknown;

class WebSocketClient<Schema extends WebSocketSchema> implements Omit<
  WebSocket,
  `${string}EventListener` | `on${string}`
> {
  private socket?: ClientSocket;
  private _binaryType: BinaryType = 'blob';

  private _onopen: WebSocketClientEventListener<Schema, 'open'> | null = null;
  private _onmessage: WebSocketClientEventListener<Schema, 'message'> | null = null;
  private _onclose: WebSocketClientEventListener<Schema, 'close'> | null = null;
  private _onerror: WebSocketClientEventListener<Schema, 'error'> | null = null;

  private listeners: {
    [Type in WebSocketEventType<Schema>]: Map<
      WebSocketClientEventListener<Schema, Type>,
      WebSocketClientRawEventListener
    >;
  } = {
    open: new Map(),
    message: new Map(),
    close: new Map(),
    error: new Map(),
  };

  constructor(
    private _url: string,
    private protocols?: string | string[],
  ) {}

  static CONNECTING = ClientSocket.CONNECTING;

  get CONNECTING() {
    return WebSocketClient.CONNECTING;
  }

  static OPEN = ClientSocket.OPEN;

  get OPEN() {
    return WebSocketClient.OPEN;
  }

  static CLOSING = ClientSocket.CLOSING;

  get CLOSING() {
    return WebSocketClient.CLOSING;
  }

  static CLOSED = ClientSocket.CLOSED;

  get CLOSED() {
    return WebSocketClient.CLOSED;
  }

  get binaryType() {
    return this.socket?.binaryType ?? this._binaryType;
  }

  set binaryType(value: 'blob' | 'arraybuffer') {
    this._binaryType = value;

    if (this.socket) {
      this.socket.binaryType = value;
    }
  }

  get url() {
    return this.socket?.url ?? this._url;
  }

  get protocol() {
    return this.socket?.protocol ?? '';
  }

  get extensions() {
    return this.socket?.extensions ?? '';
  }

  get readyState() {
    return this.socket?.readyState ?? ClientSocket.CLOSED;
  }

  get bufferedAmount() {
    return this.socket?.bufferedAmount ?? 0;
  }

  async open(options: { timeout?: number } = {}) {
    const socket = new ClientSocket(this.url, this.protocols);

    if (socket.binaryType !== this.binaryType) {
      socket.binaryType = this.binaryType;
    }

    this.applyListeners(socket);

    await openClientSocket(socket, options);

    this.socket = socket;
  }

  private applyListeners(socket: ClientSocket) {
    for (const type of ['open', 'message', 'close', 'error'] as const) {
      const unitaryListener = this[`on${type}`] as WebSocketClientEventListener<Schema, typeof type> | null;
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

  addEventListener<Type extends WebSocketEventType<Schema>>(
    type: Type,
    listener: (this: WebSocketClient<Schema>, event: WebSocketEvent<Schema, Type>) => unknown,
    options?: boolean | AddEventListenerOptions,
  ) {
    const rawListener = listener.bind(this) as WebSocketClientRawEventListener;

    this.socket?.addEventListener(type, rawListener, options);
    this.listeners[type].set(listener, rawListener);
  }

  removeEventListener<Type extends WebSocketEventType<Schema>>(
    type: Type,
    listener: (this: WebSocketClient<Schema>, event: WebSocketEvent<Schema, Type>) => unknown,
    options?: boolean | EventListenerOptions,
  ) {
    const rawListener = this.listeners[type].get(listener);

    if (rawListener) {
      this.socket?.removeEventListener(type, rawListener, options);
      this.listeners[type].delete(listener);
    }
  }

  get onopen() {
    return this._onopen;
  }

  set onopen(listener: WebSocketClientEventListener<Schema, 'open'> | null) {
    this.setEventListener('open', listener);
  }

  get onmessage() {
    return this._onmessage;
  }

  set onmessage(listener: WebSocketClientEventListener<Schema, 'message'> | null) {
    this.setEventListener('message', listener);
  }

  get onclose() {
    return this._onclose;
  }

  set onclose(listener: WebSocketClientEventListener<Schema, 'close'> | null) {
    this.setEventListener('close', listener);
  }

  get onerror() {
    return this._onerror;
  }

  set onerror(listener: WebSocketClientEventListener<Schema, 'error'> | null) {
    this.setEventListener('error', listener);
  }

  private setEventListener<
    Type extends WebSocketEventType<Schema>,
    Listener extends WebSocketClientEventListener<Schema, Type> | null,
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

  dispatchEvent<Type extends WebSocketEventType<Schema>>(event: WebSocketEvent<Schema, Type>) {
    return this.socket?.dispatchEvent(event) ?? false;
  }
}

export default WebSocketClient;
