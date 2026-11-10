import { WebSocketSchema, WebSocketSchemaPath } from '@zimic/ws';

import LocalWebSocketConnectionHandler from '../connectionHandler/LocalWebSocketConnectionHandler';
import LocalWebSocketMessageHandler from '../messageHandler/LocalWebSocketMessageHandler';
import {
  WebSocketInterceptorClient as PublicWebSocketInterceptorClient,
  WebSocketInterceptorServer as PublicWebSocketInterceptorServer,
} from './types/messages';
import { LocalWebSocketInterceptorOptions, UnhandledMessageStrategy } from './types/options';
import {
  LocalWebSocketInterceptor as PublicLocalWebSocketInterceptor,
  WebSocketInterceptorConnectionSaving,
  WebSocketInterceptorMessageSaving,
} from './types/public';
import { WebSocketInterceptorHandlerPath } from './types/schema';
import WebSocketInterceptorImplementation from './WebSocketInterceptorImplementation';
import WebSocketInterceptorStore from './WebSocketInterceptorStore';

class LocalWebSocketInterceptor<Schema extends WebSocketSchema> implements PublicLocalWebSocketInterceptor<Schema> {
  private store = new WebSocketInterceptorStore();

  implementation: WebSocketInterceptorImplementation<Schema>;

  constructor(options: LocalWebSocketInterceptorOptions) {
    const baseURL = new URL(options.baseURL);

    this.implementation = new WebSocketInterceptorImplementation<Schema>({
      baseURL,
      messageSaving: options.messageSaving,
      connectionSaving: options.connectionSaving,
      onUnhandledMessage: options.onUnhandledMessage,
      protocol: options.protocol,
      type: 'local',
      getAuth: undefined,
      MessageHandler: LocalWebSocketMessageHandler,
      ConnectionHandler: LocalWebSocketConnectionHandler,
      createWorker: () => this.store.getOrCreateLocalWorker({}),
      deleteWorker: () => this.store.deleteLocalWorker(),
    });
  }

  get type() {
    return 'local' as const;
  }

  get baseURL() {
    return this.implementation.baseURLAsString;
  }

  set baseURL(baseURL: LocalWebSocketInterceptorOptions['baseURL']) {
    this.implementation.baseURL = new URL(baseURL);
  }

  get platform() {
    return this.implementation.platform;
  }

  get isRunning() {
    return this.implementation.isRunning;
  }

  get messageSaving() {
    return this.implementation.messageSaving;
  }

  set messageSaving(messageSaving: WebSocketInterceptorMessageSaving) {
    this.implementation.messageSaving = messageSaving;
  }

  get connectionSaving() {
    return this.implementation.connectionSaving;
  }

  set connectionSaving(connectionSaving: WebSocketInterceptorConnectionSaving) {
    this.implementation.connectionSaving = connectionSaving;
  }

  get onUnhandledMessage() {
    return this.implementation.onUnhandledMessage;
  }

  set onUnhandledMessage(onUnhandledMessage: UnhandledMessageStrategy | undefined) {
    this.implementation.onUnhandledMessage = onUnhandledMessage;
  }

  message<Path extends WebSocketSchemaPath.NonLiteral<Schema> = never>(path?: Path) {
    return this.implementation.message<WebSocketInterceptorHandlerPath<Schema, Path>>(
      path,
    ) as LocalWebSocketMessageHandler<Schema, WebSocketInterceptorHandlerPath<Schema, Path>>;
  }

  connection<Path extends WebSocketSchemaPath.NonLiteral<Schema> = never>(path?: Path) {
    return this.implementation.connection<WebSocketInterceptorHandlerPath<Schema, Path>>(
      path,
    ) as LocalWebSocketConnectionHandler<Schema, WebSocketInterceptorHandlerPath<Schema, Path>>;
  }

  get server(): PublicWebSocketInterceptorServer<Schema> {
    return this.implementation.server;
  }

  get clients(): readonly PublicWebSocketInterceptorClient<Schema>[] {
    return this.implementation.clients;
  }

  async start() {
    await this.implementation.start();
  }

  async stop() {
    await this.implementation.stop();
  }

  checkTimes() {
    this.implementation.checkTimes();
  }

  clear() {
    void this.implementation.clear();
  }
}

export default LocalWebSocketInterceptor;
