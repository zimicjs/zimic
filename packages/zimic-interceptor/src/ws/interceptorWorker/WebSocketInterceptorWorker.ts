import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { removeArrayElement } from '@/utils/arrays';
import { isClientSide } from '@/utils/environment';

import { WebSocketInterceptorPlatform } from '../interceptor/types/options';
import { InternalWebSocketInterceptorClient } from '../interceptor/WebSocketInterceptorHandle';
import { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';
import type {
  AnyWebSocketMessageHandlerImplementation,
  WebSocketMessageHandlerMessageMatch,
} from '../messageHandler/WebSocketMessageHandlerImplementation';
import { normalizeWebSocketMessageData } from '../utils/messageData';

interface WebSocketMessageHandler {
  interceptor: AnyWebSocketInterceptorImplementation;
  implementation: AnyWebSocketMessageHandlerImplementation;
}

export interface WebSocketConnectionHolder {
  interceptor: AnyWebSocketInterceptorImplementation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: InternalWebSocketInterceptorClient<any>;
}

interface FailedWebSocketMessageMatch {
  handler: AnyWebSocketMessageHandlerImplementation;
  messageMatch: Extract<WebSocketMessageHandlerMessageMatch, { success: false }>;
}

export interface WebSocketMessageHandling {
  handled: boolean;
  error?: boolean;
}

abstract class WebSocketInterceptorWorker {
  platform: WebSocketInterceptorPlatform | null = null;
  isRunning = false;

  private startingPromise?: Promise<void>;
  private stoppingPromise?: Promise<void>;

  private runningInterceptors: AnyWebSocketInterceptorImplementation[] = [];
  private messageHandlers: WebSocketMessageHandler[] = [];

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

  protected clearMessageHandlers<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema> | undefined,
  ) {
    this.messageHandlers =
      interceptor === undefined ? [] : this.messageHandlers.filter((handler) => handler.interceptor !== interceptor);
  }

  // The handlers of all interceptors holding the connection are tried together, from the last created to the first, so
  // a newer handler wins regardless of the start order of its interceptor. Holders are ordered from oldest to newest.
  protected async handleMessageWithHandlers(
    data: WebSocketMessageData<WebSocketSchema>,
    holders: readonly WebSocketConnectionHolder[],
  ): Promise<WebSocketMessageHandling> {
    const message = normalizeWebSocketMessageData<WebSocketSchema>(data);
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

      const context = { sender: holder.client, receiver: holder.interceptor.server };

      try {
        const messageMatch = await handler.implementation.matchesMessage(message, context);

        if (messageMatch.success) {
          await holder.interceptor.handleMatchedMessage(handler.implementation, messageMatch.message, context);
          return { handled: true };
        }

        failedMessageMatches.push({ handler: handler.implementation, messageMatch });
      } catch (error) {
        console.error(error);

        // A handler that threw may have already counted the message, such as toward its `times` limit, so older
        // handlers are not tried. Unlike HTTP, the message is not unhandled, because there is no reply to reject.
        return { handled: false, error: true };
      }
    }

    this.markMessageAsUnhandled(message, failedMessageMatches);

    // Holders that let the connection go while the message was handled no longer decide its strategy. If none is left,
    // the connection is closed and the message is dropped, as a cleared interceptor does not save the messages it was
    // handling.
    const newestHolder = holders.findLast((holder) => this.isHoldingConnection(holder));
    await newestHolder?.interceptor.logUnhandledMessageIfNecessary(data);

    return { handled: false };
  }

  // A holder lists the client from the moment it accepts the connection until it lets the connection go.
  private isHoldingConnection(holder: WebSocketConnectionHolder) {
    return holder.interceptor.clients.includes(holder.client);
  }

  // Handlers that failed only on restrictions record their diffs. The newest handler that failed for any other cause,
  // such as exceeding its `times` limit, is still marked as matched to trigger a times check error.
  private markMessageAsUnhandled(message: WebSocketSchema, failedMessageMatches: FailedWebSocketMessageMatch[]) {
    for (const { handler, messageMatch } of failedMessageMatches) {
      if (messageMatch.cause === 'unmatchedRestrictions') {
        handler.markMessageAsUnmatched(messageMatch.message, { diff: messageMatch.diff });
      } else {
        handler.markMessageAsMatched(message);
        break;
      }
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

  abstract clearHandlers<Schema extends WebSocketSchema>(options?: {
    interceptor?: AnyWebSocketInterceptorImplementation<Schema>;
    preserveInterceptorRegistration?: boolean;
  }): PossiblePromise<void>;
}

export default WebSocketInterceptorWorker;
