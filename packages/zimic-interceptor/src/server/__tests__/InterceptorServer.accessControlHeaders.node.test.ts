import { expect, it, vi } from 'vitest';

import { DEFAULT_ACCESS_CONTROL_HEADERS } from '../constants';
import InterceptorServer from '../InterceptorServer';

vi.mock('../constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../constants')>();

  return {
    ...actual,
    DEFAULT_ACCESS_CONTROL_HEADERS: {
      ...actual.DEFAULT_ACCESS_CONTROL_HEADERS,
      'access-control-max-age': undefined,
    },
  };
});

const mutableAccessControlHeaders = DEFAULT_ACCESS_CONTROL_HEADERS as Record<string, string | undefined>;

it.each([undefined, ''])('should omit max-age when its default value is %s', async (maxAge) => {
  mutableAccessControlHeaders['access-control-max-age'] = maxAge;

  const server = new InterceptorServer({});

  try {
    await server.start();

    const response = await fetch(`http://${server.hostname}:${server.port}`, { method: 'OPTIONS' });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-max-age')).toBeNull();
  } finally {
    await server.stop();
  }
});
