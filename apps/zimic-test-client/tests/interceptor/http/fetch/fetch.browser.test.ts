import { describe } from 'vitest';

import declareClientTests from '../shared/client';

describe('Fetch client (Browser)', () => {
  declareClientTests({
    platform: 'browser',
    fetch: (request) => fetch(request),
  });
});
