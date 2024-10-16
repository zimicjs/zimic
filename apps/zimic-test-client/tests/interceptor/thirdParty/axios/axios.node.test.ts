import { describe } from 'vitest';

import declareClientTests from '../shared';
import { axiosAsFetch } from './utils';

describe('Axios client (Node.js)', () => {
  declareClientTests({
    platform: 'node',
    fetch: axiosAsFetch,
  });
});
