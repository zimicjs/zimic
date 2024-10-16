import { describe } from 'vitest';

import declareClientTests from '../shared';
import { nodeFetchAsFetch } from './utils';

describe('Node-fetch client (Node.js)', () => {
  declareClientTests({
    platform: 'node',
    fetch: nodeFetchAsFetch,
  });
});
