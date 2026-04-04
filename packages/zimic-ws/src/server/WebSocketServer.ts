import { PossiblePromise } from '@zimic/utils/types';
import { Server as HttpServer, IncomingMessage } from 'http';
import { Server as HttpsServer } from 'https';
import { WebSocketServer as NodeWebSocketServer } from 'ws';

import { WebSocketClient } from '@/client/WebSocketClient';
import { WebSocketSchema } from '@/types/schema';

import { closeServerSocket, openServerSocket } from './utils/lifecycle';

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
  server: HttpServer | HttpsServer;
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
  private httpServer: HttpServer | HttpsServer;
  private webSocketServer: NodeWebSocketServer;

  #isOpen = false;

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
    this.httpServer = options.server;
    this.webSocketServer = new NodeWebSocketServer({ server: this.httpServer });
    this.#isOpen = this.httpServer.listening;
  }

  get isOpen() {
    return this.httpServer.listening && this.#isOpen;
  }

  async open(options: { timeout?: number } = {}) {
    if (this.#isOpen) {
      return;
    }

    await openServerSocket(this.httpServer, this.webSocketServer, options);
    this.#isOpen = true;
  }

  async close(options: { timeout?: number } = {}) {
    if (!this.#isOpen) {
      return;
    }

    await closeServerSocket(this.httpServer, this.webSocketServer, options);
    this.#isOpen = false;
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
    this.webSocketServer.addListener(type, rawListener);
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
      this.webSocketServer.removeListener(type, rawListener);
      this.listeners[type].delete(listener);
    }
  }
}
