function stringifyBinaryValueToLog(value: unknown): string | undefined {
  if (value instanceof File) {
    return `File { name: '${value.name}', type: '${value.type}', size: ${value.size} }`;
  }

  if (value instanceof Blob) {
    return `Blob { type: '${value.type}', size: ${value.size} }`;
  }

  if (value instanceof ArrayBuffer) {
    const bytes = Array.from(new Uint8Array(value)).join(', ');
    return `ArrayBuffer { byteLength: ${value.byteLength}, bytes: [${bytes}] }`;
  }
}

export function stringifyJSONToLog(
  value: unknown,
  options: {
    replacer?: (key: string, value: unknown) => unknown;
    indentation?: number;
  } = {},
) {
  const { replacer = (_key, value) => stringifyBinaryValueToLog(value) ?? value, indentation = 2 } = options;

  return JSON.stringify(value, replacer, indentation)
    .replace(/\n\s*/g, ' ')
    .replace(/"(File { name: '.*?', type: '.*?', size: \d*? })"/g, '$1')
    .replace(/"(Blob { type: '.*?', size: \d*? })"/g, '$1')
    .replace(/"(ArrayBuffer { byteLength: \d+, bytes: \[.*?\] })"/g, '$1');
}

export function stringifyValueToLog(value: unknown, options: { fallback?: (value: unknown) => string } = {}): string {
  const {
    fallback = (value) =>
      stringifyJSONToLog(value, {
        replacer: (_key, value) => stringifyValueToLog(value, { fallback: (value) => value as string }),
      }),
  } = options;

  if (value === null || value === undefined || typeof value !== 'object') {
    return String(value);
  }

  return stringifyBinaryValueToLog(value) ?? fallback(value);
}
