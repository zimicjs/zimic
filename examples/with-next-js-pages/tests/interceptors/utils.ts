import { httpInterceptor } from 'zimic/interceptor/http';

import githubInterceptor, { githubFixtures } from './github';

httpInterceptor.default.onUnhandledRequest(async (request, context) => {
  const url = new URL(request.url);

  // Ignore requests to the same host
  if (url.host === window.location.host) {
    return;
  }

  await context.log();
});

export async function loadInterceptors() {
  await githubInterceptor.start();
  githubFixtures.apply();
}
