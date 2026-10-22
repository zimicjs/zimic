import { excludeNonPathParams } from '@zimic/utils/url';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import { SharedOptions as MSWWorkerSharedOptions, ws } from 'msw';

import LocalMSWWorkerStore from '@/interceptor/LocalMSWWorkerStore';
import { removeArrayElement } from '@/utils/arrays';
import { WEB_SOCKET_CLOSE_CODES } from '@/utils/webSocket/constants';

import NotRunningWebSocketInterceptorError from '../interceptor/errors/NotRunningWebSocketInterceptorError';
import UnknownWebSocketInterceptorPlatformError from '../interceptor/errors/UnknownWebSocketInterceptorPlatformError';
import {
  createWebSocketInterceptorClient,
  InternalWebSocketInterceptorClient,
} from '../interceptor/WebSocketInterceptorHandle';
import WebSocketInterceptorImplementation, {
  AnyWebSocketInterceptorImplementation,
} from '../interceptor/WebSocketInterceptorImplementation';
import type { MSWWebSocketHandler, MSWWorker } from './types/msw';
import { LocalWebSocketInterceptorWorkerOptions } from './types/options';
import WebSocketInterceptorWorker from './WebSocketInterceptorWorker';

interface LocalWebSocketClientConnection {
  url: URL;
  send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
  close: (code?: number, reason?: string) => void;
  addEventListener: ((
    type: 'message',
    listener: (event: MessageEvent<string | ArrayBufferLike | Blob | ArrayBufferView>) => void,
  ) => void) &
    ((type: 'close', listener: () => void, options?: AddEventListenerOptions | boolean) => void);
  removeEventListener: ((
    type: 'message',
    listener: (event: MessageEvent<string | ArrayBufferLike | Blob | ArrayBufferView>) => void,
  ) => void) &
    ((type: 'close', listener: () => void, options?: EventListenerOptions | boolean) => void);
}

interface WebSocketClientRegistration {
  connection: LocalWebSocketClientConnection;
  messageListener: (event: MessageEvent<string | ArrayBufferLike | Blob | ArrayBufferView>) => void;
  closeListener: () => void;
}

interface WebSocketHandler {
  interceptor: AnyWebSocketInterceptorImplementation;
  link: ReturnType<typeof ws.link>;
  mswHandler: MSWWebSocketHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clients: Map<InternalWebSocketInterceptorClient<any>, WebSocketClientRegistration>;
}

// MSW tests links against connection URLs without their search params and trailing slash. A base URL with a trailing
// slash therefore also receives the URL without it, which no interceptor owns by raw prefix and must pass through.
function createConnectionURLRegex(baseURL: string) {
  const baseURLWithoutTrailingSlash = baseURL.replace(/\/$/, '');
  const escapedBaseURL = baseURLWithoutTrailingSlash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const hasTrailingSlash = baseURLWithoutTrailingSlash !== baseURL;
  return new RegExp(hasTrailingSlash ? `^${escapedBaseURL}(?:/|$)` : `^${escapedBaseURL}`);
}

class LocalWebSocketInterceptorWorker extends WebSocketInterceptorWorker {
  private store = new LocalMSWWorkerStore();

  private webSocketHandlers: WebSocketHandler[] = [];
  private passedThroughClients = new WeakSet<LocalWebSocketClientConnection>();

  constructor(_options: LocalWebSocketInterceptorWorkerOptions) {
    super();
  }

  get class() {
    return LocalWebSocketInterceptorWorker;
  }

  static get isMSWWorkerRunning() {
    return LocalMSWWorkerStore.isMSWWorkerRunning;
  }

  get mswWorkerOrThrow() {
    /* istanbul ignore if -- @preserve
     * The shared MSW worker is process-static; after any local worker starts, this guard is order-dependent in tests. */
    if (!this.store.mswWorker) {
      throw new NotRunningWebSocketInterceptorError();
    }
    return this.store.mswWorker;
  }

  async getMSWWorkerOrCreate() {
    return this.store.getMSWWorkerOrCreate({
      createUnknownPlatformError:
        /* istanbul ignore next -- @preserve
         * Unknown runtime platforms are not part of the package test matrix. */
        () => new UnknownWebSocketInterceptorPlatformError(),
    });
  }

  async start() {
    await super.sharedStart(async () => {
      const mswWorker = await this.getMSWWorkerOrCreate();

      const sharedOptions: MSWWorkerSharedOptions = {
        onUnhandledRequest: 'bypass',
      };

      if (this.isInternalBrowserWorker(mswWorker)) {
        this.platform = 'browser';
      } else {
        this.platform = 'node';
      }

      await this.store.startMSWWorker(mswWorker, sharedOptions);
      this.isRunning = true;
    });
  }

  async stop() {
    await super.sharedStop(async () => {
      const mswWorker = await this.getMSWWorkerOrCreate();

      this.clearHandlers();

      this.store.stopMSWWorker(mswWorker);
      this.isRunning = false;
    });
  }

  private isInternalBrowserWorker(worker: MSWWorker) {
    /* istanbul ignore next -- @preserve
     * The test matrix runs on one platform at a time, so only one branch can be exercised in a given coverage run. */
    return this.store.isInternalBrowserWorker(worker);
  }

  hasInternalBrowserWorker() {
    const mswWorker = this.mswWorkerOrThrow;

    /* istanbul ignore next -- @preserve
     * The test matrix runs on one platform at a time, so only one branch can be exercised in a given coverage run. */
    return this.isInternalBrowserWorker(mswWorker);
  }

  hasInternalNodeWorker() {
    /* istanbul ignore next -- @preserve
     * The test matrix runs on one platform at a time, so only one branch can be exercised in a given coverage run. */
    return !this.hasInternalBrowserWorker();
  }

  use<Schema extends WebSocketSchema>(interceptor: WebSocketInterceptorImplementation<Schema>) {
    if (!this.isRunning) {
      throw new NotRunningWebSocketInterceptorError();
    }

    const link = ws.link(createConnectionURLRegex(interceptor.baseURLAsString));
    const webSocketHandler: WebSocketHandler = {
      interceptor,
      link,
      mswHandler: link.addEventListener('connection', ({ client: rawClient, server }) => {
        const client = rawClient as LocalWebSocketClientConnection;
        const connectionOwner = this.findConnectionOwner(client.url);

        if (!connectionOwner) {
          this.passConnectionThrough(client, server);
          return;
        }

        // Unlike HTTP requests, connections do not fall back to other interceptors. A connection belongs to one
        // interceptor for its whole lifetime, so its clients, connection listeners, and server sends stay unambiguous.
        if (connectionOwner !== webSocketHandler) {
          return;
        }

        const interceptorClient = createWebSocketInterceptorClient<Schema>(client.url.href, (data) =>
          client.send(data),
        );

        async function messageListener(event: MessageEvent<string | ArrayBufferLike | Blob | ArrayBufferView>) {
          event.preventDefault();

          try {
            await interceptor.handleInterceptedMessage(event.data as WebSocketMessageData<Schema>, {
              sender: interceptorClient,
              receiver: interceptor.server,
            });
          } catch (error) {
            console.error(error);
          }
        }

        function closeListener() {
          webSocketHandler.clients.delete(interceptorClient);
          interceptor.removeClient(interceptorClient);
        }

        webSocketHandler.clients.set(interceptorClient, {
          connection: client,
          messageListener,
          closeListener,
        });
        interceptor.addClient(interceptorClient);

        client.addEventListener('message', messageListener);
        client.addEventListener('close', closeListener, { once: true });
      }),
      clients: new Map(),
    };

    this.webSocketHandlers.push(webSocketHandler);

    const mswWorker = this.mswWorkerOrThrow;
    mswWorker.use(webSocketHandler.mswHandler);
  }

  sendToClient<Schema extends WebSocketSchema>(
    client: InternalWebSocketInterceptorClient<Schema>,
    data: WebSocketMessageData<Schema>,
  ) {
    const handler = this.findHandlerByClient(client);
    handler?.clients.get(client)?.connection.send(data);
  }

  sendToClients<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
    data: WebSocketMessageData<Schema>,
  ) {
    const handler = this.findHandlerByInterceptor(interceptor);

    for (const client of handler?.clients.values() ?? []) {
      client.connection.send(data);
    }
  }

  private passConnectionThrough(client: LocalWebSocketClientConnection, server: { connect: () => void }) {
    // Every link that received the connection runs this, but the connection must reach the network only once.
    if (this.passedThroughClients.has(client)) {
      return;
    }

    this.passedThroughClients.add(client);
    server.connect();
  }

  private findConnectionOwner(connectionURL: URL) {
    const connectionURLAsString = excludeNonPathParams(new URL(connectionURL)).href;

    return this.webSocketHandlers.findLast((handler) => {
      return connectionURLAsString.startsWith(handler.interceptor.baseURLAsString);
    });
  }

  private findHandlerByClient<Schema extends WebSocketSchema>(client: InternalWebSocketInterceptorClient<Schema>) {
    return this.webSocketHandlers.find((handler) => handler.clients.has(client));
  }

  private findHandlerByInterceptor<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
  ) {
    return this.webSocketHandlers.find((handler) => handler.interceptor === interceptor);
  }

  clearHandlers<Schema extends WebSocketSchema>(options?: {
    interceptor?: WebSocketInterceptorImplementation<Schema>;
    preserveInterceptorRegistration?: boolean;
  }) {
    if (!this.isRunning) {
      throw new NotRunningWebSocketInterceptorError();
    }

    const selectedHandlers = this.webSocketHandlers.filter((handler) => {
      return options?.interceptor === undefined || handler.interceptor === options.interceptor;
    });

    for (const handler of selectedHandlers) {
      for (const [interceptorClient, registration] of handler.clients) {
        registration.connection.removeEventListener('message', registration.messageListener);
        registration.connection.removeEventListener('close', registration.closeListener);
        handler.interceptor.removeClient(interceptorClient);
        registration.connection.close(WEB_SOCKET_CLOSE_CODES.DEFAULT);
      }

      handler.clients.clear();
    }

    if (options?.preserveInterceptorRegistration) {
      return;
    }

    for (const handler of selectedHandlers) {
      removeArrayElement(this.webSocketHandlers, handler);
    }

    const mswWorker = this.mswWorkerOrThrow;
    const remainingHandlers = mswWorker.listHandlers().filter((handler) => {
      return !selectedHandlers.some((selectedHandler) => selectedHandler.mswHandler === handler);
    });

    mswWorker.resetHandlers(...remainingHandlers);
  }
}

export default LocalWebSocketInterceptorWorker;
