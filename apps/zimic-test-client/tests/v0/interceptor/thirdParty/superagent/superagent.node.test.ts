import { describe } from 'vitest';
import { createNodeHttpInterceptor } from 'zimic0/interceptor/node';

import declareClientTests from '../shared';
import { superagentAsFetch } from './utils';

describe('Superagent client (Node.js)', () => {
  declareClientTests({
    createInterceptor: createNodeHttpInterceptor,
    fetch: superagentAsFetch,
  });
});
