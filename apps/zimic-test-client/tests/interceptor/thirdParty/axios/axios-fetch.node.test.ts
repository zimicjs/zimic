import { describe } from 'vitest';

import declareClientTests from '../shared';
import { axiosAsFetch } from './utils';

describe('Axios client (Node.js) (Fetch adapter)', () => {
  declareClientTests({
    platform: 'node',
    fetch: (request) => axiosAsFetch(request, { adapter: 'fetch' }),
  });
});
