import { describe } from 'vitest';

import { declareClientTests } from '../shared/client';
import { superagentAsFetch } from './utils';

describe('Superagent client (Browser)', () => {
  declareClientTests({
    platform: 'browser',
    fetch: superagentAsFetch,
  });
});
