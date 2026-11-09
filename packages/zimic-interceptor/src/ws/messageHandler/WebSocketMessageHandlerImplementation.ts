import { blobEquals, jsonContains, jsonEquals } from '@zimic/utils/data';
import { waitForDelay } from '@zimic/utils/time';
import { Range } from '@zimic/utils/types';
import { WebSocketMessageSchema, WebSocketSchema } from '@zimic/ws';

import { random } from '@/utils/numbers';

import WebSocketTimesCheckError from '../errors/WebSocketTimesCheckError';
import WebSocketTimesDeclarationPointer from '../errors/WebSocketTimesDeclarationPointer';
import { ReceivedWebSocketMessageData, WebSocketInterceptorClient } from '../interceptor/types/messages';
import { WebSocketInterceptorPathMessage } from '../interceptor/types/schema';
import {
  InternalWebSocketInterceptorClient,
  InternalWebSocketInterceptorServer,
} from '../interceptor/WebSocketInterceptorHandle';
import { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';
import {
  createWebSocketInterceptorMessageHandlerIndex,
  type WebSocketInterceptorMessageHandlerIndex,
} from '../interceptor/WebSocketInterceptorMessageStore';
import {
  isWebSocketBinaryMessageData,
  normalizeWebSocketBinaryMessageData,
  serializeWebSocketMessageDataForSocket,
} from '../utils/messageData';
import DisabledMessageSavingError from './errors/DisabledMessageSavingError';
import { WebSocketMessageHandlerDelayFactory } from './types/messages';
import {
  WebSocketMessageHandlerMessageCallback,
  WebSocketMessageHandlerMessageComputedDeclaration,
  WebSocketMessageHandlerMessageDeclaration,
  InternalWebSocketMessageHandler,
} from './types/public';
import {
  UnmatchedWebSocketInterceptorMessageGroup,
  WebSocketMessageHandlerComputedRestriction,
  WebSocketMessageHandlerRestriction,
  WebSocketMessageHandlerRestrictionDiffs,
  WebSocketMessageHandlerRestrictionMatch,
  WebSocketMessageHandlerStaticRestriction,
  WebSocketMessageHandlerStaticRestrictionOptions,
} from './types/restrictions';

const DEFAULT_NUMBER_OF_MESSAGE_LIMITS: Range<number> = Object.freeze({
  min: 0,
  max: Infinity,
});

export type WebSocketMessageHandlerMessageMatch =
  | { success: true }
  | { success: false; cause: 'clearedHandler' | 'exceededNumberOfMessages' }
  | {
      success: false;
      cause: 'unmatchedRestrictions';
      diff: WebSocketMessageHandlerRestrictionDiffs<WebSocketMessageSchema>;
    };

export interface WebSocketMessageHandlerApplyContext<
  Schema extends WebSocketSchema = WebSocketSchema,
  Path extends string = string,
> {
  sender: InternalWebSocketInterceptorClient<Schema, Path>;
  receiver: InternalWebSocketInterceptorServer<Schema>;
}

class WebSocketMessageHandlerImplementation<
  Schema extends WebSocketSchema,
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> {
  private restrictions: {
    restriction: WebSocketMessageHandlerRestriction<RestrictedMessage>;
    options: WebSocketMessageHandlerStaticRestrictionOptions;
  }[] = [];

  private restrictedSender?: WebSocketInterceptorClient<Schema>;

  private limits = {
    numberOfMessages: DEFAULT_NUMBER_OF_MESSAGE_LIMITS,
  };

  private timesPointer?: WebSocketTimesDeclarationPointer;

  private numberOfMatchedMessages = 0;
  private unmatchedMessageGroups: UnmatchedWebSocketInterceptorMessageGroup<
    WebSocketInterceptorPathMessage<Schema, Path>
  >[] = [];
  private savedMessageIndex: WebSocketInterceptorMessageHandlerIndex<Schema, Path, RestrictedMessage>;

  private createResponseDeclaration?: WebSocketMessageHandlerMessageComputedDeclaration<
    Schema,
    Path,
    RestrictedMessage
  >;

  private createResponseDelay?: WebSocketMessageHandlerDelayFactory<RestrictedMessage>;

  private applyEffect?: WebSocketMessageHandlerMessageCallback<Schema, Path, RestrictedMessage>;

  #clearGeneration = {};

  // Handlers match messages without a declared response, so a cleared handler would keep shadowing older handlers. As
  // with a cleared HTTP handler, it stops matching until it is declared again.
  private isCleared = false;

  constructor(
    private interceptor: AnyWebSocketInterceptorImplementation,
    readonly path: Path | undefined,
    private handler: InternalWebSocketMessageHandler<Schema, Path, RestrictedMessage>,
  ) {
    this.savedMessageIndex = createWebSocketInterceptorMessageHandlerIndex<Schema, Path, RestrictedMessage>();
  }

  from(sender: WebSocketInterceptorClient<Schema>) {
    this.restrictedSender = sender;
    this.isCleared = false;
    return this;
  }

  with(
    restriction: WebSocketMessageHandlerRestriction<RestrictedMessage>,
    options: WebSocketMessageHandlerStaticRestrictionOptions = {},
  ) {
    this.restrictions.push({ restriction, options });
    this.isCleared = false;
    return this;
  }

  delay(
    minMilliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedMessage>,
    maxMilliseconds?: number,
  ): this {
    this.isCleared = false;

    if (minMilliseconds === maxMilliseconds) {
      return this.delay(minMilliseconds);
    }

    if (typeof minMilliseconds === 'number' && typeof maxMilliseconds === 'number') {
      this.createResponseDelay = () => random(minMilliseconds, maxMilliseconds);
      return this;
    }

    if (typeof minMilliseconds === 'number') {
      this.createResponseDelay = () => minMilliseconds;
      return this;
    }

    this.createResponseDelay = minMilliseconds;
    return this;
  }

  effect(callback: WebSocketMessageHandlerMessageCallback<Schema, Path, RestrictedMessage>) {
    this.applyEffect = callback;
    this.isCleared = false;
    this.resetMatchedMessages();
    this.interceptor.registerMessageHandler(this.handler);
    return this;
  }

  respond(declaration: WebSocketMessageHandlerMessageDeclaration<Schema, Path, RestrictedMessage>) {
    this.createResponseDeclaration = this.isResponseDeclarationFactory(declaration) ? declaration : () => declaration;
    this.isCleared = false;
    this.resetMatchedMessages();
    this.interceptor.registerMessageHandler(this.handler);
    return this;
  }

  private isResponseDeclarationFactory(
    declaration: WebSocketMessageHandlerMessageDeclaration<Schema, Path, RestrictedMessage>,
  ) {
    return typeof declaration === 'function';
  }

  times(minNumberOfMessages: number, maxNumberOfMessages?: number) {
    this.limits.numberOfMessages = {
      min: minNumberOfMessages,
      max: maxNumberOfMessages ?? minNumberOfMessages,
    };

    this.timesPointer = new WebSocketTimesDeclarationPointer(minNumberOfMessages, maxNumberOfMessages);
    this.isCleared = false;

    return this;
  }

  checkTimes() {
    const isWithinLimits =
      this.numberOfMatchedMessages >= this.limits.numberOfMessages.min &&
      this.numberOfMatchedMessages <= this.limits.numberOfMessages.max;

    if (!isWithinLimits) {
      throw new WebSocketTimesCheckError({
        subject: 'message',
        limits: this.limits.numberOfMessages,
        numberOfMatches: this.numberOfMatchedMessages,
        declarationPointer: this.timesPointer,
        unmatchedGroups: this.unmatchedMessageGroups,
        hasRestrictions: this.restrictions.length > 0 || this.restrictedSender !== undefined,
        messageSaving: this.interceptor.messageSaving,
      });
    }
  }

  get clearGeneration() {
    return this.#clearGeneration;
  }

  clear() {
    this.#clearGeneration = {};
    this.isCleared = true;

    this.restrictions.length = 0;
    this.restrictedSender = undefined;

    this.limits = {
      numberOfMessages: DEFAULT_NUMBER_OF_MESSAGE_LIMITS,
    };

    this.timesPointer = undefined;

    this.resetMatchedMessages();

    this.createResponseDeclaration = undefined;
    this.createResponseDelay = undefined;
    this.applyEffect = undefined;

    return this;
  }

  private resetMatchedMessages() {
    this.numberOfMatchedMessages = 0;
    this.unmatchedMessageGroups.length = 0;
    this.clearInterceptedMessages();
  }

  async matchesMessage(
    message: ReceivedWebSocketMessageData<WebSocketInterceptorPathMessage<Schema, Path>>,
    context: WebSocketMessageHandlerApplyContext<Schema, Path>,
  ): Promise<WebSocketMessageHandlerMessageMatch> {
    const clearGeneration = this.#clearGeneration;

    const restrictionsMatch = await this.matchesRestrictions(message, context);

    // Checked after the restrictions because the handler may be cleared while they are matched asynchronously, even if
    // it is redeclared afterward.
    if (this.isCleared || clearGeneration !== this.#clearGeneration) {
      return { success: false, cause: 'clearedHandler' };
    }

    if (!restrictionsMatch.success) {
      return { success: false, cause: 'unmatchedRestrictions', diff: restrictionsMatch.diff };
    }

    if (!this.canAcceptMoreMessages()) {
      return { success: false, cause: 'exceededNumberOfMessages' };
    }

    return { success: true };
  }

  // Concurrent messages can reach the limit while this one is matched asynchronously, so the limit is checked again in
  // the same synchronous step that counts the message.
  reserveMessage(): WebSocketMessageHandlerMessageMatch {
    if (!this.canAcceptMoreMessages()) {
      return { success: false, cause: 'exceededNumberOfMessages' };
    }

    this.numberOfMatchedMessages++;
    return { success: true };
  }

  private canAcceptMoreMessages() {
    return this.numberOfMatchedMessages < this.limits.numberOfMessages.max;
  }

  private async matchesRestrictions(
    message: ReceivedWebSocketMessageData<WebSocketInterceptorPathMessage<Schema, Path>>,
    context: WebSocketMessageHandlerApplyContext<Schema, Path>,
  ): Promise<WebSocketMessageHandlerRestrictionMatch<WebSocketInterceptorPathMessage<Schema, Path>>> {
    if (this.restrictedSender && context.sender !== this.restrictedSender) {
      return {
        success: false,
        diff: { sender: { expected: true, received: false } },
      };
    }

    for (const { restriction, options } of this.restrictions) {
      if (this.isComputedMessageRestriction(restriction)) {
        const matchesComputedRestriction = await restriction(this.assumeMessageMatchesRestrictions(message));

        if (!matchesComputedRestriction) {
          return {
            success: false,
            diff: { computed: { expected: true, received: false } },
          };
        }
        continue;
      }

      const matchesStaticRestriction = await this.matchesStaticMessageRestriction(message, restriction, options);

      if (!matchesStaticRestriction) {
        return {
          success: false,
          diff: { data: { expected: restriction, received: message } },
        };
      }
    }

    return { success: true };
  }

  private isComputedMessageRestriction(
    restriction: WebSocketMessageHandlerRestriction<RestrictedMessage>,
  ): restriction is WebSocketMessageHandlerComputedRestriction<RestrictedMessage> {
    return typeof restriction === 'function';
  }

  private async matchesStaticMessageRestriction(
    message: ReceivedWebSocketMessageData<WebSocketInterceptorPathMessage<Schema, Path>>,
    restriction: WebSocketMessageHandlerStaticRestriction<RestrictedMessage>,
    options: WebSocketMessageHandlerStaticRestrictionOptions,
  ) {
    if (isWebSocketBinaryMessageData(restriction)) {
      if (!isWebSocketBinaryMessageData(message)) {
        return false;
      }

      return this.binaryMessageDataEquals(message, restriction);
    }

    if (isWebSocketBinaryMessageData(message)) {
      return false;
    }

    if (typeof message === 'string' && typeof restriction === 'string') {
      return options.exact ? message === restriction : message.includes(restriction);
    }

    return options.exact ? jsonEquals(message, restriction) : jsonContains(message, restriction);
  }

  private async binaryMessageDataEquals(actual: Blob | BufferSource, expected: Blob | BufferSource) {
    const actualBlob = this.normalizeBinaryMessageDataToBlob(actual);
    const expectedBlob = this.normalizeBinaryMessageDataToBlob(expected);

    return blobEquals(actualBlob, expectedBlob);
  }

  private normalizeBinaryMessageDataToBlob(data: Blob | BufferSource) {
    const normalizedData = normalizeWebSocketBinaryMessageData(data);
    return normalizedData instanceof Blob ? normalizedData : new Blob([normalizedData]);
  }

  private assumeMessageMatchesRestrictions(
    message: ReceivedWebSocketMessageData<WebSocketInterceptorPathMessage<Schema, Path>>,
  ) {
    return message as ReceivedWebSocketMessageData<RestrictedMessage>;
  }

  markMessageAsMatched() {
    this.numberOfMatchedMessages++;
  }

  markMessageAsUnmatched(
    message: ReceivedWebSocketMessageData<WebSocketInterceptorPathMessage<Schema, Path>>,
    options: { diff: WebSocketMessageHandlerRestrictionDiffs<WebSocketInterceptorPathMessage<Schema, Path>> },
  ) {
    const shouldSaveUnmatchedMessages =
      this.interceptor.messageSaving.enabled &&
      (this.restrictions.length > 0 || this.restrictedSender !== undefined) &&
      this.timesPointer !== undefined;

    if (shouldSaveUnmatchedMessages) {
      this.unmatchedMessageGroups.push({ message, diff: options.diff });
    }
  }

  // Called in the same synchronous step that reserves the message, so the captured generation is the one the message
  // was counted in. Returns the response to send, which is `undefined` if none is declared, or `null` if the message was
  // not handled.
  async applyDeclarations(
    message: ReceivedWebSocketMessageData<WebSocketInterceptorPathMessage<Schema, Path>>,
    context: WebSocketMessageHandlerApplyContext<Schema, Path>,
  ): Promise<{ response: WebSocketInterceptorPathMessage<Schema, Path> | undefined } | null> {
    const clearGeneration = this.#clearGeneration;
    const restrictedMessage = this.assumeMessageMatchesRestrictions(message);

    if (this.createResponseDelay) {
      const delay = await this.createResponseDelay(restrictedMessage);

      if (delay > 0) {
        await waitForDelay(delay);
      }
    }

    // A message whose handler was cleared during its delay is not handled, even if the handler was redeclared.
    if (clearGeneration !== this.#clearGeneration) {
      return null;
    }

    await this.applyEffect?.(restrictedMessage, context);

    // A message whose handler was cleared while its effect ran is not handled, even if the handler was redeclared.
    if (clearGeneration !== this.#clearGeneration) {
      return null;
    }

    // The interceptor checks the clear generation again after the response is computed.
    const response = await this.createResponseDeclaration?.(restrictedMessage, context);
    return { response };
  }

  sendResponse(
    response: WebSocketInterceptorPathMessage<Schema, Path>,
    context: WebSocketMessageHandlerApplyContext<Schema, Path>,
  ) {
    context.sender.send(serializeWebSocketMessageDataForSocket(response));
  }

  saveInterceptedMessage(
    message: ReceivedWebSocketMessageData<WebSocketInterceptorPathMessage<Schema, Path>>,
    context: WebSocketMessageHandlerApplyContext<Schema, Path>,
  ) {
    this.interceptor.messageStore.save(this.savedMessageIndex, this.assumeMessageMatchesRestrictions(message), context);
  }

  private clearInterceptedMessages() {
    this.interceptor.messageStore.clearHandler(this.savedMessageIndex);
  }

  get messages() {
    if (!this.interceptor.messageSaving.enabled) {
      throw new DisabledMessageSavingError();
    }
    return this.savedMessageIndex.messages;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWebSocketMessageHandlerImplementation = WebSocketMessageHandlerImplementation<any, any, any>;

export default WebSocketMessageHandlerImplementation;
