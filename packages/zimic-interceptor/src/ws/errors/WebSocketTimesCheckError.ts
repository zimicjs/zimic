import { isNonEmpty } from '@zimic/utils/data';
import { Range } from '@zimic/utils/types';

import { WebSocketInterceptorMessageSaving } from '../interceptor/types/options';
import HttpTimesDeclarationPointer from './WebSocketTimesDeclarationPointer';

interface WebSocketTimesCheckErrorOptions {
  messageLimits: Range<number>;
  numberOfMatchedMessages: number;
  declarationPointer: HttpTimesDeclarationPointer | undefined;
  hasRestrictions: boolean;
  messageSaving: WebSocketInterceptorMessageSaving;
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

function createMessageFooter() {
  return 'Learn more: https://zimic.dev/docs/interceptor/api/http-message-handler#handlertimes';
}

function createMessage(options: WebSocketTimesCheckErrorOptions) {
  const messageHeader = createMessageHeader(options);
  const messageFooter = createMessageFooter();

  return [messageHeader, messageFooter].filter(isNonEmpty).join('\n\n');
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
