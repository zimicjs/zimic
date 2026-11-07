import { isNonEmpty } from '@zimic/utils/data';
import { Range } from '@zimic/utils/types';
import color from 'picocolors';

import { stringifyValueToLog } from '@/utils/logging';

import { UnmatchedWebSocketInterceptorConnectionGroup } from '../connectionHandler/types/restrictions';
import { WebSocketInterceptorConnectionSaving, WebSocketInterceptorMessageSaving } from '../interceptor/types/public';
import { UnmatchedWebSocketInterceptorMessageGroup } from '../messageHandler/types/restrictions';
import WebSocketTimesDeclarationPointer from './WebSocketTimesDeclarationPointer';

type WebSocketTimesCheckErrorOptions = {
  limits: Range<number>;
  numberOfMatches: number;
  declarationPointer: WebSocketTimesDeclarationPointer | undefined;
  hasRestrictions: boolean;
} & (
  | {
      subject: 'message';
      unmatchedGroups: UnmatchedWebSocketInterceptorMessageGroup[];
      messageSaving: WebSocketInterceptorMessageSaving;
    }
  | {
      subject: 'connection';
      unmatchedGroups: UnmatchedWebSocketInterceptorConnectionGroup[];
      connectionSaving: WebSocketInterceptorConnectionSaving;
    }
);

function createTimesCheckErrorHeader({
  subject,
  limits,
  hasRestrictions,
  numberOfMatches,
  unmatchedGroups,
}: WebSocketTimesCheckErrorOptions) {
  const subjectPrefix = hasRestrictions ? 'matching ' : '';

  return [
    'Expected ',

    limits.min === limits.max ? 'exactly ' : 'at least ',
    limits.min,

    limits.min === limits.max && (limits.min === 1 ? ` ${subjectPrefix}${subject}` : ` ${subjectPrefix}${subject}s`),

    limits.min !== limits.max && Number.isFinite(limits.max) && ` and at most ${limits.max}`,

    limits.min !== limits.max && (limits.max === 1 ? ` ${subjectPrefix}${subject}` : ` ${subjectPrefix}${subject}s`),

    ', but got ',
    numberOfMatches,
    '.',

    unmatchedGroups.length > 0 &&
      `\n\n${subject === 'message' ? 'Messages' : 'Connections'} evaluated by this handler:\n\n` +
        `  ${color.green('- Expected')}\n  ${color.red('+ Received')}`,
  ]
    .filter((part) => part !== false)
    .join('');
}

function createUnmatchedMessageDiffs(unmatchedMessageGroups: UnmatchedWebSocketInterceptorMessageGroup[]) {
  return unmatchedMessageGroups.map(({ message, diff }, index) => {
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
  });
}

function createUnmatchedConnectionDiffs(unmatchedConnectionGroups: UnmatchedWebSocketInterceptorConnectionGroup[]) {
  return unmatchedConnectionGroups.map(({ request, diff }, index) => {
    const connectionNumber = index + 1;

    const connectionParts = [`${connectionNumber}: ${request.url}`];

    if (diff.computed) {
      connectionParts.push('Computed restriction:');

      connectionParts.push(`  ${color.green(`- return ${diff.computed.expected}`)}`);
      connectionParts.push(`  ${color.red(`+ return ${diff.computed.received}`)}`);
    }

    if (diff.searchParams) {
      connectionParts.push('Search params:');

      const stringifiedExpected = stringifyValueToLog(diff.searchParams.expected.toObject());
      const stringifiedReceived = stringifyValueToLog(diff.searchParams.received.toObject());

      connectionParts.push(`  ${color.green(`- ${stringifiedExpected}`)}`);
      connectionParts.push(`  ${color.red(`+ ${stringifiedReceived}`)}`);
    }

    if (diff.protocols) {
      connectionParts.push('Protocols:');

      const stringifiedExpected = stringifyValueToLog(diff.protocols.expected);
      const stringifiedReceived = stringifyValueToLog(diff.protocols.received);

      connectionParts.push(`  ${color.green(`- ${stringifiedExpected}`)}`);
      connectionParts.push(`  ${color.red(`+ ${stringifiedReceived}`)}`);
    }

    return connectionParts.join('\n     ');
  });
}

function createTimesCheckUnmatchedDiffs(options: WebSocketTimesCheckErrorOptions) {
  const saving = options.subject === 'message' ? options.messageSaving : options.connectionSaving;

  if (!saving.enabled) {
    return (
      `Tip: use \`${options.subject}Saving.enabled: true\` in your interceptor for more details about the unmatched ` +
      `${options.subject}s.`
    );
  }

  const diffs =
    options.subject === 'message'
      ? createUnmatchedMessageDiffs(options.unmatchedGroups)
      : createUnmatchedConnectionDiffs(options.unmatchedGroups);

  return diffs.join('\n\n');
}

function createTimesCheckErrorMessage(options: WebSocketTimesCheckErrorOptions) {
  const errorHeader = createTimesCheckErrorHeader(options);
  const unmatchedDiffs = createTimesCheckUnmatchedDiffs(options);

  return [errorHeader, unmatchedDiffs].filter(isNonEmpty).join('\n\n');
}

/**
 * WebSocket interceptors are experimental. The API is subject to change without a major version bump. Use with caution.
 *
 * Error thrown when the number of messages or connections matched by a handler does not satisfy its `handler.times()`
 * declaration.
 */
class WebSocketTimesCheckError extends TypeError {
  constructor(options: WebSocketTimesCheckErrorOptions) {
    const message = createTimesCheckErrorMessage(options);
    super(message);

    this.name = 'WebSocketTimesCheckError';
    this.cause = options.declarationPointer;
  }
}

export default WebSocketTimesCheckError;
