import { httpInterceptor } from 'zimic/interceptor/http';

import githubInterceptor, { githubFixtures } from './github';

httpInterceptor.default.onUnhandledRequest(async (request, context) => {
  const url = new URL(request.url);

  if (url.hostname !== '127.0.0.1') {
    await context.log();
  }
});

export async function loadInterceptors() {
  await githubInterceptor.start();
  githubFixtures.apply();
}
