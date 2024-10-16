import { describe } from 'vitest';
import { HttpInterceptorPlatform } from 'zimic/interceptor/http';

import declareClientTests from '../shared';
import { axiosAsFetch } from './utils';

describe('Axios client (Browser)', () => {
  const platform: HttpInterceptorPlatform = 'browser';

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
