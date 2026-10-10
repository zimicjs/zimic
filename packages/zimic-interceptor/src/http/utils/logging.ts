import { HttpFormData, HttpHeaders, HttpSearchParams } from '@zimic/http';

import { stringifyJSONToLog, stringifyValueToLog } from '@/utils/stringifyValueToLog';

export function stringifyHttpValueToLog(
  value: unknown,
  options: {
    fallback?: (value: unknown) => string;
    includeClassName?: { searchParams?: boolean };
  } = {},
): string {
  const {
    fallback = (value) =>
      stringifyJSONToLog(value, {
        replacer: (_key, value) =>
          stringifyHttpValueToLog(value, {
            fallback: (value) => value as string,
          }),
      }),
    includeClassName,
  } = options;

  if (value === null || value === undefined || typeof value !== 'object') {
    return String(value);
  }

  if (value instanceof HttpHeaders) {
    return stringifyHttpValueToLog(value.toObject());
  }

  if (value instanceof HttpSearchParams) {
    const prefix = (includeClassName?.searchParams ?? false) ? 'URLSearchParams ' : '';
    return `${prefix}${stringifyHttpValueToLog(value.toObject())}`;
  }

  if (value instanceof HttpFormData) {
    return `FormData ${stringifyHttpValueToLog(value.toObject())}`;
  }

  return stringifyValueToLog(value, { fallback });
}
