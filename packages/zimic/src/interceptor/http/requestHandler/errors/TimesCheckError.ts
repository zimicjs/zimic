import { isNonEmpty } from '@/utils/data';

class TimesCheckError extends TypeError {
  constructor(options: {
    numberOfRequests: number;
    limits: { min: number; max: number };
    declarationError: Error | undefined;
  }) {
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
      '.',

      '\n\nLearn more: https://github.com/zimicjs/zimic/wiki/api‐zimic‐interceptor‐http#http-handlertimes',
    ]
      .filter((part) => isNonEmpty(part) && part !== false)
      .join('');

    super(message);
    this.name = 'TimesCheckError';
    this.cause = options.declarationError;
  }
}

export default TimesCheckError;
