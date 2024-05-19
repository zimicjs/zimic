import { expect } from 'vitest';

import { HttpRequest } from '@/http/types/requests';
import { formatObjectToLog } from '@/utils/console';

import { HttpInterceptorPlatform } from '../../types/options';

export function verifyUnhandledRequestMessage(
  message: string,
  options: {
    type: 'warn' | 'error';
    platform: HttpInterceptorPlatform;
    request: HttpRequest;
  },
) {
  const { type, platform, request } = options;

  expect(message).toMatch(/.*\[zimic\].* /);
  expect(message).toContain(type === 'warn' ? 'Warning:' : 'Error:');
  expect(message).toContain(type === 'warn' ? 'bypassed' : 'rejected');
  expect(message).toContain(`${request.method} ${request.url}`);

  expect(message).toContain(platform === 'node' ? 'Headers: ' : 'Headers: [object Object]');

  if (platform === 'node') {
    const headersLine = message.match(/Headers: (?<headers>[^\n]*)\n/)!;
    expect(headersLine).not.toBe(null);

    const formattedHeaders = formatObjectToLog(Object.fromEntries(request.headers)) as string;
    const formattedHeadersIgnoringWrapperBrackets = formattedHeaders.slice(1, -1);
    expect(headersLine.groups!.headers).toContain(formattedHeadersIgnoringWrapperBrackets);
  }

  expect(message).toContain(
    platform === 'node'
      ? `Search params: ${formatObjectToLog(Object.fromEntries(new URL(request.url).searchParams))}\n`
      : 'Search params: [object Object]',
  );
  expect(message).toContain(
    platform === 'node' || typeof request.body !== 'object' || request.body === null
      ? `Body: ${formatObjectToLog(request.body)}\n`
      : 'Body: [object Object]',
  );
}
