import { describe } from 'vitest';
import { HttpInterceptorWorkerPlatform } from 'zimic0/interceptor';

import declareDefaultClientTests from './default';

export interface ClientTestDeclarationOptions {
  platform: HttpInterceptorWorkerPlatform;
  fetch: (request: Request) => Promise<Response>;
}

function declareClientTests(options: ClientTestDeclarationOptions) {
  describe('Default', () => {
    declareDefaultClientTests(options);
  });
}

export default declareClientTests;
