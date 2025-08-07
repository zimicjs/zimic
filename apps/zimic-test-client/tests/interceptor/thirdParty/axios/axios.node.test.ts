import { HttpInterceptorPlatform } from '@zimic/interceptor/http';
import { describe } from 'vitest';

import declareClientTests from '../shared';
import { axiosAsFetch } from './utils';

describe('Axios client (Node.js)', () => {
  const platform: HttpInterceptorPlatform = 'node';

  declareClientTests({
    platform,
    fetch: axiosAsFetch,
  });

  describe('Fetch adapter', () => {
    declareClientTests({
      platform,
      fetch: (request) => axiosAsFetch(request, { adapter: 'fetch' }),
    });
  });
});
