import { getHttpServerHostname, getHttpServerPort } from '@zimic/utils/server';
import { PossiblePromise } from '@zimic/utils/types';
import { Server as HttpServer, IncomingMessage } from 'http';
import { Server as HttpsServer } from 'https';
import { WebSocketServer as NodeWebSocketServer } from 'ws';

import { WebSocketClient } from '@/client/WebSocketClient';
import { WebSocketSchema } from '@/types/schema';

import {
  closeWebSocketServer,
  openWebSocketServer,
  WebSocketServerCloseOptions,
  WebSocketServerOpenOptions,
} from './utils/lifecycle';

export namespace WebSocketServer {
  export type EventType = 'listening' | 'connection' | 'error' | 'close';

  interface EventListenerParameters<Schema extends WebSocketSchema> {
    connection: [client: WebSocketClient<Schema>, request: IncomingMessage];
    error: [error: Error];
    close: [];
    listening: [];
  }

  export type EventListener<Schema extends WebSocketSchema, Type extends EventType> = (
    this: WebSocketServer<Schema>,
    ...parameters: EventListenerParameters<Schema>[Type]
  ) => PossiblePromise<void>;
}

export interface WebSocketServerOptions {
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

  get baseURL() {
    return `${this.protocol}://${this.hostname}:${this.port}`;
  }

  get protocol() {
    return this.#httpServer instanceof HttpsServer ? 'https' : 'http';
  }

  get hostname() {
    return getHttpServerHostname(this.#httpServer);
  }

  get port() {
    return getHttpServerPort(this.#httpServer);
  }

  get httpServer() {
    return this.#httpServer;
  }

  get isOpen() {
    return this.#httpServer.listening && this.#webSocketServer !== undefined;
  }

  async open(options: WebSocketServerOpenOptions = {}) {
    if (this.#webSocketServer) {
      await this.close();
    }

    this.#webSocketServer = new NodeWebSocketServer({ server: this.#httpServer });

    for (const [type, listeners] of Object.entries(this.listeners)) {
      for (const [_listener, rawListener] of listeners) {
        this.#webSocketServer.addListener(type, rawListener);
      }
    }

    await openWebSocketServer(this.#httpServer, this.#webSocketServer, options);
  }

  async close(options: WebSocketServerCloseOptions = {}) {
    if (!this.#webSocketServer) {
      return;
    }

    await closeWebSocketServer(this.#httpServer, this.#webSocketServer, options);
    this.#webSocketServer = undefined;
  }

  addEventListener(type: 'connection', listener: WebSocketServer.EventListener<Schema, 'connection'>): void;
  addEventListener(type: 'error', listener: WebSocketServer.EventListener<Schema, 'error'>): void;
  addEventListener(
    type: 'listening' | 'close',
    listener: WebSocketServer.EventListener<Schema, 'listening' | 'close'>,
  ): void;
  addEventListener<Type extends WebSocketServer.EventType>(
    type: Type,
    listener: WebSocketServer.EventListener<Schema, Type>,
  ) {
    const rawListener = this.createRawListener(type, listener);
    this.#webSocketServer?.addListener(type, rawListener);
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
          typedListener.call(this, new WebSocketClient<Schema>(rawClient), ...parameters);
        }) as WebSocketServerRawEventListener<Type>;
      }

      case 'listening':
      case 'error':
      case 'close':
      default:
        return listener.bind(this) as WebSocketServerRawEventListener<Type>;
    }
  }

  removeEventListener(type: 'connection', listener: WebSocketServer.EventListener<Schema, 'connection'>): void;
  removeEventListener(type: 'error', listener: WebSocketServer.EventListener<Schema, 'error'>): void;
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
      this.#webSocketServer?.removeListener(type, rawListener);
      this.listeners[type].delete(listener);
    }
  }
}
