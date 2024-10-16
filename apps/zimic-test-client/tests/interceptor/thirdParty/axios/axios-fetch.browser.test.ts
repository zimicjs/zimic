import { describe } from 'vitest';

import declareClientTests from '../shared';
import { axiosAsFetch } from './utils';

describe('Axios client (Browser) (Fetch adapter)', () => {
  declareClientTests({
    platform: 'browser',
    fetch: (request) => axiosAsFetch(request, { adapter: 'fetch' }),
  });
});
