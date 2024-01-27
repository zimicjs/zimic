import { describe } from 'vitest';
import { HttpInterceptorFactory } from 'zimic0/interceptor';

import declareDefaultClientTests from './default';

export interface ClientTestDeclarationOptions {
  createInterceptor: HttpInterceptorFactory;
  fetch: (request: Request) => Promise<Response>;
}

function declareClientTests(options: ClientTestDeclarationOptions) {
  describe('Default', () => {
    declareDefaultClientTests(options);
  });
}

export default declareClientTests;
