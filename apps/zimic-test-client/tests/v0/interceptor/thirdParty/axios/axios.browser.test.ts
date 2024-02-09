import { describe } from 'vitest';

import declareClientTests from '../shared';
import { axiosAsFetch } from './utils';

describe('Axios client (Browser)', () => {
  declareClientTests({
    platform: 'browser',
    fetch: axiosAsFetch,
  });
});
