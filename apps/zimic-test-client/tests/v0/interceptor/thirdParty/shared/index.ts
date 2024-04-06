import { describe } from 'vitest';

import declareDefaultClientTests from './default';

export interface ClientTestDeclarationOptions {
  fetch: (request: Request) => Promise<Response>;
}

function declareClientTests(options: ClientTestDeclarationOptions) {
  describe('Default', () => {
    declareDefaultClientTests(options);
  });
}

export default declareClientTests;
