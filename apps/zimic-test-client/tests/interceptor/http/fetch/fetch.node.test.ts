import { describe } from 'vitest';

import { declareClientTests } from '../shared/client';

describe('Fetch client (Node.js)', () => {
  declareClientTests({
    platform: 'node',
    fetch: (request) => fetch(request),
  });
});
