import { describe } from 'vitest';

import declareClientTests from '../shared';
import { superagentAsFetch } from './utils';

describe('Superagent client (Browser)', () => {
  declareClientTests({
    platform: 'browser',
    fetch: superagentAsFetch,
  });
});
