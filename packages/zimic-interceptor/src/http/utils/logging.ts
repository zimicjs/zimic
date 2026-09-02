import { HttpFormData, HttpHeaders, HttpSearchParams } from '@zimic/http';

function stringifyJSONToLog(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, value) => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return stringifyValueToLog(value, {
        fallback: (value) => value as string,
      });
    },
    2,
  )
    .replace(/\n\s*/g, ' ')
    .replace(/"(File { name: '.*?', type: '.*?', size: \d*? })"/g, '$1')
    .replace(/"(Blob { type: '.*?', size: \d*? })"/g, '$1');
}

export function stringifyValueToLog(
  value: unknown,
  options: {
    fallback?: (value: unknown) => string;
    includeClassName?: { searchParams?: boolean };
  } = {},
): string {
  const { fallback = stringifyJSONToLog, includeClassName } = options;

  if (value === null || value === undefined || typeof value !== 'object') {
    return String(value);
  }

  if (value instanceof HttpHeaders) {
    return stringifyValueToLog(value.toObject());
  }

  if (value instanceof HttpSearchParams) {
    const prefix = (includeClassName?.searchParams ?? false) ? 'URLSearchParams ' : '';
    return `${prefix}${stringifyValueToLog(value.toObject())}`;
  }

  if (value instanceof HttpFormData) {
    return `FormData ${stringifyValueToLog(value.toObject())}`;
  }

  if (value instanceof File) {
    return `File { name: '${value.name}', type: '${value.type}', size: ${value.size} }`;
  }

  if (value instanceof Blob) {
    return `Blob { type: '${value.type}', size: ${value.size} }`;
  }

  return fallback(value);
}
