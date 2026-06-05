import { blobEquals, jsonContains } from '@zimic/utils/data';
import { waitForDelay } from '@zimic/utils/time';
import { JSONValue, Range } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { random } from '@/utils/numbers';

import WebSocketTimesCheckError from '../errors/WebSocketTimesCheckError';
import WebSocketTimesDeclarationPointer from '../errors/WebSocketTimesDeclarationPointer';
import { InterceptedWebSocketInterceptorMessage, WebSocketInterceptorClient } from '../interceptor/types/messages';
import WebSocketInterceptorImplementation from '../interceptor/WebSocketInterceptorImplementation';
import {
  isWebSocketBinaryMessageData,
  normalizeWebSocketBinaryMessageData,
  serializeRuntimeWebSocketMessageData,
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
  WebSocketMessageHandlerRestriction,
  WebSocketMessageHandlerRestrictionDiffs,
  WebSocketMessageHandlerRestrictionMatch,
  WebSocketMessageHandlerStaticRestriction,
} from './types/restrictions';

const DEFAULT_NUMBER_OF_MESSAGE_LIMITS: Range<number> = Object.freeze({
  min: 0,
  max: Infinity,
});

export type WebSocketMessageHandlerMessageMatch =
  | { success: true }
  | { success: false; cause: 'exceededNumberOfMessages' }
  | { success: false; cause: 'unmatchedRestrictions'; diff: WebSocketMessageHandlerRestrictionDiffs<WebSocketSchema> };

export interface WebSocketMessageHandlerApplyContext<Schema extends WebSocketSchema> {
  sender: WebSocketInterceptorClient<Schema>;
  receiver: WebSocketInterceptorClient<Schema>;
}

class WebSocketMessageHandlerImplementation<Schema extends WebSocketSchema, RestrictedSchema extends Schema = Schema> {
  private restrictions: WebSocketMessageHandlerRestriction<RestrictedSchema>[] = [];

  private restrictedSender?: WebSocketInterceptorClient<Schema>;

  private limits = {
    numberOfMessages: DEFAULT_NUMBER_OF_MESSAGE_LIMITS,
  };

  private timesPointer?: WebSocketTimesDeclarationPointer;

  private numberOfMatchedMessages = 0;
  private unmatchedMessageGroups: UnmatchedWebSocketInterceptorMessageGroup<Schema>[] = [];
  private savedInterceptedMessages: InterceptedWebSocketInterceptorMessage<RestrictedSchema, Schema>[] = [];

  private createResponseDeclaration?: WebSocketMessageHandlerMessageComputedDeclaration<Schema, RestrictedSchema>;

  private createResponseDelay?: WebSocketMessageHandlerDelayFactory<RestrictedSchema>;

  private applyEffect?: WebSocketMessageHandlerMessageCallback<Schema, RestrictedSchema>;

  constructor(
    private interceptor: WebSocketInterceptorImplementation<Schema>,
    private handler: InternalWebSocketMessageHandler<Schema, RestrictedSchema>,
  ) {}

  from(sender: WebSocketInterceptorClient<Schema>) {
    this.restrictedSender = sender;
    return this;
  }

  with(restriction: WebSocketMessageHandlerRestriction<RestrictedSchema>) {
    this.restrictions.push(restriction);
    return this;
  }

  delay(
    minMilliseconds: number | WebSocketMessageHandlerDelayFactory<RestrictedSchema>,
    maxMilliseconds?: number,
  ): this {
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

  effect(callback: WebSocketMessageHandlerMessageCallback<Schema, RestrictedSchema>) {
    this.applyEffect = callback;
    this.resetMatchedMessages();
    this.interceptor.registerMessageHandler(this.handler);
    return this;
  }

  respond(declaration: WebSocketMessageHandlerMessageDeclaration<Schema, RestrictedSchema>) {
    this.createResponseDeclaration = this.isResponseDeclarationFactory(declaration) ? declaration : () => declaration;
    this.resetMatchedMessages();
    this.interceptor.registerMessageHandler(this.handler);
    return this;
  }

  private isResponseDeclarationFactory(
    declaration: WebSocketMessageHandlerMessageDeclaration<Schema, RestrictedSchema>,
  ) {
    return typeof declaration === 'function';
  }

  times(minNumberOfMessages: number, maxNumberOfMessages?: number) {
    this.limits.numberOfMessages = {
      min: minNumberOfMessages,
      max: maxNumberOfMessages ?? minNumberOfMessages,
    };

    this.timesPointer = new WebSocketTimesDeclarationPointer(minNumberOfMessages, maxNumberOfMessages);

    return this;
  }

  checkTimes() {
    const isWithinLimits =
      this.numberOfMatchedMessages >= this.limits.numberOfMessages.min &&
      this.numberOfMatchedMessages <= this.limits.numberOfMessages.max;

    if (!isWithinLimits) {
      throw new WebSocketTimesCheckError({
        messageLimits: this.limits.numberOfMessages,
        numberOfMatchedMessages: this.numberOfMatchedMessages,
        declarationPointer: this.timesPointer,
        unmatchedMessageGroups: this.unmatchedMessageGroups,
        hasRestrictions: this.restrictions.length > 0 || this.restrictedSender !== undefined,
        messageSaving: this.interceptor.messageSaving,
      });
    }
  }

  clear() {
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
    message: Schema,
    context: WebSocketMessageHandlerApplyContext<Schema>,
  ): Promise<WebSocketMessageHandlerMessageMatch> {
    const restrictionsMatch = await this.matchesRestrictions(message, context);

    if (!restrictionsMatch.success) {
      return { success: false, cause: 'unmatchedRestrictions', diff: restrictionsMatch.diff };
    }

    const canAcceptMoreMessages = this.numberOfMatchedMessages < this.limits.numberOfMessages.max;

    if (!canAcceptMoreMessages) {
      return { success: false, cause: 'exceededNumberOfMessages' };
    }

    return { success: true };
  }

  private async matchesRestrictions(
    message: Schema,
    context: WebSocketMessageHandlerApplyContext<Schema>,
  ): Promise<WebSocketMessageHandlerRestrictionMatch> {
    if (this.restrictedSender && context.sender !== this.restrictedSender) {
      return {
        success: false,
        diff: { sender: { expected: true, received: false } },
      };
    }

    for (const restriction of this.restrictions) {
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

      const matchesStaticRestriction = await this.matchesStaticMessageRestriction(message, restriction);

      if (!matchesStaticRestriction) {
        return {
          success: false,
          diff: { data: { expected: restriction, received: message } },
        };
      }
    }

    return { success: true };
  }

  private isComputedMessageRestriction(restriction: WebSocketMessageHandlerRestriction<RestrictedSchema>) {
    return typeof restriction === 'function';
  }

  private async matchesStaticMessageRestriction(
    message: Schema,
    restriction: WebSocketMessageHandlerStaticRestriction<RestrictedSchema>,
  ) {
    if (isWebSocketBinaryMessageData(restriction)) {
      if (!isWebSocketBinaryMessageData(message)) {
        return false;
      }

      return this.binaryMessageDataEquals(message, restriction);
    }

    return jsonContains(message as JSONValue, restriction as JSONValue);
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

  private assumeMessageMatchesRestrictions(message: Schema) {
    return message as RestrictedSchema;
  }

  markMessageAsMatched(_message: Schema) {
    this.numberOfMatchedMessages++;
  }

  markMessageAsUnmatched(message: Schema, options: { diff: WebSocketMessageHandlerRestrictionDiffs<Schema> }) {
    const shouldSaveUnmatchedMessages =
      this.interceptor.messageSaving.enabled &&
      (this.restrictions.length > 0 || this.restrictedSender !== undefined) &&
      this.timesPointer !== undefined;

    if (shouldSaveUnmatchedMessages) {
      this.unmatchedMessageGroups.push({ message, diff: options.diff });
    }
  }

  async applyDeclarations(message: Schema, context: WebSocketMessageHandlerApplyContext<Schema>) {
    const restrictedMessage = this.assumeMessageMatchesRestrictions(message);

    if (this.createResponseDelay) {
      const delay = await this.createResponseDelay(restrictedMessage);

      if (delay > 0) {
        await waitForDelay(delay);
      }
    }

    await this.applyEffect?.(restrictedMessage, context);

    const response = await this.createResponseDeclaration?.(restrictedMessage, context);

    if (response !== undefined) {
      context.sender.send(serializeRuntimeWebSocketMessageData(response));
    }
  }

  saveInterceptedMessage(message: Schema, context: WebSocketMessageHandlerApplyContext<Schema>) {
    const interceptedMessage: InterceptedWebSocketInterceptorMessage<RestrictedSchema, Schema> = {
      sender: context.sender,
      receiver: context.receiver,
      data: this.assumeMessageMatchesRestrictions(message),
    };

    const interceptedClientMessage: InterceptedWebSocketInterceptorMessage<Schema> = {
      sender: context.sender,
      receiver: context.receiver,
      data: message,
    };

    this.savedInterceptedMessages.push(interceptedMessage);
    context.sender.messages.push(interceptedClientMessage);
    context.receiver.messages.push(interceptedClientMessage);
    this.interceptor.incrementNumberOfSavedMessages(1);
  }

  private clearInterceptedMessages() {
    this.interceptor.incrementNumberOfSavedMessages(-this.savedInterceptedMessages.length);
    this.savedInterceptedMessages.length = 0;
  }

  get messages() {
    if (!this.interceptor.messageSaving.enabled) {
      throw new DisabledMessageSavingError();
    }
    return this.savedInterceptedMessages;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWebSocketMessageHandlerImplementation = WebSocketMessageHandlerImplementation<any, any>;

export default WebSocketMessageHandlerImplementation;
