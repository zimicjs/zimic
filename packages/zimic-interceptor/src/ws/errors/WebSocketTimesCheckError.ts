import { isNonEmpty } from '@zimic/utils/data';
import { Range } from '@zimic/utils/types';

import { WebSocketInterceptorMessageSaving } from '../interceptor/types/options';
import { UnmatchedWebSocketInterceptorMessageGroup } from '../messageHandler/types/restrictions';
import HttpTimesDeclarationPointer from './WebSocketTimesDeclarationPointer';

interface WebSocketTimesCheckErrorOptions {
  messageLimits: Range<number>;
  numberOfMatchedMessages: number;
  declarationPointer: HttpTimesDeclarationPointer | undefined;
  hasRestrictions: boolean;
  messageSaving: WebSocketInterceptorMessageSaving;
  unmatchedMessageGroups: UnmatchedWebSocketInterceptorMessageGroup[];
}

function createMessageHeader({
  messageLimits,
  hasRestrictions,
  numberOfMatchedMessages,
}: WebSocketTimesCheckErrorOptions) {
  const messagePrefix = hasRestrictions ? 'matching ' : '';

  return [
    'Expected ',

    messageLimits.min === messageLimits.max ? 'exactly ' : 'at least ',
    messageLimits.min,

    messageLimits.min === messageLimits.max &&
      (messageLimits.min === 1 ? ` ${messagePrefix}message` : ` ${messagePrefix}messages`),

    messageLimits.min !== messageLimits.max &&
      Number.isFinite(messageLimits.max) &&
      ` and at most ${messageLimits.max}`,

    messageLimits.min !== messageLimits.max &&
      (messageLimits.max === 1 ? ` ${messagePrefix}message` : ` ${messagePrefix}messages`),

    ', but got ',
    numberOfMatchedMessages,
    '.',
  ]
    .filter((part) => part !== false)
    .join('');
}

function createMessageUnmatchedMessageGroups(options: WebSocketTimesCheckErrorOptions) {
  const shouldShowUnmatchedMessages =
    options.messageSaving.enabled && options.hasRestrictions && options.unmatchedMessageGroups.length > 0;

  if (!shouldShowUnmatchedMessages) {
    return '';
  }

  const formattedGroups = options.unmatchedMessageGroups
    .map((group) => `- ${JSON.stringify({ message: group.message, diff: group.diff })}`)
    .join('\n');

  return `Unmatched messages:\n\n${formattedGroups}`;
}

function createMessageFooter() {
  return 'Learn more: https://zimic.dev/docs/interceptor/api/http-message-handler#handlertimes';
}

function createMessage(options: WebSocketTimesCheckErrorOptions) {
  const messageHeader = createMessageHeader(options);
  const messageUnmatchedMessageGroups = createMessageUnmatchedMessageGroups(options);
  const messageFooter = createMessageFooter();

  return [messageHeader, messageUnmatchedMessageGroups, messageFooter].filter(isNonEmpty).join('\n\n');
}

/** Error thrown when the number of messages matched by a handler does not satisfy its `handler.times()` declaration. */
class WebSocketTimesCheckError extends TypeError {
  constructor(options: WebSocketTimesCheckErrorOptions) {
    const message = createMessage(options);
    super(message);

    this.name = 'WebSocketTimesCheckError';
    this.cause = options.declarationPointer;
  }
}

export default WebSocketTimesCheckError;
