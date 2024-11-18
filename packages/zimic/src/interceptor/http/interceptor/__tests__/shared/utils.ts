import { expect } from 'vitest';

import { HttpRequest } from '@/http/types/requests';
import HttpInterceptorWorker from '@/interceptor/http/interceptorWorker/HttpInterceptorWorker';
import { PossiblePromise } from '@/types/utils';
import { formatObjectToLog } from '@/utils/console';
import { ExtendedURL } from '@/utils/urls';

import { HttpInterceptorOptions, HttpInterceptorPlatform, HttpInterceptorType } from '../../types/options';

export interface SharedHttpInterceptorTestsOptions {
  platform: HttpInterceptorPlatform;
  startServer?: () => PossiblePromise<void>;
  stopServer?: () => PossiblePromise<void>;
  getBaseURL: (type: HttpInterceptorType) => Promise<ExtendedURL>;
}

export interface RuntimeSharedHttpInterceptorTestsOptions {
  platform: HttpInterceptorPlatform;
  type: HttpInterceptorType;
  getBaseURL: () => ExtendedURL;
  getInterceptorOptions: () => HttpInterceptorOptions;
}

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
    const headersLine = /Headers: (?<headers>[^\n]*)\n/.exec(message)!;
    expect(headersLine).not.toBe(null);

    const formattedHeaders = (await formatObjectToLog(Object.fromEntries(request.headers))) as string;
    const formattedHeadersIgnoringWrapperBrackets = formattedHeaders.slice(1, -1);

    for (const headerKeyValuePair of formattedHeadersIgnoringWrapperBrackets.split(', ')) {
      expect(headersLine.groups!.headers).toContain(headerKeyValuePair.trim());
    }
  }

  expect(message).toContain(
    platform === 'node'
      ? `Search params: ${await formatObjectToLog(Object.fromEntries(request.searchParams))}`
      : 'Search params: [object Object]',
  );

  const body: unknown = request.body;

  if (body === null) {
    expect(message).toContain(platform === 'node' ? `Body: ${await formatObjectToLog(body)}` : 'Body: ');
  } else {
    expect(message).toContain(
      platform === 'node' || typeof body !== 'object'
        ? `Body: ${await formatObjectToLog(body)}`
        : 'Body: [object Object]',
    );
  }
}
