import { isNonEmpty } from '@/utils/data';

class TimesCheckError extends TypeError {
  constructor(options: {
    numberOfRequests: number;
    limits: { min: number; max: number };
    timesStack: string | undefined;
  }) {
    const timesStackWithoutInternalCalls = options.timesStack?.replace(/([^\n]+\n\s*){4}at /, '');

    const message = [
      'Expected ',
      options.limits.min === options.limits.max ? 'exactly ' : 'at least ',
      options.limits.min,
      options.limits.min === options.limits.max && (options.limits.min === 1 ? ' request' : ' requests'),

      options.limits.min !== options.limits.max &&
        Number.isFinite(options.limits.max) &&
        ` and at most ${options.limits.max}`,
      options.limits.min !== options.limits.max && (options.limits.max === 1 ? ' request' : ' requests'),

      ', but got ',
      options.numberOfRequests,

      '.\n\n',

      timesStackWithoutInternalCalls &&
        `The failed \`handler.times()\` was declared at: \n    ${timesStackWithoutInternalCalls}`,

      '\n\nLearn more: https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes',
    ]
      .filter((part) => isNonEmpty(part) && part !== false)
      .join('');

    super(message);
    this.name = 'TimesCheckError [zimic]';
  }
}

export default TimesCheckError;
