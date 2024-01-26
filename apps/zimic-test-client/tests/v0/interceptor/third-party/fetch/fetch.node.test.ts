import { describe } from 'vitest';
import { createNodeHttpInterceptor } from 'zimic0/interceptor/node';

import declareClientTests from '../shared';

describe('Fetch client (Node.js)', () => {
  declareClientTests({
    createInterceptor: createNodeHttpInterceptor,
    fetch: (request) => fetch(request),
  });
});
