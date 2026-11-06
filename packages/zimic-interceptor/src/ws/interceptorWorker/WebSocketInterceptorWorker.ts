import { PossiblePromise } from '@zimic/utils/types';
import { createRegexFromPath, excludeNonPathParams, validatePathParams } from '@zimic/utils/url';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { removeArrayElement } from '@/utils/arrays';
import { isClientSide } from '@/utils/environment';

import type {
  AnyWebSocketConnectionHandlerImplementation,
  WebSocketConnectionHandlerAction,
  WebSocketConnectionHandlerConnectionMatch,
} from '../connectionHandler/WebSocketConnectionHandlerImplementation';
import {
  InterceptedWebSocketInterceptorConnection,
  ReceivedWebSocketMessageData,
  WebSocketInterceptorClient,
} from '../interceptor/types/messages';
import { WebSocketInterceptorPlatform } from '../interceptor/types/options';
import { InternalWebSocketInterceptorClient } from '../interceptor/WebSocketInterceptorHandle';
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
}

interface WebSocketConnectionHolder<Schema extends WebSocketSchema> {
  interceptor: WebSocketInterceptorImplementation<Schema>;
  client: InternalWebSocketInterceptorClient<Schema>;
}

interface FailedWebSocketMessageMatch {
  handler: AnyWebSocketMessageHandlerImplementation;
  holder: WebSocketConnectionHolder<WebSocketSchema>;
  messageMatch: Extract<WebSocketMessageHandlerMessageMatch, { success: false }>;
}

interface WebSocketConnectionHandler {
  interceptor: AnyWebSocketInterceptorImplementation;
  implementation: AnyWebSocketConnectionHandlerImplementation;
  pathRegex: RegExp | undefined;
}

interface FailedWebSocketConnectionMatch {
  handler: WebSocketConnectionHandler;
  connectionMatch: Extract<WebSocketConnectionHandlerConnectionMatch, { success: false }>;
}

export interface WebSocketConnectionHandling {
  action: WebSocketConnectionHandlerAction;
  // The handler that accepted the connection, whose effects run once its interceptor lists the client.
  acceptingHandler?: WebSocketConnectionHandler;
}

const UNHANDLED_CONNECTION_HANDLING: WebSocketConnectionHandling = Object.freeze({ action: 'accept' });

abstract class WebSocketInterceptorWorker {
  platform: WebSocketInterceptorPlatform | null = null;
  isRunning = false;

  private startingPromise?: Promise<void>;
  private stoppingPromise?: Promise<void>;

  private runningInterceptors: AnyWebSocketInterceptorImplementation[] = [];
  private messageHandlers: WebSocketMessageHandler[] = [];
  private connectionHandlers: WebSocketConnectionHandler[] = [];

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
    this.messageHandlers.push({ interceptor, implementation: handler });
  }

  useConnectionHandler<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
    handler: AnyWebSocketConnectionHandlerImplementation,
  ) {
    if (handler.path !== undefined) {
      validatePathParams(handler.path);
    }

    this.connectionHandlers.push({
      interceptor,
      implementation: handler,
      pathRegex: handler.path === undefined ? undefined : createRegexFromPath(handler.path),
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
    connection: InterceptedWebSocketInterceptorConnection,
    isHolding: (interceptor: AnyWebSocketInterceptorImplementation) => boolean,
  ): Promise<WebSocketConnectionHandling> {
    const connectionURLWithoutNonPathParams = excludeNonPathParams(new URL(connection.url));

    // Base URLs at the root path are bare origins, so a connection to the root path is compared without its slash.
    const connectionURL =
      connectionURLWithoutNonPathParams.href === `${connectionURLWithoutNonPathParams.origin}/`
        ? connectionURLWithoutNonPathParams.origin
        : connectionURLWithoutNonPathParams.href;

    const failedConnectionMatches: FailedWebSocketConnectionMatch[] = [];

    // Handlers can be added or cleared while a connection is decided, so the connection is matched against a copy.
    for (const handler of this.connectionHandlers.toReversed()) {
      const holder = handler.interceptor;

      if (!isHolding(holder) || !this.matchesConnectionHandlerPath(connectionURL, handler)) {
        continue;
      }

      try {
        const connectionMatch = await handler.implementation.matchesConnection(connection);

        // As with an HTTP handler cleared while matching a request, older handlers are not tried, whatever the match
        // result.
        if (!isHolding(holder)) {
          return UNHANDLED_CONNECTION_HANDLING;
        }

        if (!connectionMatch.success) {
          failedConnectionMatches.push({ handler, connectionMatch });
          continue;
        }

        const reservation = handler.implementation.reserveConnection();

        if (!reservation.success) {
          failedConnectionMatches.push({ handler, connectionMatch: reservation });
          continue;
        }

        const action = await holder.handleMatchedConnection(handler.implementation, connection);

        if (action === null) {
          return UNHANDLED_CONNECTION_HANDLING;
        }

        return { action, acceptingHandler: action === 'accept' ? handler : undefined };
      } catch (error) {
        console.error(error);

        // A handler that threw may have already counted the connection, such as toward its `times` limit, so older
        // handlers are not tried.
        return UNHANDLED_CONNECTION_HANDLING;
      }
    }

    this.markConnectionAsUnhandled(connection, failedConnectionMatches, isHolding);

    return UNHANDLED_CONNECTION_HANDLING;
  }

  private matchesConnectionHandlerPath(connectionURL: string, handler: WebSocketConnectionHandler) {
    if (handler.pathRegex === undefined) {
      return true;
    }

    const connectionPath = connectionURL.replace(handler.interceptor.baseURLAsString, '');
    return handler.pathRegex.test(connectionPath);
  }

  // Handlers that failed only on restrictions record their diffs. The newest handler that failed for any other cause
  // keeps older handlers from being counted. If it exceeded its `times` limit, it is still marked as matched to trigger
  // a times check error, as in HTTP. A cleared handler is not counted: unlike HTTP, where only `respond` re-enables it
  // and resets the count, `with`, `delay`, and `times` re-enable it without resetting, so the count would satisfy its
  // later limits. Handlers whose interceptor let the connection go after their match record nothing.
  private markConnectionAsUnhandled(
    connection: InterceptedWebSocketInterceptorConnection,
    failedConnectionMatches: FailedWebSocketConnectionMatch[],
    isHolding: (interceptor: AnyWebSocketInterceptorImplementation) => boolean,
  ) {
    for (const { handler, connectionMatch } of failedConnectionMatches) {
      if (!isHolding(handler.interceptor)) {
        continue;
      }

      if (connectionMatch.cause === 'unmatchedRestrictions') {
        handler.implementation.markConnectionAsUnmatched(connection, { diff: connectionMatch.diff });
        continue;
      }

      if (connectionMatch.cause !== 'clearedHandler') {
        handler.implementation.markConnectionAsMatched(connection);
      }

      break;
    }
  }

  // Effects run once the interceptor of the accepting handler lists the client, and do not delay the handshake, so an
  // effect waiting for a message from its client does not keep the connection from opening. Failures are logged because
  // no caller awaits them.
  protected async applyConnectionEffect<Schema extends WebSocketSchema>(
    handling: WebSocketConnectionHandling,
    client: WebSocketInterceptorClient<Schema>,
  ) {
    try {
      await handling.acceptingHandler?.implementation.applyConnectionEffect(client);
    } catch (error) {
      console.error(error);
    }
  }

  // The handlers of all interceptors holding the connection are tried together, from the last created to the first, so
  // a newer handler wins regardless of the start order of its interceptor. Holders are ordered from oldest to newest.
  protected async handleMessageWithHandlers(
    data: WebSocketMessageData<WebSocketSchema>,
    holders: WebSocketConnectionHolder<WebSocketSchema>[],
  ) {
    const message = await normalizeWebSocketMessageData<WebSocketSchema>(data);
    const failedMessageMatches: FailedWebSocketMessageMatch[] = [];

    // Handlers can be added or cleared while a message is handled, so the message is matched against a copy.
    for (const handler of this.messageHandlers.toReversed()) {
      // A holder that let the connection go while a newer handler was handling the message no longer handles it.
      const holder = holders.find((holder) => {
        return holder.interceptor === handler.interceptor && this.isHoldingConnection(holder);
      });

      if (!holder) {
        continue;
      }

      const context: WebSocketMessageHandlerApplyContext<WebSocketSchema> = {
        sender: holder.client,
        receiver: holder.interceptor.server,
      };

      try {
        const messageMatch = await handler.implementation.matchesMessage(message, context);

        // A holder that let the connection go while its handler was matching the message does not handle it. As with
        // an HTTP handler cleared while matching a request, older handlers are not tried, whatever the match result.
        if (!this.isHoldingConnection(holder)) {
          await this.logUnhandledMessageIfNecessary(data, holders);
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
          await this.logUnhandledMessageIfNecessary(data, holders);
        }

        return;
      } catch (error) {
        console.error(error);

        // A handler that threw may have already counted the message, such as toward its `times` limit, so older
        // handlers are not tried.
        await this.logUnhandledMessageIfNecessary(data, holders);
        return;
      }
    }

    this.markMessageAsUnhandled(message, failedMessageMatches);
    await this.logUnhandledMessageIfNecessary(data, holders);
  }

  // Holders that let the connection go while the message was handled no longer decide its strategy. If none is left,
  // the connection is closed and the message is dropped, as a cleared interceptor does not save the messages it was
  // handling.
  private async logUnhandledMessageIfNecessary(
    data: WebSocketMessageData<WebSocketSchema>,
    holders: WebSocketConnectionHolder<WebSocketSchema>[],
  ) {
    const newestHolder = holders.findLast((holder) => this.isHoldingConnection(holder));
    await newestHolder?.interceptor.logUnhandledMessageIfNecessary(data, newestHolder.client.url);
  }

  // A holder lists the client from the moment it accepts the connection until it lets the connection go.
  private isHoldingConnection(holder: WebSocketConnectionHolder<WebSocketSchema>) {
    return holder.interceptor.clients.includes(holder.client);
  }

  // Handlers that failed only on restrictions record their diffs. The newest handler that failed for any other cause
  // keeps older handlers from being counted. If it exceeded its `times` limit, it is still marked as matched to trigger
  // a times check error, as in HTTP. A cleared handler is not counted: unlike HTTP, where only `respond` re-enables it
  // and resets the count, `from`, `with`, `delay`, and `times` re-enable it without resetting, so the count would
  // satisfy its later limits. Handlers whose holder let the connection go after their match record nothing.
  private markMessageAsUnhandled(
    message: ReceivedWebSocketMessageData<WebSocketSchema>,
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
        handler.markMessageAsMatched(message);
      }

      break;
    }
  }

  abstract sendToClient<Schema extends WebSocketSchema>(
    client: InternalWebSocketInterceptorClient<Schema>,
    data: WebSocketMessageData<Schema>,
  ): PossiblePromise<void>;

  abstract sendToClients<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
    data: WebSocketMessageData<Schema>,
  ): PossiblePromise<void>;

  abstract closeClient<Schema extends WebSocketSchema>(
    client: InternalWebSocketInterceptorClient<Schema>,
    code?: number,
    reason?: string,
  ): PossiblePromise<void>;

  abstract clearHandlers<Schema extends WebSocketSchema>(options?: {
    interceptor?: AnyWebSocketInterceptorImplementation<Schema>;
    preserveInterceptorRegistration?: boolean;
  }): PossiblePromise<void>;
}

export default WebSocketInterceptorWorker;
