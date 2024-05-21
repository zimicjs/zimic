import { expect } from 'vitest';

import { HttpRequest } from '@/http/types/requests';
import HttpInterceptorWorker from '@/interceptor/http/interceptorWorker/HttpInterceptorWorker';
import { formatObjectToLog } from '@/utils/console';

import { HttpInterceptorPlatform } from '../../types/options';

export async function verifyUnhandledRequestMessage(
  message: string,
  options: {
    type: 'warn' | 'error';
    platform: HttpInterceptorPlatform;
    request: HttpRequest;
  },
) {
  const { type, platform, request: rawRequest } = options;

  const request = await HttpInterceptorWorker.parseRawRequest(rawRequest);

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

    for (const headerKeyValuePair of formattedHeadersIgnoringWrapperBrackets.split(', ')) {
      expect(headersLine.groups!.headers).toContain(headerKeyValuePair.trim());
    }
  }

  expect(message).toContain(
    platform === 'node'
      ? `Search params: ${formatObjectToLog(Object.fromEntries(request.searchParams))}\n`
      : 'Search params: [object Object]',
  );

  const body: unknown = request.body;

  expect(message).toContain(
    platform === 'node' || typeof body !== 'object' || body === null
      ? `Body: ${formatObjectToLog(body)}\n`
      : 'Body: [object Object]',
  );
}
