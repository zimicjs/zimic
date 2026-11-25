import { HttpFormData, HttpHeaders, HttpSearchParams } from '@zimic/http';

import { stringifyValueToLog } from '@/utils/logging';

export function stringifyHttpValueToLog(
  value: unknown,
  options: {
    fallback?: (value: unknown) => string;
    includeClassName?: { searchParams?: boolean };
  } = {},
): string {
  const { fallback, includeClassName } = options;

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
