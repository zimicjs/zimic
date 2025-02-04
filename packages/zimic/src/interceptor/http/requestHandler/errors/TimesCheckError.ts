import chalk from 'chalk';

import { stringifyObjectToLog } from '@/utils/console';
import { isNonEmpty } from '@/utils/data';

import { UnmatchedHttpInterceptorRequestGroup } from '../types/restrictions';
import TimesDeclarationPointer from './TimesDeclarationPointer';

class TimesCheckError extends TypeError {
  constructor(options: {
    limits: { min: number; max: number };
    numberOfRequests: number;
    declarationPointer: TimesDeclarationPointer | undefined;
    unmatchedGroups: UnmatchedHttpInterceptorRequestGroup[];
    hasRestrictions: boolean;
    savedRequests: boolean;
  }) {
    const messageHeaderRequestSuffix = options.hasRestrictions ? ' matching the restrictions' : '';

    const messageHeader = [
      'Expected ',
      options.limits.min === options.limits.max ? 'exactly ' : 'at least ',
      options.limits.min,
      options.limits.min === options.limits.max &&
        (options.limits.min === 1 ? ` request${messageHeaderRequestSuffix}` : ` requests${messageHeaderRequestSuffix}`),

      options.limits.min !== options.limits.max &&
        Number.isFinite(options.limits.max) &&
        ` and at most ${options.limits.max}`,
      options.limits.min !== options.limits.max &&
        (options.limits.max === 1 ? ` request${messageHeaderRequestSuffix}` : ` requests${messageHeaderRequestSuffix}`),

      ', but got ',
      options.numberOfRequests,
      '.',

      options.unmatchedGroups.length > 0 &&
        `\n\nRequests considered by this handler (${chalk.green('+ expected')} | ${chalk.red('- received')}):`,
    ]
      .filter((part) => part !== false)
      .join('');

    const messageDiffs = options.savedRequests
      ? options.unmatchedGroups
          .map(({ request, diff }, index) => {
            const parts = [`${index + 1}: ${request.method} ${request.url}`];

            if (diff.computed === undefined) {
              if (diff.headers) {
                parts.push('\n     Headers:');
                parts.push(`\n       ${chalk.green(`+ ${stringifyObjectToLog(diff.headers.expected)}`)}`);
                parts.push(`\n       ${chalk.red(`- ${stringifyObjectToLog(diff.headers.received)}`)}`);
              }
              if (diff.searchParams) {
                parts.push('\n     Search params:');
                parts.push(`\n       ${chalk.green(`+ ${stringifyObjectToLog(diff.searchParams.expected)}`)}`);
                parts.push(`\n       ${chalk.red(`- ${stringifyObjectToLog(diff.searchParams.received)}`)}`);
              }
              if (diff.body) {
                parts.push('\n     Body:');
                parts.push(`\n       ${chalk.green(`+ ${stringifyObjectToLog(diff.body.expected)}`)}`);
                parts.push(`\n       ${chalk.red(`- ${stringifyObjectToLog(diff.body.received)}`)}`);
              }
            } else {
              parts.push(
                `\n  Computed restriction: expected to return ${diff.computed.expected} | returned ${diff.computed.received}`,
              );
            }

            return parts.join('');
          })
          .join('\n\n')
      : 'Tip: use `saveRequests: true` in your interceptor to see a detailed diff.';

    const messageFooter =
      'Learn more: https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes';

    const message = [messageHeader, '\n\n', messageDiffs, '\n\n', messageFooter].filter(isNonEmpty).join('');

    super(message);
    this.name = 'TimesCheckError';
    this.cause = options.declarationPointer;
  }
}

export default TimesCheckError;
