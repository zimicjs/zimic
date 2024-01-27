import { describe } from 'vitest';
import { createNodeHttpInterceptor } from 'zimic0/interceptor/node';

import declareClientTests from '../shared';
import { axiosAsFetch } from './utils';

describe('Axios client (Node.js)', () => {
  declareClientTests({
    createInterceptor: createNodeHttpInterceptor,
    fetch: axiosAsFetch,
  });
});
