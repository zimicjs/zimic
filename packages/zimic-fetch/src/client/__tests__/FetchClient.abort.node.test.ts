import { HttpSchema } from '@zimic/http';
import { waitForDelay } from '@zimic/utils/time';
import v8 from 'node:v8';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import createFetch from '../factory';

describe('FetchClient > Abort (Node.js)', () => {
  const baseURL = 'http://localhost:3000';

  // undici 7, bundled by Node.js 24, links a cloned request to the signal of its source only through a WeakRef. If the
  // clone is garbage collected while the request is pending, aborting the signal no longer reaches the request.
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
