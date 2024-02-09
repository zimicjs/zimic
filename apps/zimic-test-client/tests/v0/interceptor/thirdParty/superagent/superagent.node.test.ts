import { describe } from 'vitest';

import declareClientTests from '../shared';
import { superagentAsFetch } from './utils';

describe('Superagent client (Node.js)', () => {
  declareClientTests({
    platform: 'node',
    fetch: superagentAsFetch,
  });
});
