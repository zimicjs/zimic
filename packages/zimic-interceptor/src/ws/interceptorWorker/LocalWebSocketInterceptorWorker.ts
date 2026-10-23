import { excludeNonPathParams } from '@zimic/utils/url';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import { SharedOptions as MSWWorkerSharedOptions, ws } from 'msw';

import LocalMSWWorkerStore from '@/interceptor/LocalMSWWorkerStore';
import { removeArrayElement } from '@/utils/arrays';
import { isURLUnderBaseURL } from '@/utils/urls';
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

interface WebSocketConnectionHolder {
  handler: WebSocketHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: InternalWebSocketInterceptorClient<any>;
}

interface WebSocketClientRegistration {
  connection: LocalWebSocketClientConnection;
  // Kept in the order the interceptors started, so the last holder is the newest.
  holders: WebSocketConnectionHolder[];
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

// Same pattern MSW uses to remove a leading socket.io path from connection URLs, including its unescaped dot.
const MSW_SOCKET_IO_PATH_REGEX = /^\/socket.io\//;

const SOCKET_IO_PATH = '/socket.io/';

function getMSWBaseURL(baseURL: string) {
  const { origin, pathname } = new URL(baseURL);
  const mswPathname = pathname.replace(MSW_SOCKET_IO_PATH_REGEX, '/');

  if (mswPathname !== pathname) {
    return `${origin}${mswPathname}`;
  }

  // A base path that a socket.io path can start with, such as the root path, also covers socket.io URLs, whose rewritten
  // paths can be anything.
  const canPrefixSocketIOPath = MSW_SOCKET_IO_PATH_REGEX.test(pathname + SOCKET_IO_PATH.slice(pathname.length));

  if (canPrefixSocketIOPath) {
    return `${origin}/`;
  }

  return baseURL;
}

// MSW tests links against connection URLs without their search params, trailing slash, and leading socket.io path, so
// a link accepts the URLs under its base URL in that form. It therefore also receives URLs no interceptor owns by raw
// prefix, such as the base URL without its trailing slash or a socket.io base URL without its socket.io path, which must
// pass through.
function createConnectionURLRegex(baseURL: string) {
  const mswBaseURL = getMSWBaseURL(baseURL);

  const baseURLWithoutTrailingSlash = mswBaseURL.replace(/\/$/, '');
  const escapedBaseURL = baseURLWithoutTrailingSlash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const hasTrailingSlash = baseURLWithoutTrailingSlash !== mswBaseURL;
  return new RegExp(hasTrailingSlash ? `^${escapedBaseURL}(?:/|$)` : `^${escapedBaseURL}`);
}

class LocalWebSocketInterceptorWorker extends WebSocketInterceptorWorker {
  private store = new LocalMSWWorkerStore();

  private webSocketHandlers: WebSocketHandler[] = [];
  private routedConnections = new WeakSet<LocalWebSocketClientConnection>();

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
      mswHandler: link.addEventListener('connection', ({ client, server }) => {
        this.routeConnection(client, server);
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

  private routeConnection(connection: LocalWebSocketClientConnection, server: { connect: () => void }) {
    // Every link that received the connection runs this, but the connection must be routed only once.
    if (this.routedConnections.has(connection)) {
      return;
    }

    this.routedConnections.add(connection);

    const holderHandlers = this.findConnectionHolders(connection.url);

    if (holderHandlers.length === 0) {
      server.connect();
      return;
    }

    // A connection is shared by every interceptor matching it when it opens, so each of them lists the client and can
    // send to it. Interceptors started later do not hold it, because joining an open connection would fire connection
    // listeners with no network counterpart.
    const registration: WebSocketClientRegistration = {
      connection,
      holders: holderHandlers.map((handler) => ({
        handler,
        client: createWebSocketInterceptorClient<WebSocketSchema>(connection.url.href, (data) => connection.send(data)),
      })),
      messageListener: (event) => {
        event.preventDefault();
        void this.handleConnectionMessage(registration, event.data as WebSocketMessageData<WebSocketSchema>);
      },
      closeListener: () => {
        this.removeConnectionFromHolders(registration);
      },
    };

    for (const { handler, client } of registration.holders) {
      handler.clients.set(client, registration);
    }

    connection.addEventListener('message', registration.messageListener);
    connection.addEventListener('close', registration.closeListener, { once: true });

    // Every holder lists the client before any connection listener runs, so a listener that clears another holder makes
    // it let the connection go, as in remote mode.
    for (const { handler, client } of registration.holders) {
      if (handler.clients.has(client)) {
        handler.interceptor.addClient(client);
      }
    }
  }

  private findConnectionHolders(connectionURL: URL) {
    const connectionURLAsString = excludeNonPathParams(new URL(connectionURL)).href;

    return this.webSocketHandlers.filter((handler) => {
      return isURLUnderBaseURL(connectionURLAsString, handler.interceptor.baseURLAsString);
    });
  }

  private async handleConnectionMessage(
    registration: WebSocketClientRegistration,
    data: WebSocketMessageData<WebSocketSchema>,
  ) {
    const { holders } = registration;

    // Messages fall through holders from the last started to the first, as HTTP requests fall through interceptors.
    for (let holderIndex = holders.length - 1; holderIndex >= 0; holderIndex--) {
      const { handler, client } = holders[holderIndex];

      // A holder cleared while a newer one was handling the message no longer holds the connection, and handling the
      // message would add the client back to it.
      const isStillHolding = handler.clients.has(client);

      if (!isStillHolding) {
        continue;
      }

      try {
        const { handled } = await handler.interceptor.handleInterceptedMessage(data, {
          sender: client,
          receiver: handler.interceptor.server,
        });

        if (handled) {
          return;
        }
      } catch (error) {
        console.error(error);

        // A handler that threw may have already counted the message, such as toward its `times` limit, so older
        // interceptors are not tried.
        return;
      }
    }

    // Holders that let the connection go while the message was handled no longer decide its strategy. If none is left,
    // the connection is closed and the message is dropped, as a cleared interceptor does not save the messages it was
    // handling.
    const newestHolder = holders.findLast(({ handler, client }) => handler.clients.has(client));

    if (newestHolder) {
      await newestHolder.handler.interceptor.logUnhandledMessageIfNecessary(data);
    }
  }

  private removeConnectionFromHolders(registration: WebSocketClientRegistration) {
    for (const { handler, client } of registration.holders) {
      handler.clients.delete(client);
      handler.interceptor.removeClient(client);
    }
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
      for (const [client, registration] of handler.clients) {
        handler.clients.delete(client);
        handler.interceptor.removeClient(client);

        // Clearing or stopping one interceptor must not affect the others, so a shared connection stays open until its
        // last holder lets it go.
        const isStillHeld = registration.holders.some((holder) => holder.handler.clients.has(holder.client));

        if (!isStillHeld) {
          registration.connection.removeEventListener('message', registration.messageListener);
          registration.connection.removeEventListener('close', registration.closeListener);
          registration.connection.close(WEB_SOCKET_CLOSE_CODES.DEFAULT);
        }
      }
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
