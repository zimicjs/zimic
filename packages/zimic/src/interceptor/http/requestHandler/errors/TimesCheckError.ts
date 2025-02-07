import chalk from 'chalk';

import { Range } from '@/types/utils';
import { stringifyObjectToLog } from '@/utils/console';
import { isNonEmpty } from '@/utils/data';

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
    return 'Tip: use `saveRequests: true` in your interceptor for a detailed diff.';
  }

  return unmatchedRequestGroups
    .map(({ request, diff }, index) => {
      const requestNumber = index + 1;

      const messageParts = [`${requestNumber}: ${request.method} ${request.url}`];

      if (diff.computed) {
        messageParts.push('Computed restriction:');

        const stringifiedExpected = stringifyObjectToLog(diff.computed.expected);
        const stringifiedReceived = stringifyObjectToLog(diff.computed.received);

        messageParts.push(`  ${chalk.green(`- return ${stringifiedExpected}`)}`);
        messageParts.push(`  ${chalk.red(`+ return ${stringifiedReceived}`)}`);
      }

      if (diff.headers) {
        messageParts.push('Headers:');

        const stringifiedExpected = stringifyObjectToLog(diff.headers.expected);
        const stringifiedReceived = stringifyObjectToLog(diff.headers.received);

        messageParts.push(`  ${chalk.green(`- ${stringifiedExpected}`)}`);
        messageParts.push(`  ${chalk.red(`+ ${stringifiedReceived}`)}`);
      }

      if (diff.searchParams) {
        messageParts.push('Search params:');

        const stringifiedExpected = stringifyObjectToLog(diff.searchParams.expected);
        const stringifiedReceived = stringifyObjectToLog(diff.searchParams.received);

        messageParts.push(`  ${chalk.green(`- ${stringifiedExpected}`)}`);
        messageParts.push(`  ${chalk.red(`+ ${stringifiedReceived}`)}`);
      }

      if (diff.body) {
        messageParts.push('Body:');

        const stringifiedExpected = stringifyObjectToLog(diff.body.expected, { includeSearchParamsClassName: true });
        const stringifiedReceived = stringifyObjectToLog(diff.body.received, { includeSearchParamsClassName: true });

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
