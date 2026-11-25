import { describe } from 'vitest';

import { declareClientTests } from '../shared/client';
import { superagentAsFetch } from './utils';

describe('Superagent client (Node.js)', () => {
  declareClientTests({
    platform: 'node',
    fetch: superagentAsFetch,
  });
});
