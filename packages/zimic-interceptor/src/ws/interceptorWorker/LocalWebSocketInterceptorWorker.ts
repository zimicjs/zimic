import { createCachedDynamicImport } from '@zimic/utils/import';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import { SharedOptions as MSWWorkerSharedOptions, ws } from 'msw';

import { removeArrayElement } from '@/utils/arrays';
import { isClientSide, isServerSide } from '@/utils/environment';

import UnregisteredBrowserServiceWorkerError from '../../http/interceptorWorker/errors/UnregisteredBrowserServiceWorkerError';
import NotRunningWebSocketInterceptorError from '../interceptor/errors/NotRunningWebSocketInterceptorError';
import UnknownWebSocketInterceptorPlatformError from '../interceptor/errors/UnknownWebSocketInterceptorPlatformError';
import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import WebSocketInterceptorImplementation, {
  AnyWebSocketInterceptorImplementation,
} from '../interceptor/WebSocketInterceptorImplementation';
import { BrowserMSWWorker, MSWWebSocketHandler, MSWWorker, NodeMSWWorker } from './types/msw';
import { LocalWebSocketInterceptorWorkerOptions } from './types/options';
import WebSocketInterceptorWorker from './WebSocketInterceptorWorker';

const importMSWNode = createCachedDynamicImport(() => import('msw/node'));
const importMSWBrowser = createCachedDynamicImport(() => import('msw/browser'));

interface LocalWebSocketClientConnection {
  url: URL;
  send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
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
  clients: Map<WebSocketInterceptorClient<any>, WebSocketClientRegistration>;
}

class LocalWebSocketInterceptorWorker extends WebSocketInterceptorWorker {
  private static mswWorker?: MSWWorker;
  static isMSWWorkerRunning = false;
  private static numberOfRunningWorkers = 0;

  private webSocketHandlers: WebSocketHandler[] = [];

  constructor(_options: LocalWebSocketInterceptorWorkerOptions) {
    super();
  }

  get class() {
    return LocalWebSocketInterceptorWorker;
  }

  get type() {
    return 'local' as const;
  }

  get mswWorkerOrThrow() {
    if (!this.class.mswWorker) {
      throw new NotRunningWebSocketInterceptorError();
    }
    return this.class.mswWorker;
  }

  async getMSWWorkerOrCreate() {
    this.class.mswWorker ??= await this.createMSWWorker();
    return this.class.mswWorker;
  }

  private async createMSWWorker() {
    if (isServerSide()) {
      const mswNode = await importMSWNode();

      if ('setupServer' in mswNode) {
        return mswNode.setupServer();
      }
    }

    if (isClientSide()) {
      const mswBrowser = await importMSWBrowser();

      if ('setupWorker' in mswBrowser) {
        return mswBrowser.setupWorker();
      }
    }

    throw new UnknownWebSocketInterceptorPlatformError();
  }

  async start() {
    await super.sharedStart(async () => {
      const mswWorker = await this.getMSWWorkerOrCreate();

      const sharedOptions: MSWWorkerSharedOptions = {
        onUnhandledRequest: 'bypass',
      };

      if (this.isInternalBrowserWorker(mswWorker)) {
        this.platform = 'browser';

        if (!this.class.isMSWWorkerRunning) {
          await this.startInBrowser(mswWorker, sharedOptions);
          this.class.isMSWWorkerRunning = true;
        }
      } else {
        this.platform = 'node';
        this.startInNode(mswWorker, sharedOptions);
        this.class.isMSWWorkerRunning = true;
      }

      this.class.numberOfRunningWorkers++;
      this.isRunning = true;
    });
  }

  private async startInBrowser(mswWorker: BrowserMSWWorker, sharedOptions: MSWWorkerSharedOptions) {
    try {
      await mswWorker.start({ ...sharedOptions, quiet: true });
    } catch (error) {
      this.handleBrowserWorkerStartError(error);
    }
  }

  private handleBrowserWorkerStartError(error: unknown) {
    if (UnregisteredBrowserServiceWorkerError.matchesRawError(error)) {
      throw new UnregisteredBrowserServiceWorkerError();
    } else {
      throw error;
    }
  }

  private startInNode(mswWorker: NodeMSWWorker, sharedOptions: MSWWorkerSharedOptions) {
    mswWorker.listen(sharedOptions);
  }

  async stop() {
    await super.sharedStop(async () => {
      const mswWorker = await this.getMSWWorkerOrCreate();

      this.clearHandlers();

      this.class.numberOfRunningWorkers = Math.max(this.class.numberOfRunningWorkers - 1, 0);
      this.isRunning = false;

      if (this.class.numberOfRunningWorkers > 0) {
        return;
      }

      if (this.isInternalBrowserWorker(mswWorker)) {
        // Browser workers are kept running to match local HTTP worker behavior.
      } else {
        this.stopInNode(mswWorker);
        this.class.isMSWWorkerRunning = false;
      }
    });
  }

  private stopInNode(mswWorker: NodeMSWWorker) {
    mswWorker.close();
  }

  private isInternalBrowserWorker(worker: MSWWorker) {
    return 'start' in worker && 'stop' in worker;
  }

  hasInternalBrowserWorker() {
    return this.isInternalBrowserWorker(this.mswWorkerOrThrow);
  }

  hasInternalNodeWorker() {
    return !this.hasInternalBrowserWorker();
  }

  use<Schema extends WebSocketSchema>(interceptor: WebSocketInterceptorImplementation<Schema>) {
    if (!this.isRunning) {
      throw new NotRunningWebSocketInterceptorError();
    }

    const link = ws.link(interceptor.baseURLAsString);
    const webSocketHandler: WebSocketHandler = {
      interceptor,
      link,
      mswHandler: link.addEventListener('connection', ({ client: rawClient }) => {
        const client = rawClient as LocalWebSocketClientConnection;
        const interceptorClient = interceptor.createClient(client.url.href, {
          send: (data) => client.send(data),
        });

        function messageListener(event: MessageEvent<string | ArrayBufferLike | Blob | ArrayBufferView>) {
          event.preventDefault();
          void interceptor.handleInterceptedMessage(event.data as WebSocketMessageData<Schema>, {
            sender: interceptorClient,
            receiver: interceptor.server,
          });
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
    client: WebSocketInterceptorClient<Schema>,
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

  private findHandlerByClient<Schema extends WebSocketSchema>(client: WebSocketInterceptorClient<Schema>) {
    return this.webSocketHandlers.find((handler) => handler.clients.has(client));
  }

  private findHandlerByInterceptor<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
  ) {
    return this.webSocketHandlers.find((handler) => handler.interceptor === interceptor);
  }

  clearHandlers<Schema extends WebSocketSchema>(options?: {
    interceptor?: WebSocketInterceptorImplementation<Schema>;
  }) {
    if (!this.isRunning) {
      throw new NotRunningWebSocketInterceptorError();
    }

    const removedHandlers = this.webSocketHandlers.filter((handler) => {
      return options?.interceptor === undefined || handler.interceptor === options.interceptor;
    });

    for (const handler of removedHandlers) {
      for (const [interceptorClient, registration] of handler.clients) {
        registration.connection.removeEventListener('message', registration.messageListener);
        registration.connection.removeEventListener('close', registration.closeListener);
        handler.interceptor.removeClient(interceptorClient);
      }

      removeArrayElement(this.webSocketHandlers, handler);
    }

    const mswWorker = this.mswWorkerOrThrow;
    const remainingHandlers = mswWorker.listHandlers().filter((handler) => {
      return !removedHandlers.some((removedHandler) => removedHandler.mswHandler === handler);
    });

    mswWorker.resetHandlers(...remainingHandlers);
  }
}

export default LocalWebSocketInterceptorWorker;
