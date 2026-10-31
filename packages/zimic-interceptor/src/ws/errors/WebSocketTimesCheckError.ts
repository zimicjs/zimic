import { isNonEmpty } from '@zimic/utils/data';
import { Range } from '@zimic/utils/types';
import color from 'picocolors';

import { stringifyValueToLog } from '@/utils/logging';

import { WebSocketInterceptorMessageSaving } from '../interceptor/types/public';
import { UnmatchedWebSocketInterceptorMessageGroup } from '../messageHandler/types/restrictions';
import WebSocketTimesDeclarationPointer from './WebSocketTimesDeclarationPointer';

interface WebSocketTimesCheckErrorOptions {
  messageLimits: Range<number>;
  numberOfMatchedMessages: number;
  declarationPointer: WebSocketTimesDeclarationPointer | undefined;
  unmatchedMessageGroups: UnmatchedWebSocketInterceptorMessageGroup[];
  hasRestrictions: boolean;
  messageSaving: WebSocketInterceptorMessageSaving;
}

function createMessageHeader({
  messageLimits,
  hasRestrictions,
  numberOfMatchedMessages,
  unmatchedMessageGroups,
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

    unmatchedMessageGroups.length > 0 &&
      `\n\nMessages evaluated by this handler:\n\n  ${color.green('- Expected')}\n  ${color.red('+ Received')}`,
  ]
    .filter((part) => part !== false)
    .join('');
}

function createMessageDiffs({ messageSaving, unmatchedMessageGroups }: WebSocketTimesCheckErrorOptions) {
  if (!messageSaving.enabled) {
    return 'Tip: use `messageSaving.enabled: true` in your interceptor for more details about the unmatched messages.';
  }

  return unmatchedMessageGroups
    .map(({ message, diff }, index) => {
      const messageNumber = index + 1;

      const messageParts = [`${messageNumber}: ${stringifyValueToLog(message)}`];

      if (diff.sender) {
        messageParts.push('Sender:');

        messageParts.push(`  ${color.green('- client from handler.from()')}`);
        messageParts.push(`  ${color.red('+ another client')}`);
      }

      if (diff.computed) {
        messageParts.push('Computed restriction:');

        messageParts.push(`  ${color.green(`- return ${diff.computed.expected}`)}`);
        messageParts.push(`  ${color.red(`+ return ${diff.computed.received}`)}`);
      }

      if (diff.data) {
        messageParts.push('Data:');

        const stringifiedExpected = stringifyValueToLog(diff.data.expected);
        const stringifiedReceived = stringifyValueToLog(diff.data.received);

        messageParts.push(`  ${color.green(`- ${stringifiedExpected}`)}`);
        messageParts.push(`  ${color.red(`+ ${stringifiedReceived}`)}`);
      }

      return messageParts.join('\n     ');
    })
    .join('\n\n');
}

function createMessageFooter() {
  return 'Learn more: https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlertimes';
}

function createMessage(options: WebSocketTimesCheckErrorOptions) {
  const messageHeader = createMessageHeader(options);
  const messageDiffs = createMessageDiffs(options);
  const messageFooter = createMessageFooter();

  return [messageHeader, messageDiffs, messageFooter].filter(isNonEmpty).join('\n\n');
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Error thrown when the number of messages matched by a handler does not satisfy its `handler.times()` declaration.
 *
 * @see {@link https://zimic.dev/docs/interceptor/api/websocket-message-handler#handlerchecktimes `handler.checkTimes()` API reference}
 */
class WebSocketTimesCheckError extends TypeError {
  constructor(options: WebSocketTimesCheckErrorOptions) {
    const message = createMessage(options);
    super(message);

    this.name = 'WebSocketTimesCheckError';
    this.cause = options.declarationPointer;
  }
}

export default WebSocketTimesCheckError;
