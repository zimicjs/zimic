import { describe } from 'vitest';
import { createNodeHttpInterceptor } from 'zimic0/interceptor/node';

import declareClientTests from '../shared';
import { nodeFetchAsFetch } from './utils';

describe('Node-fetch client (Node.js)', () => {
  declareClientTests({
    createInterceptor: createNodeHttpInterceptor,
    fetch: nodeFetchAsFetch,
  });
});
