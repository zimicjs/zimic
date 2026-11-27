import { HttpSearchParams } from '@zimic/utils/http';
import { PossiblePromise } from '@zimic/utils/types';
import { createRegexFromPath, validatePathParams } from '@zimic/utils/url';
import { WebSocketMessageData, WebSocketMessageSchema, WebSocketSchema } from '@zimic/ws';

import { removeArrayElement } from '@/utils/arrays';
import { isClientSide } from '@/utils/environment';
import { createPathMatchingURL, parsePathParams } from '@/utils/urls';

import type {
  AnyWebSocketConnectionHandlerImplementation,
  WebSocketConnectionHandlerConnectionMatch,
  WebSocketConnectionHandlerDecision,
} from '../connectionHandler/WebSocketConnectionHandlerImplementation';
import {
  ReceivedWebSocketMessageData,
  WebSocketInterceptorClient,
  WebSocketInterceptorConnectionRequest,
} from '../interceptor/types/messages';
import { WebSocketInterceptorPlatform } from '../interceptor/types/options';
import type {
  WebSocketInterceptorProtocolClientOptions,
  WebSocketInterceptorProtocolConnection,
  WebSocketInterceptorProtocolConnectionClaim,
  WebSocketInterceptorProtocolOpenClientResult,
} from '../interceptor/types/protocol';
import {
  createWebSocketInterceptorClient,
  InternalWebSocketInterceptorClient,
} from '../interceptor/WebSocketInterceptorHandle';
import WebSocketInterceptorImplementation, {
  AnyWebSocketInterceptorImplementation,
} from '../interceptor/WebSocketInterceptorImplementation';
import type {
  AnyWebSocketMessageHandlerImplementation,
  WebSocketMessageHandlerApplyContext,
  WebSocketMessageHandlerMessageMatch,
} from '../messageHandler/WebSocketMessageHandlerImplementation';
import { normalizeWebSocketMessageData } from '../utils/messageData';

interface WebSocketMessageHandler {
  interceptor: AnyWebSocketInterceptorImplementation;
  implementation: AnyWebSocketMessageHandlerImplementation;
  pathRegex: RegExp | undefined;
}

interface WebSocketConnectionHolder {
  interceptor: WebSocketInterceptorImplementation<WebSocketSchema>;
  client: InternalWebSocketInterceptorClient;
}

interface RegisteredWebSocketConnectionHolder {
  registeredInterceptor: { interceptor: AnyWebSocketInterceptorImplementation };
  client: WebSocketInterceptorClient;
}

interface FailedWebSocketMessageMatch {
  handler: AnyWebSocketMessageHandlerImplementation;
  holder: WebSocketConnectionHolder;
  messageMatch: Extract<WebSocketMessageHandlerMessageMatch, { success: false }>;
}

interface WebSocketConnectionHandler {
  interceptor: AnyWebSocketInterceptorImplementation;
  implementation: AnyWebSocketConnectionHandlerImplementation;
  pathRegex: RegExp | undefined;
}

interface FailedWebSocketConnectionMatch {
  handler: WebSocketConnectionHandler;
  request: WebSocketInterceptorConnectionRequest;
  connectionMatch: Extract<WebSocketConnectionHandlerConnectionMatch, { success: false }>;
}

interface AcceptedWebSocketConnectionHandling {
  action: 'accept';
  // The handler that accepted the connection, whose effects run with the request it parsed once its interceptor lists
  // the client.
  acceptance?: {
    handler: WebSocketConnectionHandler;
    request: WebSocketInterceptorConnectionRequest;
  };
}

export type WebSocketConnectionHandling =
  AcceptedWebSocketConnectionHandling | Extract<WebSocketConnectionHandlerDecision, { action: 'reject' }>;

const UNHANDLED_CONNECTION_HANDLING: WebSocketConnectionHandling = Object.freeze({ action: 'accept' });

// Handlers cleared after the server sent a message or connection are skipped as if they were not declared.
export interface WebSocketHandlerClearChecks {
  wasClearedAfterMessage?: (handler: WebSocketMessageHandler) => boolean;
  wasClearedAfterConnection?: (handler: WebSocketConnectionHandler) => boolean;
}

// Only protocols such as Socket.IO authenticate clients, so plain WebSocket handshakes have no `auth`.
type WebSocketConnectionHandshake = Pick<WebSocketInterceptorConnectionRequest, 'url' | 'protocols'> &
  Partial<Pick<WebSocketInterceptorProtocolClientOptions<unknown>, 'auth'>>;

abstract class WebSocketInterceptorWorker {
  platform: WebSocketInterceptorPlatform | null = null;
  isRunning = false;

  private startingPromise?: Promise<void>;
  private stoppingPromise?: Promise<void>;

  private runningInterceptors: AnyWebSocketInterceptorImplementation[] = [];
  private messageHandlers: WebSocketMessageHandler[] = [];
  private connectionHandlers: WebSocketConnectionHandler[] = [];

  // Clients whose holders let the connection go. A client that closes leaves its interceptors without being released,
  // because a real server still receives the messages sent before the close.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private releasedClients = new WeakSet<InternalWebSocketInterceptorClient<any>>();

  abstract start(): Promise<void>;

  protected async sharedStart(internalStart: () => Promise<void>) {
    if (this.stoppingPromise) {
      await this.stoppingPromise;
    }

    if (this.isRunning) {
      return;
    }

    if (this.startingPromise) {
      return this.startingPromise;
    }

    try {
      this.startingPromise = internalStart();
      await this.startingPromise;
    } catch (error) {
      /* istanbul ignore if -- @preserve
       * The test matrix runs on one platform at a time, so only one branch can be exercised in a given coverage run. */
      if (!isClientSide()) {
        console.error(error);
      }

      await this.stop();
      throw error;
    } finally {
      this.startingPromise = undefined;
    }
  }

  abstract stop(): Promise<void>;

  protected async sharedStop(internalStop: () => Promise<void>) {
    if (!this.isRunning) {
      return;
    }

    if (this.stoppingPromise) {
      return this.stoppingPromise;
    }

    this.stoppingPromise = internalStop();

    try {
      await this.stoppingPromise;
    } finally {
      this.stoppingPromise = undefined;
    }
  }

  registerRunningInterceptor(interceptor: AnyWebSocketInterceptorImplementation) {
    this.runningInterceptors.push(interceptor);
  }

  unregisterRunningInterceptor(interceptor: AnyWebSocketInterceptorImplementation) {
    removeArrayElement(this.runningInterceptors, interceptor);
  }

  get numberOfRunningInterceptors() {
    return this.runningInterceptors.length;
  }

  abstract use<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
  ): PossiblePromise<void>;

  useMessageHandler<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
    handler: AnyWebSocketMessageHandlerImplementation,
  ) {
    this.messageHandlers.push({
      interceptor,
      implementation: handler,
      pathRegex: this.createHandlerPathRegex(handler),
    });
  }

  private createHandlerPathRegex(handler: { path: string | undefined }) {
    if (handler.path === undefined) {
      return undefined;
    }

    validatePathParams(handler.path);
    return createRegexFromPath(handler.path);
  }

  useConnectionHandler<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
    handler: AnyWebSocketConnectionHandlerImplementation,
  ) {
    this.connectionHandlers.push({
      interceptor,
      implementation: handler,
      pathRegex: this.createHandlerPathRegex(handler),
    });
  }

  protected clearInterceptorHandlers<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema> | undefined,
  ) {
    this.messageHandlers =
      interceptor === undefined ? [] : this.messageHandlers.filter((handler) => handler.interceptor !== interceptor);

    this.connectionHandlers =
      interceptor === undefined ? [] : this.connectionHandlers.filter((handler) => handler.interceptor !== interceptor);
  }

  // As with messages, the handlers of all interceptors that would hold the connection are tried together, from the last
  // created to the first, and the first match decides the handshake. The connection is accepted if no handler handles
  // it. Interceptors that let the connection go while it is decided no longer hold it, as reported by `isHolding`.
  protected async handleConnectionWithHandlers(
    connection: WebSocketConnectionHandshake,
    isHolding: (interceptor: AnyWebSocketInterceptorImplementation) => boolean,
    options: WebSocketHandlerClearChecks = {},
  ): Promise<WebSocketConnectionHandling> {
    const connectionURL = createPathMatchingURL(connection.url);

    const failedConnectionMatches: FailedWebSocketConnectionMatch[] = [];

    // Handlers can be added or cleared while a connection is decided, so the connection is matched against a copy.
    for (const handler of this.connectionHandlers.toReversed()) {
      const holder = handler.interceptor;

      if (
        !isHolding(holder) ||
        options.wasClearedAfterConnection?.(handler) ||
        !this.matchesHandlerPath(connectionURL, handler)
      ) {
        continue;
      }

      try {
        const request = this.parseConnectionRequest(connection, connectionURL, handler);

        const connectionMatch = await handler.implementation.matchesConnection(request);

        // As with an HTTP handler cleared while matching a request, older handlers are not tried, whatever the match
        // result.
        if (!isHolding(holder)) {
          return UNHANDLED_CONNECTION_HANDLING;
        }

        if (!connectionMatch.success) {
          failedConnectionMatches.push({ handler, request, connectionMatch });
          continue;
        }

        const reservation = handler.implementation.reserveConnection();

        if (!reservation.success) {
          failedConnectionMatches.push({ handler, request, connectionMatch: reservation });
          continue;
        }

        const decision = await holder.handleMatchedConnection(handler.implementation, request);

        if (decision === null) {
          return UNHANDLED_CONNECTION_HANDLING;
        }

        if (decision.action === 'reject') {
          return decision;
        }

        return { action: 'accept', acceptance: { handler, request } };
      } catch (error) {
        console.error(error);

        // A handler that threw may have already counted the connection, such as toward its `times` limit, so older
        // handlers are not tried.
        return UNHANDLED_CONNECTION_HANDLING;
      }
    }

    this.markConnectionAsUnhandled(failedConnectionMatches, isHolding);

    return UNHANDLED_CONNECTION_HANDLING;
  }

  private matchesHandlerPath(connectionURL: string, handler: WebSocketMessageHandler | WebSocketConnectionHandler) {
    if (handler.pathRegex === undefined) {
      return true;
    }

    const connectionPath = connectionURL.replace(handler.interceptor.baseURLAsString, '');
    return handler.pathRegex.test(connectionPath);
  }

  private parseConnectionRequest(
    connection: WebSocketConnectionHandshake,
    connectionURL: string,
    handler: WebSocketConnectionHandler,
  ): WebSocketInterceptorConnectionRequest {
    return {
      ...connection,
      searchParams: new HttpSearchParams(new URL(connection.url).searchParams),
      pathParams: parsePathParams({
        url: connectionURL,
        baseURL: handler.interceptor.baseURLAsString,
        pathRegex: handler.pathRegex,
      }),
    };
  }

  // Handlers that failed only on restrictions record their diffs. The newest handler that failed for any other cause
  // keeps older handlers from being counted. If it exceeded its `times` limit, it is still marked as matched to trigger
  // a times check error, as in HTTP. A cleared handler is not counted: unlike HTTP, where only `respond` re-enables it
  // and resets the count, `with`, `delay`, and `times` re-enable it without resetting, so the count would satisfy its
  // later limits. Handlers whose interceptor let the connection go after their match record nothing.
  private markConnectionAsUnhandled(
    failedConnectionMatches: FailedWebSocketConnectionMatch[],
    isHolding: (interceptor: AnyWebSocketInterceptorImplementation) => boolean,
  ) {
    for (const { handler, request, connectionMatch } of failedConnectionMatches) {
      if (!isHolding(handler.interceptor)) {
        continue;
      }

      if (connectionMatch.cause === 'unmatchedRestrictions') {
        handler.implementation.markConnectionAsUnmatched(request, { diff: connectionMatch.diff });
        continue;
      }

      if (connectionMatch.cause !== 'clearedHandler') {
        handler.implementation.markConnectionAsMatched();
      }

      break;
    }
  }

  // Effects run once the interceptor of the accepting handler lists the client, and do not delay the handshake, so an
  // effect waiting for a message from its client does not keep the connection from opening. Failures are logged because
  // no caller awaits them.
  protected async applyConnectionEffect(
    handling: AcceptedWebSocketConnectionHandling,
    holders: RegisteredWebSocketConnectionHolder[],
  ) {
    const { acceptance } = handling;

    if (!acceptance) {
      return;
    }

    const acceptingHolder = holders.find((holder) => {
      return holder.registeredInterceptor.interceptor === acceptance.handler.interceptor;
    });

    if (!acceptingHolder) {
      return;
    }

    try {
      await acceptance.handler.implementation.applyConnectionEffect(acceptingHolder.client, acceptance.request);
    } catch (error) {
      console.error(error);
    }
  }

  // A protocol owns the framing of the connections it claims, so it takes them alone, before interceptors without
  // protocols, which could not serve its frames. Among protocols, the newest claiming holder takes the connection, as
  // the newest handler takes precedence. Interceptors without protocols share the connections no protocol claims, and a
  // protocol serves only the connections it claims. The protocol closes a claimed connection, so it stays open after its
  // holders let it go. No caller awaits claims, so their errors are logged.
  protected routeConnectionToHolders<Holder extends { interceptor: AnyWebSocketInterceptorImplementation }>(
    connection: WebSocketInterceptorProtocolConnection,
    holders: Holder[],
  ): { claim: WebSocketInterceptorProtocolConnectionClaim } | { claim?: undefined; holders: Holder[] } {
    for (const { interceptor } of holders.toReversed()) {
      try {
        const claim = interceptor.protocol?.claimConnection(connection);

        if (claim) {
          return { claim };
        }
      } catch (error) {
        console.error(error);
      }
    }

    return { holders: holders.filter(({ interceptor }) => interceptor.protocol === undefined) };
  }

  protected async handleRawMessageWithHandlers(
    rawMessage: WebSocketMessageData<WebSocketMessageSchema>,
    holders: WebSocketConnectionHolder[],
    options: WebSocketHandlerClearChecks = {},
  ) {
    const message = await normalizeWebSocketMessageData<WebSocketMessageSchema>(rawMessage);
    await this.handleMessageWithHandlers(message, holders, options);
  }

  // Protocols decode messages, so they skip frame normalization.
  private async handleDecodedMessage(
    interceptor: AnyWebSocketInterceptorImplementation,
    client: InternalWebSocketInterceptorClient,
    message: unknown,
  ) {
    const holders = [{ interceptor, client }];

    await this.handleMessageWithHandlers(
      message as ReceivedWebSocketMessageData<WebSocketMessageSchema>,
      holders,
      this.getProtocolFrameClearChecks(),
    );
  }

  // Protocols decode messages and open clients while they handle a frame. Remote workers check them against the
  // handlers cleared after the frame was sent.
  protected getProtocolFrameClearChecks(): WebSocketHandlerClearChecks {
    return {};
  }

  // As with a pending WebSocket connection, an interceptor that lets the client go while it is decided does not list it.
  async openProtocolClient<Message>(
    interceptor: AnyWebSocketInterceptorImplementation,
    options: WebSocketInterceptorProtocolClientOptions<Message>,
  ): Promise<WebSocketInterceptorProtocolOpenClientResult> {
    function isHolding(candidate: AnyWebSocketInterceptorImplementation) {
      return candidate === interceptor && !options.signal.aborted;
    }

    const handling = await this.handleConnectionWithHandlers(
      { url: options.url, protocols: [], auth: options.auth },
      isHolding,
      this.getProtocolFrameClearChecks(),
    );

    if (!isHolding(interceptor)) {
      return { result: 'aborted' };
    }

    if (handling.action === 'reject') {
      return { result: 'rejected', error: handling.error };
    }

    // A client retained after its interceptor lets it go does nothing, as with WebSocket connection clients.
    const client = createWebSocketInterceptorClient({
      url: options.url,
      protocols: [],
      auth: options.auth,
      send: (message) => {
        if (interceptor.clients.includes(client)) {
          // Clients are schema-erased and user code may bypass types, so protocols validate what they send.
          options.send(message as Message);
        }
      },
      close: (code, reason) => {
        if (interceptor.clients.includes(client)) {
          options.close(code, reason);
        }
      },
    });

    interceptor.addClient(client);

    options.signal.addEventListener(
      'abort',
      () => {
        this.releaseClient(interceptor, client);
      },
      { once: true },
    );

    options.onOpen({
      receive: (message) => {
        void this.handleDecodedMessage(interceptor, client, message);
      },
    });

    await this.applyConnectionEffect(handling, [{ registeredInterceptor: { interceptor }, client }]);

    return { result: 'accepted' };
  }

  // The handlers of all interceptors holding the connection are tried together, from the last created to the first, so
  // a newer handler wins regardless of the start order of its interceptor. Holders are ordered from oldest to newest.
  protected async handleMessageWithHandlers(
    message: ReceivedWebSocketMessageData<WebSocketMessageSchema>,
    holders: WebSocketConnectionHolder[],
    options: WebSocketHandlerClearChecks,
  ) {
    const failedMessageMatches: FailedWebSocketMessageMatch[] = [];

    // Handlers can be added or cleared while a message is handled, so the message is matched against a copy.
    for (const handler of this.messageHandlers.toReversed()) {
      if (options.wasClearedAfterMessage?.(handler)) {
        continue;
      }

      // A holder that let the connection go while a newer handler was handling the message no longer handles it.
      const holder = holders.find((holder) => {
        return holder.interceptor === handler.interceptor && this.isHoldingConnection(holder);
      });

      if (!holder || !this.matchesHandlerPath(createPathMatchingURL(holder.client.url), handler)) {
        continue;
      }

      const context: WebSocketMessageHandlerApplyContext = {
        sender: holder.client,
        receiver: holder.interceptor.server,
      };

      try {
        const messageMatch = await handler.implementation.matchesMessage(message, context);

        // A holder that let the connection go while its handler was matching the message does not handle it. As with
        // an HTTP handler cleared while matching a request, older handlers are not tried, whatever the match result.
        if (!this.isHoldingConnection(holder)) {
          await this.logUnhandledMessageIfNecessary(message, holders);
          return;
        }

        if (!messageMatch.success) {
          failedMessageMatches.push({ handler: handler.implementation, holder, messageMatch });
          continue;
        }

        const reservation = handler.implementation.reserveMessage();

        if (!reservation.success) {
          failedMessageMatches.push({ handler: handler.implementation, holder, messageMatch: reservation });
          continue;
        }

        const wasHandled = await holder.interceptor.handleMatchedMessage(handler.implementation, message, context);

        if (!wasHandled) {
          await this.logUnhandledMessageIfNecessary(message, holders);
        }

        return;
      } catch (error) {
        console.error(error);

        // A handler that threw may have already counted the message, such as toward its `times` limit, so older
        // handlers are not tried.
        await this.logUnhandledMessageIfNecessary(message, holders);
        return;
      }
    }

    this.markMessageAsUnhandled(message, failedMessageMatches);
    await this.logUnhandledMessageIfNecessary(message, holders);
  }

  // Holders that let the connection go while the message was handled no longer decide its strategy. If none is left,
  // the connection is closed and the message is dropped, as a cleared interceptor does not save the messages it was
  // handling.
  private async logUnhandledMessageIfNecessary(
    message: ReceivedWebSocketMessageData<WebSocketMessageSchema>,
    holders: WebSocketConnectionHolder[],
  ) {
    const newestHolder = holders.findLast((holder) => this.isHoldingConnection(holder));
    await newestHolder?.interceptor.logUnhandledMessageIfNecessary(message, newestHolder.client.url);
  }

  // A released holder ignores the messages it is still handling.
  protected releaseClient<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
    client: InternalWebSocketInterceptorClient<Schema>,
  ) {
    interceptor.removeClient(client);
    this.releasedClients.add(client);
  }

  private isHoldingConnection(holder: WebSocketConnectionHolder) {
    return !this.releasedClients.has(holder.client);
  }

  // Handlers that failed only on restrictions record their diffs. The newest handler that failed for any other cause
  // keeps older handlers from being counted. If it exceeded its `times` limit, it is still marked as matched to trigger
  // a times check error, as in HTTP. A cleared handler is not counted: unlike HTTP, where only `respond` re-enables it
  // and resets the count, `from`, `with`, `delay`, and `times` re-enable it without resetting, so the count would
  // satisfy its later limits. Handlers whose holder let the connection go after their match record nothing.
  private markMessageAsUnhandled(
    message: ReceivedWebSocketMessageData<WebSocketMessageSchema>,
    failedMessageMatches: FailedWebSocketMessageMatch[],
  ) {
    for (const { handler, holder, messageMatch } of failedMessageMatches) {
      if (!this.isHoldingConnection(holder)) {
        continue;
      }

      if (messageMatch.cause === 'unmatchedRestrictions') {
        handler.markMessageAsUnmatched(message, { diff: messageMatch.diff });
        continue;
      }

      if (messageMatch.cause !== 'clearedHandler') {
        handler.markMessageAsMatched();
      }

      break;
    }
  }

  abstract clearHandlers<Schema extends WebSocketSchema>(options?: {
    interceptor?: AnyWebSocketInterceptorImplementation<Schema>;
    preserveInterceptorRegistration?: boolean;
  }): PossiblePromise<void>;

  abstract markHandlerAsCleared(
    handler: AnyWebSocketMessageHandlerImplementation | AnyWebSocketConnectionHandlerImplementation,
  ): void;
}

export default WebSocketInterceptorWorker;
