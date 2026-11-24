import { HttpSchema } from '@zimic/http';
import { describe, expect, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import createFetch from '../factory';

describe('FetchClient > Abort', () => {
  const baseURL = 'http://localhost:3000';

  it('should reject with the signal reason if the signal is aborted while the request is pending', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 204: {} };
        };
      };
    }>;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const controller = new AbortController();
      const abortReason = new Error('Request aborted');

      await interceptor
        .get('/users')
        .respond(() => {
          controller.abort(abortReason);
          return { status: 204 };
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      await expect(fetch('/users', { method: 'GET', signal: controller.signal })).rejects.toBe(abortReason);
    });
  });
});
