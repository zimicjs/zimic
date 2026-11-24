import { HttpSchema } from '@zimic/http';
import { waitForDelay } from '@zimic/utils/time';
import v8 from 'node:v8';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import createFetch from '../factory';

describe('FetchClient > Abort (Node.js)', () => {
  const baseURL = 'http://localhost:3000';

  it('should reject with the signal reason if the signal is aborted after a garbage collection while the request is pending', async () => {
    type Schema = HttpSchema<{
      '/users': {
        GET: {
          response: { 204: {} };
        };
      };
    }>;

    v8.setFlagsFromString('--expose-gc');
    const collectGarbage = vm.runInNewContext('gc') as () => void;

    await usingHttpInterceptor<Schema>({ baseURL }, async (interceptor) => {
      const controller = new AbortController();
      const abortReason = new Error('Request aborted');

      await interceptor
        .get('/users')
        .respond(async () => {
          // Weak references are only cleared after the current job finishes.
          await waitForDelay(0);

          // Collect garbage while the request is pending, so the abort below checks that the signal still reaches the
          // request. undici 7, bundled by Node.js 24, links cloned requests to their source signal only through a
          // WeakRef, which a garbage collection can clear.
          collectGarbage();

          controller.abort(abortReason);
          return { status: 204 };
        })
        .times(1);

      const fetch = createFetch<Schema>({ baseURL });

      const responsePromise = fetch('/users', { method: 'GET', signal: controller.signal });
      await expect(responsePromise).rejects.toBe(abortReason);
    });
  });
});
