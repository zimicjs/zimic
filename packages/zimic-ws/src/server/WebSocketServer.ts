import { getHttpServerHostname, getHttpServerPort } from '@zimic/utils/server';
import { PossiblePromise } from '@zimic/utils/types';
import { closeWebSocketServer } from '@zimic/utils/ws';
import { Server as HttpServer, IncomingMessage } from 'http';
import { Server as HttpsServer } from 'https';
import { WebSocketServer as NodeWebSocketServer } from 'ws';

import { WebSocketClient } from '@/client/WebSocketClient';
import { WebSocketSchema, WebSocketSchemaPath } from '@/types/schema';

import ClosedWebSocketServerError from './errors/ClosedWebSocketServerError';
import { openWebSocketServer, WebSocketServerCloseOptions, WebSocketServerOpenOptions } from './utils/lifecycle';

export namespace WebSocketServer {
  /**
   * The types of the events emitted by a {@link WebSocketServer}.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serveraddeventlistener `server.addEventListener()` API reference}
   */
  export type EventType = 'listening' | 'connection' | 'error' | 'close';

  /**
   * The parameters of the listeners of a {@link WebSocketServer}, by event type.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serveraddeventlistener `server.addEventListener()` API reference}
   */
  export interface EventListenerParameters<Schema extends WebSocketSchema> {
    // A server accepts connections to any path of its schema, so its clients can exchange the messages of any of them.
    connection: [client: WebSocketClient<Schema, WebSocketSchemaPath.Literal<Schema>>, request: IncomingMessage];
    error: [error: Error];
    close: [];
    listening: [];
  }

  /**
   * A listener of the events emitted by a {@link WebSocketServer}, by event type.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serveraddeventlistener `server.addEventListener()` API reference}
   */
  export type EventListener<Schema extends WebSocketSchema, Type extends EventType> = (
    this: WebSocketServer<Schema>,
    ...parameters: EventListenerParameters<Schema>[Type]
  ) => PossiblePromise<void>;
}

/**
 * The options to create a {@link WebSocketServer}.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-server#constructor `WebSocketServer` constructor API reference}
 */
export interface WebSocketServerOptions {
  /**
   * The HTTP or HTTPS server whose WebSocket upgrades the server handles.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#constructor `WebSocketServer` constructor API reference}
   */
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
 * A WebSocket server typed with a {@link WebSocketSchema}, attached to a Node.js HTTP or HTTPS server.
 *
 * @see {@link https://zimic.dev/docs/ws/api/websocket-server `WebSocketServer` API reference}
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

  /**
   * Creates a server that handles the WebSocket upgrades of an HTTP or HTTPS server once opened.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#constructor `WebSocketServer` constructor API reference}
   */
  constructor(options: WebSocketServerOptions) {
    this.#httpServer = options.httpServer;
  }

  /**
   * The base URL of the server, such as `ws://127.0.0.1:3000`.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serverbaseurl `server.baseURL` API reference}
   */
  get baseURL() {
    if (!this.isOpen) {
      throw new ClosedWebSocketServerError();
    }
    return `${this.protocol}://${this.hostname}:${this.port}`;
  }

  /**
   * The protocol of the server: `wss` for HTTPS servers and `ws` for HTTP servers.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serverprotocol `server.protocol` API reference}
   */
  get protocol() {
    return this.#httpServer instanceof HttpsServer ? 'wss' : 'ws';
  }

  /**
   * The hostname of the HTTP or HTTPS server.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serverhostname `server.hostname` API reference}
   */
  get hostname() {
    if (!this.isOpen) {
      throw new ClosedWebSocketServerError();
    }
    return getHttpServerHostname(this.#httpServer);
  }

  /**
   * The port of the HTTP or HTTPS server.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serverport `server.port` API reference}
   */
  get port() {
    if (!this.isOpen) {
      throw new ClosedWebSocketServerError();
    }
    return getHttpServerPort(this.#httpServer);
  }

  /**
   * Whether the WebSocket server is open and its HTTP or HTTPS server is listening.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serverisopen `server.isOpen` API reference}
   */
  get isOpen() {
    return this.#httpServer.listening && this.#webSocketServer !== undefined;
  }

  /**
   * Starts handling WebSocket connections, waiting for the HTTP or HTTPS server to listen if needed.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serveropen `server.open()` API reference}
   */
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

  /**
   * Closes the connected clients and stops handling WebSocket connections, keeping the HTTP or HTTPS server open.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serverclose `server.close()` API reference}
   */
  async close(options?: WebSocketServerCloseOptions) {
    if (!this.#webSocketServer) {
      return;
    }

    await closeWebSocketServer(this.#webSocketServer, options);

    this.#webSocketServer = undefined;
  }

  /**
   * Adds a listener for connections, called with each connected client and its upgrade request.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serveraddeventlistener `server.addEventListener()` API reference}
   */
  addEventListener(type: 'connection', listener: WebSocketServer.EventListener<Schema, 'connection'>): void;
  /**
   * Adds a listener for server errors.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serveraddeventlistener `server.addEventListener()` API reference}
   */
  addEventListener(type: 'error', listener: WebSocketServer.EventListener<Schema, 'error'>): void;
  /**
   * Adds a listener for when the server starts listening or closes.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serveraddeventlistener `server.addEventListener()` API reference}
   */
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
            rawClient instanceof WebSocketClient
              ? rawClient
              : (new WebSocketClient<WebSocketSchema>(rawClient) as unknown as WebSocketClient<
                  Schema,
                  WebSocketSchemaPath.Literal<Schema>
                >);

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

  /**
   * Removes a connection listener added with `addEventListener()`.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serverremoveeventlistener `server.removeEventListener()` API reference}
   */
  removeEventListener(type: 'connection', listener: WebSocketServer.EventListener<Schema, 'connection'>): void;
  /**
   * Removes an error listener added with `addEventListener()`.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serverremoveeventlistener `server.removeEventListener()` API reference}
   */
  removeEventListener(type: 'error', listener: WebSocketServer.EventListener<Schema, 'error'>): void;
  /**
   * Removes a listening or close listener added with `addEventListener()`.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serverremoveeventlistener `server.removeEventListener()` API reference}
   */
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

  /**
   * Emits a server event, calling its listeners with the given parameters.
   *
   * @see {@link https://zimic.dev/docs/ws/api/websocket-server#serveremit `server.emit()` API reference}
   */
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
