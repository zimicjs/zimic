import { HttpHeaders, HttpSearchParams, HttpRequest, HttpRequestBodySchema } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';
import { expect, expectTypeOf } from 'vitest';

import HttpInterceptorWorker from '@/http/interceptorWorker/HttpInterceptorWorker';
import { formatValueToLog } from '@/utils/console';

import { HttpInterceptorOptions, HttpInterceptorPlatform, HttpInterceptorType } from '../../types/options';
import { UnhandledHttpInterceptorRequest, UnhandledHttpInterceptorRequestMethodSchema } from '../../types/requests';

export interface SharedHttpInterceptorTestsOptions {
  platform: HttpInterceptorPlatform;
  startServer?: () => PossiblePromise<void>;
  stopServer?: () => PossiblePromise<void>;
  getBaseURL: (type: HttpInterceptorType) => Promise<URL>;
}

export interface RuntimeSharedHttpInterceptorTestsOptions {
  platform: HttpInterceptorPlatform;
  type: HttpInterceptorType;
  getBaseURL: () => URL;
  getInterceptorOptions: () => HttpInterceptorOptions;
}

export async function verifyUnhandledRequestMessage(
  message: string,
  options: {
    request: HttpRequest;
    platform: HttpInterceptorPlatform;
    type: 'bypass' | 'reject';
  },
) {
  const { type, platform, request: rawRequest } = options;

  const request = await HttpInterceptorWorker.parseRawRequest(rawRequest);
  const body: unknown = request.body;

  const firstLineRegex = new RegExp(
    `^[^\\s]*\\[@zimic/interceptor\\][^\\s]* ${type === 'bypass' ? 'Warning:' : 'Error:'} ` +
      `Request was not handled and was [^\\s]*${type === 'bypass' ? 'bypassed' : 'rejected'}[^\\s]*\n`,
  );
  expect(message).toMatch(firstLineRegex);

  expect(message).toContain(`${request.method} ${request.url}`);

  if (platform === 'node') {
    const headersLine = /Headers: (?<headers>[^\n]*)\n/.exec(message)!;
    expect(headersLine).not.toBe(null);

    const formattedHeaders = (await formatValueToLog(request.headers.toObject())) as string;
    const formattedHeadersIgnoringWrapperBrackets = formattedHeaders.slice(1, -1);

    for (const headerKeyValuePair of formattedHeadersIgnoringWrapperBrackets.split(', ')) {
      expect(headersLine.groups!.headers).toContain(headerKeyValuePair.trim());
    }

    expect(message).toContain(`Search params: ${await formatValueToLog(request.searchParams.toObject())}`);
    expect(message).toContain(`Body: ${await formatValueToLog(body)}`);
  } else {
    expect(message).toContain('Headers: [object Object]');
    expect(message).toContain('Search params: [object Object]');

    if (body === null) {
      expect(message).toContain('Body: ');
    } else {
      expect(message).toContain('Body: [object Object]');
    }
  }
}

export function verifyUnhandledRequest(request: UnhandledHttpInterceptorRequest, method: string) {
  expect(request).toBeInstanceOf(Request);
  expect(request).not.toHaveProperty('response');

  expectTypeOf(request.headers).toEqualTypeOf<HttpHeaders<Record<string, string>>>();
  expect(request.headers).toBeInstanceOf(HttpHeaders);

  expectTypeOf(request.searchParams).toEqualTypeOf<HttpSearchParams<Record<string, string | string[]>>>();
  expect(request.searchParams).toBeInstanceOf(HttpSearchParams);

  expectTypeOf(request.pathParams).toEqualTypeOf<{}>();
  expect(request.pathParams).toEqual({});

  type BodySchema = HttpRequestBodySchema<UnhandledHttpInterceptorRequestMethodSchema>;

  expectTypeOf(request.body).toEqualTypeOf<BodySchema>();
  expect(request).toHaveProperty('body');

  expectTypeOf(request.raw).toEqualTypeOf<HttpRequest<BodySchema>>();
  expect(request.raw).toBeInstanceOf(Request);
  expect(request.raw.url).toBe(request.url);
  expect(request.raw.method).toBe(method);
  expect(Object.fromEntries(request.headers)).toEqual(expect.objectContaining(Object.fromEntries(request.raw.headers)));
}
