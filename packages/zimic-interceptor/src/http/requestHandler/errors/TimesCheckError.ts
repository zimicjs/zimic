import isNonEmpty from '@zimic/utils/data/isNonEmpty';
import { Range } from '@zimic/utils/types';
import chalk from 'chalk';

import { stringifyValueToLog } from '@/utils/console';

import { UnmatchedHttpInterceptorRequestGroup } from '../types/restrictions';
import TimesDeclarationPointer from './TimesDeclarationPointer';

interface TimesCheckErrorOptions {
  requestLimits: Range<number>;
  numberOfMatchedRequests: number;
  declarationPointer: TimesDeclarationPointer | undefined;
  unmatchedRequestGroups: UnmatchedHttpInterceptorRequestGroup[];
  hasRestrictions: boolean;
  hasSavedRequests: boolean;
}

function createMessageHeader({
  requestLimits,
  hasRestrictions,
  numberOfMatchedRequests,
  unmatchedRequestGroups,
}: TimesCheckErrorOptions) {
  const requestPrefix = hasRestrictions ? 'matching ' : '';

  return [
    'Expected ',

    requestLimits.min === requestLimits.max ? 'exactly ' : 'at least ',
    requestLimits.min,

    requestLimits.min === requestLimits.max &&
      (requestLimits.min === 1 ? ` ${requestPrefix}request` : ` ${requestPrefix}requests`),

    requestLimits.min !== requestLimits.max &&
      Number.isFinite(requestLimits.max) &&
      ` and at most ${requestLimits.max}`,

    requestLimits.min !== requestLimits.max &&
      (requestLimits.max === 1 ? ` ${requestPrefix}request` : ` ${requestPrefix}requests`),

    ', but got ',
    numberOfMatchedRequests,
    '.',

    unmatchedRequestGroups.length > 0 &&
      `\n\nRequests evaluated by this handler:\n\n  ${chalk.green('- Expected')}\n  ${chalk.red('+ Received')}`,
  ]
    .filter((part) => part !== false)
    .join('');
}

function createMessageDiffs({ hasSavedRequests, unmatchedRequestGroups }: TimesCheckErrorOptions) {
  if (!hasSavedRequests) {
    return 'Tip: enable `saveRequests: true` in your interceptor for more details about the unmatched requests.';
  }

  return unmatchedRequestGroups
    .map(({ request, diff }, index) => {
      const requestNumber = index + 1;

      const messageParts = [`${requestNumber}: ${request.method} ${request.url}`];

      if (diff.computed) {
        messageParts.push('Computed restriction:');

        const stringifiedExpected = stringifyValueToLog(diff.computed.expected);
        const stringifiedReceived = stringifyValueToLog(diff.computed.received);

        messageParts.push(`  ${chalk.green(`- return ${stringifiedExpected}`)}`);
        messageParts.push(`  ${chalk.red(`+ return ${stringifiedReceived}`)}`);
      }

      if (diff.headers) {
        messageParts.push('Headers:');

        const stringifiedExpected = stringifyValueToLog(diff.headers.expected);
        const stringifiedReceived = stringifyValueToLog(diff.headers.received);

        messageParts.push(`  ${chalk.green(`- ${stringifiedExpected}`)}`);
        messageParts.push(`  ${chalk.red(`+ ${stringifiedReceived}`)}`);
      }

      if (diff.searchParams) {
        messageParts.push('Search params:');

        const stringifiedExpected = stringifyValueToLog(diff.searchParams.expected);
        const stringifiedReceived = stringifyValueToLog(diff.searchParams.received);

        messageParts.push(`  ${chalk.green(`- ${stringifiedExpected}`)}`);
        messageParts.push(`  ${chalk.red(`+ ${stringifiedReceived}`)}`);
      }

      if (diff.body) {
        messageParts.push('Body:');

        const stringifiedExpected = stringifyValueToLog(diff.body.expected, {
          includeClassName: { searchParams: true },
        });
        const stringifiedReceived = stringifyValueToLog(diff.body.received, {
          includeClassName: { searchParams: true },
        });

        messageParts.push(`  ${chalk.green(`- ${stringifiedExpected}`)}`);
        messageParts.push(`  ${chalk.red(`+ ${stringifiedReceived}`)}`);
      }

      return messageParts.join('\n     ');
    })
    .join('\n\n');
}

function createMessageFooter() {
  return 'Learn more: https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes';
}

function createMessage(options: TimesCheckErrorOptions) {
  const messageHeader = createMessageHeader(options);
  const messageDiffs = createMessageDiffs(options);
  const messageFooter = createMessageFooter();

  return [messageHeader, messageDiffs, messageFooter].filter(isNonEmpty).join('\n\n');
}

class TimesCheckError extends TypeError {
  constructor(options: TimesCheckErrorOptions) {
    const message = createMessage(options);
    super(message);

    this.name = 'TimesCheckError';
    this.cause = options.declarationPointer;
  }
}

export default TimesCheckError;
