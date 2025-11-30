import { WebSocketEvent, WebSocketEventType, WebSocketMessageData, WebSocketSchema } from '@/types/schema';

import { ClientSocket } from './ClientSocket';
import { closeClientSocket, openClientSocket } from './utils/lifecycle';

class WebSocketClient<Schema extends WebSocketSchema> implements Omit<
  WebSocket,
  `${string}EventListener` | `on${string}`
> {
  private socket?: ClientSocket;
  private _binaryType: BinaryType = 'blob';

  private rawListeners = new WeakMap<
    (this: WebSocketClient<Schema>, event: WebSocketEvent<never>) => unknown,
    (this: ClientSocket, event: Event) => unknown
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
    const rawListener = listener.bind(this) as (this: ClientSocket, event: Event) => unknown;

    this.socket?.addEventListener(type, rawListener, options);
    this.rawListeners.set(listener, rawListener);
  }

  removeEventListener<Type extends WebSocketEventType<Schema>>(
    type: Type,
    listener: (this: WebSocketClient<Schema>, event: WebSocketEvent<Type>) => unknown,
    options?: boolean | EventListenerOptions,
  ) {
    const rawListener = this.rawListeners.get(listener);

    if (rawListener) {
      this.socket?.removeEventListener(type, rawListener, options);
      this.rawListeners.delete(listener);
    }
  }

  get onopen() {
    return null;
  }

  set onopen(handler: ((this: WebSocketClient<Schema>, event: WebSocketEvent<'open'>) => unknown) | null) {
    if (handler) {
      this.addEventListener('open', handler);
    }
  }

  get onmessage() {
    return null;
  }

  set onmessage(handler: ((this: WebSocketClient<Schema>, event: WebSocketEvent<'message'>) => unknown) | null) {
    if (handler) {
      this.addEventListener('message', handler);
    }
  }

  get onclose() {
    return null;
  }

  set onclose(handler: ((this: WebSocketClient<Schema>, event: WebSocketEvent<'close'>) => unknown) | null) {
    if (handler) {
      this.addEventListener('close', handler);
    }
  }

  get onerror() {
    return null;
  }

  set onerror(handler: ((this: WebSocketClient<Schema>, event: WebSocketEvent<'error'>) => unknown) | null) {
    if (handler) {
      this.addEventListener('error', handler);
    }
  }

  dispatchEvent<Type extends WebSocketEventType<Schema>>(event: WebSocketEvent<Type>) {
    return this.socket?.dispatchEvent(event) ?? false;
  }
}

export default WebSocketClient;
