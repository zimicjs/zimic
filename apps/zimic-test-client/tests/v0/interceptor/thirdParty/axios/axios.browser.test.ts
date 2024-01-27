import { describe } from 'vitest';
import { createBrowserHttpInterceptor } from 'zimic0/interceptor/browser';

import declareClientTests from '../shared';
import { axiosAsFetch } from './utils';

describe('Axios client (Browser)', () => {
  declareClientTests({
    createInterceptor: createBrowserHttpInterceptor,
    fetch: axiosAsFetch,
  });
});
