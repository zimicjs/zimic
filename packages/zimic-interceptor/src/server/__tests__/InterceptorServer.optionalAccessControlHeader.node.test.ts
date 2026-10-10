import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import type InterceptorServer from '../InterceptorServer';

vi.mock('../constants', async (importOriginal) => {
  const module = await importOriginal<typeof import('../constants')>();

  return {
    ...module,
    DEFAULT_ACCESS_CONTROL_HEADERS: {
      ...module.DEFAULT_ACCESS_CONTROL_HEADERS,
      'access-control-max-age': undefined,
    },
  };
});

describe('Interceptor server > Optional access control headers', () => {
  let server: InterceptorServer | undefined;

  afterEach(async () => {
    await server?.stop();
  });

  it('should omit an unset optional header from preflight responses', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    const response = await fetch(`http://${server.hostname}:${server.port!}/`, { method: 'OPTIONS' });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.has('access-control-max-age')).toBe(false);
  });
});
