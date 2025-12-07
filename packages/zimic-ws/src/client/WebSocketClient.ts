import { WebSocketEvent, WebSocketEventType, WebSocketMessageData, WebSocketSchema } from '@/types/schema';

import { ClientSocket } from './ClientSocket';
import { closeClientSocket, openClientSocket } from './utils/lifecycle';

export type WebSocketClientEventListener<Schema extends WebSocketSchema, Type extends WebSocketEventType<Schema>> = (
  this: WebSocketClient<Schema>,
  event: WebSocketEvent<Type>,
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

  private listeners = new Map<
    WebSocketClientEventListener<Schema, WebSocketEventType<Schema>>,
    { type: WebSocketEventType<Schema>; rawListener: WebSocketClientRawEventListener }
  >();

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
    this.socket = new ClientSocket(this._url, this.protocols);

    if (this.socket.binaryType !== this._binaryType) {
      this.socket.binaryType = this._binaryType;
    }

    await openClientSocket(this.socket, options);
  }

  async close(code?: number, reason?: string, options: { timeout?: number } = {}) {
    if (!this.socket) {
      return;
    }

    try {
      await closeClientSocket(this.socket, { ...options, code, reason });
    } finally {
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;

      for (const { type, rawListener } of this.listeners.values()) {
        this.socket.removeEventListener(type, rawListener);
      }

      this.listeners.clear();

      this.socket = undefined;
    }
  }

  send(data: WebSocketMessageData<Schema>) {
    this.socket?.send(data);
  }

  addEventListener<Type extends WebSocketEventType<Schema>>(
    type: Type,
    listener: (this: WebSocketClient<Schema>, event: WebSocketEvent<Type>) => unknown,
    options?: boolean | AddEventListenerOptions,
  ) {
    const rawListener = listener.bind(this) as WebSocketClientRawEventListener;

    this.socket?.addEventListener(type, rawListener, options);
    this.listeners.set(listener, { type, rawListener });
  }

  removeEventListener<Type extends WebSocketEventType<Schema>>(
    type: Type,
    listener: (this: WebSocketClient<Schema>, event: WebSocketEvent<Type>) => unknown,
    options?: boolean | EventListenerOptions,
  ) {
    const { rawListener } = this.listeners.get(listener) ?? {};

    if (rawListener) {
      this.socket?.removeEventListener(type, rawListener, options);
      this.listeners.delete(listener);
    }
  }

  get onopen() {
    return this._onopen;
  }

  set onopen(listener: WebSocketClientEventListener<Schema, 'open'> | null) {
    this.setUnitaryEventListener('open', listener);
  }

  get onmessage() {
    return this._onmessage;
  }

  set onmessage(listener: WebSocketClientEventListener<Schema, 'message'> | null) {
    this.setUnitaryEventListener('message', listener);
  }

  get onclose() {
    return this._onclose;
  }

  set onclose(listener: WebSocketClientEventListener<Schema, 'close'> | null) {
    this.setUnitaryEventListener('close', listener);
  }

  get onerror() {
    return this._onerror;
  }

  set onerror(listener: WebSocketClientEventListener<Schema, 'error'> | null) {
    this.setUnitaryEventListener('error', listener);
  }

  private setUnitaryEventListener<Type extends WebSocketEventType<Schema>>(
    type: WebSocketEventType<Schema>,
    listener: WebSocketClientEventListener<Schema, Type> | null,
  ) {
    if (listener) {
      const rawListener = listener.bind(this) as WebSocketClientRawEventListener;
      this.listeners.set(listener, { type, rawListener });

      if (this.socket) {
        this.socket[`on${type}`] = rawListener;
      }

      this[`_on${type}`] = listener;
    } else {
      const currentListener = this[`_on${type}`];

      if (currentListener) {
        this.listeners.delete(currentListener);
      }

      if (this.socket) {
        this.socket[`on${type}`] = null;
      }

      this[`_on${type}`] = null;
    }
  }

  dispatchEvent<Type extends WebSocketEventType<Schema>>(event: WebSocketEvent<Type>) {
    return this.socket?.dispatchEvent(event) ?? false;
  }
}

export default WebSocketClient;
