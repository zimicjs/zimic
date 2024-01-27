import { describe } from 'vitest';
import { createBrowserHttpInterceptor } from 'zimic0/interceptor/browser';

import declareClientTests from '../shared';

describe('Fetch client (Browser)', () => {
  declareClientTests({
    createInterceptor: createBrowserHttpInterceptor,
    fetch: (request) => fetch(request),
  });
});
