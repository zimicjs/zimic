import { isNonEmpty } from '@/utils/data';

class TimesCheckError extends TypeError {
  constructor(options: {
    numberOfRequests: number;
    limits: { min: number; max: number };
    timesStack: string | undefined;
  }) {
    const formattedLimits =
      options.limits.min === options.limits.max
        ? `exactly ${options.limits.min} requests`
        : `at least ${options.limits.min}${
            Number.isFinite(options.limits.max) ? ` and at most ${options.limits.max}` : ''
          } requests`;

    const timesStackWithoutInternalCalls = options.timesStack?.replace(/([^\n]+\n\s*){4}at /, '');

    const formattedTimesStack = timesStackWithoutInternalCalls
      ? `The failed \`handler.times()\` was declared at: \n    ${timesStackWithoutInternalCalls}`
      : '';

    const message = [
      `Expected ${formattedLimits}, but got ${options.numberOfRequests}.\n\n`,
      formattedTimesStack,
      '\n\nLearn more: https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes',
    ]
      .filter(isNonEmpty)
      .join('');

    super(message);
    this.name = 'TimesCheckError [zimic]';
  }
}

export default TimesCheckError;
