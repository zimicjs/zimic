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

interface LocalWebSocketConnectionHolder {
  registeredInterceptor: RegisteredWebSocketInterceptor;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: InternalWebSocketInterceptorClient<any>;
}

interface WebSocketClientRegistration {
  connection: LocalWebSocketClientConnection;
  // Kept in the order the interceptors started, so the last holder is the newest.
  holders: LocalWebSocketConnectionHolder[];
  messageListener: (event: MessageEvent<string | ArrayBufferLike | Blob | ArrayBufferView>) => void;
  closeListener: () => void;
}

interface RegisteredWebSocketInterceptor {
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

  private registeredInterceptors: RegisteredWebSocketInterceptor[] = [];
  private routedConnections = new WeakSet<LocalWebSocketClientConnection>();

  constructor(_options: LocalWebSocketInterceptorWorkerOptions) {
    super();
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
    const registeredInterceptor: RegisteredWebSocketInterceptor = {
      interceptor,
      link,
      mswHandler: link.addEventListener('connection', ({ client, server }) => {
        this.routeConnection(client, server);
      }),
      clients: new Map(),
    };

    this.registeredInterceptors.push(registeredInterceptor);

    const mswWorker = this.mswWorkerOrThrow;
    mswWorker.use(registeredInterceptor.mswHandler);
  }

  sendToClient<Schema extends WebSocketSchema>(
    client: InternalWebSocketInterceptorClient<Schema>,
    data: WebSocketMessageData<Schema>,
  ) {
    const registeredInterceptor = this.findRegisteredInterceptorByClient(client);
    registeredInterceptor?.clients.get(client)?.connection.send(data);
  }

  sendToClients<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
    data: WebSocketMessageData<Schema>,
  ) {
    const registeredInterceptor = this.findRegisteredInterceptor(interceptor);

    for (const client of registeredInterceptor?.clients.values() ?? []) {
      client.connection.send(data);
    }
  }

  private routeConnection(connection: LocalWebSocketClientConnection, server: { connect: () => void }) {
    // Every link that received the connection runs this, but the connection must be routed only once.
    if (this.routedConnections.has(connection)) {
      return;
    }

    this.routedConnections.add(connection);

    const holderInterceptors = this.findConnectionHolders(connection.url);

    if (holderInterceptors.length === 0) {
      server.connect();
      return;
    }

    // A connection is shared by every interceptor matching it when it opens, so each of them lists the client and can
    // send to it. Interceptors started later do not hold it, because joining an open connection would fire connection
    // listeners with no network counterpart.
    const registration: WebSocketClientRegistration = {
      connection,
      holders: holderInterceptors.map((registeredInterceptor) => {
        // Sending through the holder lookup makes the client stop sending once its interceptor lets the connection go.
        const client = createWebSocketInterceptorClient<WebSocketSchema>(connection.url.href, (data) => {
          this.sendToClient(client, data);
        });
        return { registeredInterceptor, client };
      }),
      messageListener: (event) => {
        event.preventDefault();
        void this.handleConnectionMessage(registration, event.data as WebSocketMessageData<WebSocketSchema>);
      },
      closeListener: () => {
        this.removeConnectionFromHolders(registration);
      },
    };

    for (const { registeredInterceptor, client } of registration.holders) {
      registeredInterceptor.clients.set(client, registration);
    }

    connection.addEventListener('message', registration.messageListener);
    connection.addEventListener('close', registration.closeListener, { once: true });

    // Every holder lists the client before any connection listener runs, so a listener that clears another holder makes
    // it let the connection go, as in remote mode.
    for (const { registeredInterceptor, client } of registration.holders) {
      if (registeredInterceptor.clients.has(client)) {
        registeredInterceptor.interceptor.addClient(client);
      }
    }
  }

  private findConnectionHolders(connectionURL: URL) {
    const connectionURLAsString = excludeNonPathParams(new URL(connectionURL)).href;

    return this.registeredInterceptors.filter((registeredInterceptor) => {
      return isURLUnderBaseURL(connectionURLAsString, registeredInterceptor.interceptor.baseURLAsString);
    });
  }

  private async handleConnectionMessage(
    registration: WebSocketClientRegistration,
    data: WebSocketMessageData<WebSocketSchema>,
  ) {
    const holders = registration.holders.map(({ registeredInterceptor, client }) => ({
      interceptor: registeredInterceptor.interceptor,
      client,
    }));
    await this.handleMessageWithHandlers(data, holders);
  }

  private removeConnectionFromHolders(registration: WebSocketClientRegistration) {
    for (const { registeredInterceptor, client } of registration.holders) {
      registeredInterceptor.clients.delete(client);
      registeredInterceptor.interceptor.removeClient(client);
    }
  }

  private findRegisteredInterceptorByClient<Schema extends WebSocketSchema>(
    client: InternalWebSocketInterceptorClient<Schema>,
  ) {
    return this.registeredInterceptors.find((registeredInterceptor) => registeredInterceptor.clients.has(client));
  }

  private findRegisteredInterceptor<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
  ) {
    return this.registeredInterceptors.find(
      (registeredInterceptor) => registeredInterceptor.interceptor === interceptor,
    );
  }

  clearHandlers<Schema extends WebSocketSchema>(options?: {
    interceptor?: WebSocketInterceptorImplementation<Schema>;
    preserveInterceptorRegistration?: boolean;
  }) {
    if (!this.isRunning) {
      throw new NotRunningWebSocketInterceptorError();
    }

    this.clearMessageHandlers(options?.interceptor);

    const selectedInterceptors = this.registeredInterceptors.filter((registeredInterceptor) => {
      return options?.interceptor === undefined || registeredInterceptor.interceptor === options.interceptor;
    });

    for (const registeredInterceptor of selectedInterceptors) {
      for (const [client, registration] of registeredInterceptor.clients) {
        registeredInterceptor.clients.delete(client);
        registeredInterceptor.interceptor.removeClient(client);

        // Clearing or stopping one interceptor must not affect the others, so a shared connection stays open until its
        // last holder lets it go.
        const isStillHeld = registration.holders.some((holder) =>
          holder.registeredInterceptor.clients.has(holder.client),
        );

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

    for (const registeredInterceptor of selectedInterceptors) {
      removeArrayElement(this.registeredInterceptors, registeredInterceptor);
    }

    const mswWorker = this.mswWorkerOrThrow;
    const remainingHandlers = mswWorker.listHandlers().filter((handler) => {
      return !selectedInterceptors.some((selectedInterceptor) => selectedInterceptor.mswHandler === handler);
    });

    mswWorker.resetHandlers(...remainingHandlers);
  }
}

export default LocalWebSocketInterceptorWorker;
