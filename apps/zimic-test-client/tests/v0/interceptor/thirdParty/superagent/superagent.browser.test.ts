import { describe } from 'vitest';
import { createBrowserHttpInterceptor } from 'zimic0/interceptor/browser';

import declareClientTests from '../shared';
import { superagentAsFetch } from './utils';

describe('Superagent client (Browser)', () => {
  declareClientTests({
    createInterceptor: createBrowserHttpInterceptor,
    fetch: superagentAsFetch,
  });
});
