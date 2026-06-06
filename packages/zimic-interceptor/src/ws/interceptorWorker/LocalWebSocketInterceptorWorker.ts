import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';
import { SharedOptions as MSWWorkerSharedOptions, ws } from 'msw';

import LocalMSWWorkerStore from '@/interceptor/LocalMSWWorkerStore';
import { removeArrayElement } from '@/utils/arrays';

import NotRunningWebSocketInterceptorError from '../interceptor/errors/NotRunningWebSocketInterceptorError';
import UnknownWebSocketInterceptorPlatformError from '../interceptor/errors/UnknownWebSocketInterceptorPlatformError';
import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import WebSocketInterceptorImplementation, {
  AnyWebSocketInterceptorImplementation,
} from '../interceptor/WebSocketInterceptorImplementation';
import { MSWWebSocketHandler, MSWWorker } from './types/msw';
import { LocalWebSocketInterceptorWorkerOptions } from './types/options';
import WebSocketInterceptorWorker from './WebSocketInterceptorWorker';

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
  private store = new LocalMSWWorkerStore();

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

  static get isMSWWorkerRunning() {
    return new LocalMSWWorkerStore().isMSWWorkerRunning();
  }

  get mswWorkerOrThrow() {
    if (!this.store.mswWorker) {
      throw new NotRunningWebSocketInterceptorError();
    }
    return this.store.mswWorker;
  }

  async getMSWWorkerOrCreate() {
    return this.store.getMSWWorkerOrCreate({
      createUnknownPlatformError: () => new UnknownWebSocketInterceptorPlatformError(),
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

      if (this.numberOfRunningInterceptors > 0) {
        return;
      }

      this.clearHandlers();

      this.store.stopMSWWorker(mswWorker);
      this.isRunning = false;
    });
  }

  private isInternalBrowserWorker(worker: MSWWorker) {
    return this.store.isInternalBrowserWorker(worker);
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
