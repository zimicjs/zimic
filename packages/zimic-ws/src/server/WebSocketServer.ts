import { getHttpServerHostname, getHttpServerPort } from '@zimic/utils/server';
import { PossiblePromise } from '@zimic/utils/types';
import { Server as HttpServer, IncomingMessage } from 'http';
import { Server as HttpsServer } from 'https';
import { WebSocketServer as NodeWebSocketServer } from 'ws';

import { WebSocketClient } from '@/client/WebSocketClient';
import { WebSocketSchema } from '@/types/schema';

import ClosedWebSocketServerError from './errors/ClosedWebSocketServerError';
import {
  closeWebSocketServer,
  openWebSocketServer,
  WebSocketServerCloseOptions,
  WebSocketServerOpenOptions,
} from './utils/lifecycle';

export namespace WebSocketServer {
  /** The events emitted by a WebSocket server. */
  export type EventType = 'listening' | 'connection' | 'error' | 'close';

  /** Listener parameters for each server event. */
  export interface EventListenerParameters<Schema extends WebSocketSchema> {
    connection: [client: WebSocketClient<Schema>, request: IncomingMessage];
    error: [error: Error];
    close: [];
    listening: [];
  }

  /** A listener for a server event. The listener's `this` value is the server. */
  export type EventListener<Schema extends WebSocketSchema, Type extends EventType> = (
    this: WebSocketServer<Schema>,
    ...parameters: EventListenerParameters<Schema>[Type]
  ) => PossiblePromise<void>;
}

/** Options for constructing a WebSocket server around an HTTP or HTTPS server. */
export interface WebSocketServerOptions {
  /** The HTTP or HTTPS server that accepts WebSocket connections. */
  httpServer: HttpServer | HttpsServer;
}

export interface WebSocketServerRawEventListenerParameters {
  connection: [client: WebSocket, request: IncomingMessage];
  error: [error: Error];
  close: [];
  listening: [];
}

type WebSocketServerRawEventListener<Type extends WebSocketServer.EventType> = (
  ...parameters: WebSocketServerRawEventListenerParameters[Type]
) => void;

/**
 * A schema-aware WebSocket server.
 *
 * @see {@link https://zimic.dev/docs/ws `@zimic/ws` documentation}
 */
export class WebSocketServer<Schema extends WebSocketSchema> {
  #httpServer: HttpServer | HttpsServer;
  #webSocketServer?: NodeWebSocketServer;

  private listeners: {
    [Type in WebSocketServer.EventType]: Map<
      WebSocketServer.EventListener<Schema, Type>,
      WebSocketServerRawEventListener<Type>
    >;
  } = {
    connection: new Map(),
    listening: new Map(),
    close: new Map(),
    error: new Map(),
  };

  constructor(options: WebSocketServerOptions) {
    this.#httpServer = options.httpServer;
  }

  /** The WebSocket base URL. Throws if the server is not open. */
  get baseURL() {
    if (!this.isOpen) {
      throw new ClosedWebSocketServerError();
    }
    return `${this.protocol}://${this.hostname}:${this.port}`;
  }

  /** The `ws` or `wss` protocol selected by the underlying HTTP server. */
  get protocol() {
    return this.#httpServer instanceof HttpsServer ? 'wss' : 'ws';
  }

  /** The hostname accepting WebSocket connections. Throws if the server is not open. */
  get hostname() {
    if (!this.isOpen) {
      throw new ClosedWebSocketServerError();
    }
    return getHttpServerHostname(this.#httpServer);
  }

  /** The port accepting WebSocket connections. Throws if the server is not open. */
  get port() {
    if (!this.isOpen) {
      throw new ClosedWebSocketServerError();
    }
    return getHttpServerPort(this.#httpServer);
  }

  /** Whether both the HTTP server and WebSocket server are open. */
  get isOpen() {
    return this.#httpServer.listening && this.#webSocketServer !== undefined;
  }

  /** Opens the WebSocket server and waits for the HTTP server to listen. */
  async open(options?: WebSocketServerOpenOptions) {
    if (this.isOpen) {
      return;
    }

    const webSocketServer = new NodeWebSocketServer({ server: this.#httpServer });

    try {
      for (const [type, listeners] of Object.entries(this.listeners)) {
        for (const [_listener, rawListener] of listeners) {
          webSocketServer.addListener(type, rawListener);
        }
      }

      await openWebSocketServer(this.#httpServer, webSocketServer, options);
    } catch (error) {
      await closeWebSocketServer(webSocketServer);
      throw error;
    }

    this.#webSocketServer = webSocketServer;
  }

  /** Closes the WebSocket server and its connected clients. */
  async close(options?: WebSocketServerCloseOptions) {
    if (!this.#webSocketServer) {
      return;
    }

    await closeWebSocketServer(this.#webSocketServer, options);

    this.#webSocketServer = undefined;
  }

  /** Registers a connection listener receiving a schema-aware client. */
  addEventListener(type: 'connection', listener: WebSocketServer.EventListener<Schema, 'connection'>): void;
  /** Registers an error listener. */
  addEventListener(type: 'error', listener: WebSocketServer.EventListener<Schema, 'error'>): void;
  /** Registers a listening or close listener. */
  addEventListener(
    type: 'listening' | 'close',
    listener: WebSocketServer.EventListener<Schema, 'listening' | 'close'>,
  ): void;
  addEventListener<Type extends WebSocketServer.EventType>(
    type: Type,
    listener: WebSocketServer.EventListener<Schema, Type>,
  ) {
    const rawListener = this.createRawListener(type, listener);
    this.#webSocketServer?.on(type, rawListener);
    this.listeners[type].set(listener, rawListener);
  }

  private createRawListener<Type extends WebSocketServer.EventType>(
    type: Type,
    listener: WebSocketServer.EventListener<Schema, Type>,
  ) {
    switch (type) {
      case 'connection': {
        const typedListener = listener as WebSocketServer.EventListener<Schema, 'connection'>;

        return ((...[rawClient, ...parameters]: WebSocketServerRawEventListenerParameters['connection']) => {
          const wrappedClient =
            rawClient instanceof WebSocketClient ? rawClient : new WebSocketClient<Schema>(rawClient);

          typedListener.call(this, wrappedClient, ...parameters);
        }) as WebSocketServerRawEventListener<Type>;
      }

      case 'listening':
      case 'error':
      case 'close':
      default:
        return listener.bind(this) as WebSocketServerRawEventListener<Type>;
    }
  }

  /** Removes a previously registered connection listener. */
  removeEventListener(type: 'connection', listener: WebSocketServer.EventListener<Schema, 'connection'>): void;
  /** Removes a previously registered error listener. */
  removeEventListener(type: 'error', listener: WebSocketServer.EventListener<Schema, 'error'>): void;
  /** Removes a previously registered listening or close listener. */
  removeEventListener(
    type: 'listening' | 'close',
    listener: WebSocketServer.EventListener<Schema, 'listening' | 'close'>,
  ): void;
  removeEventListener<Type extends WebSocketServer.EventType>(
    type: Type,
    listener: WebSocketServer.EventListener<Schema, Type>,
  ) {
    const rawListener = this.listeners[type].get(listener);

    if (rawListener) {
      this.#webSocketServer?.off(type, rawListener);
      this.listeners[type].delete(listener);
    }
  }

  /** Emits an event to registered listeners. */
  emit<Type extends WebSocketServer.EventType>(
    type: Type,
    ...parameters: WebSocketServer.EventListenerParameters<Schema>[Type]
  ) {
    if (this.#webSocketServer) {
      this.#webSocketServer.emit(type, ...parameters);
    } else {
      for (const [listener] of this.listeners[type]) {
        listener.call(this, ...parameters);
      }
    }
  }
}
