import { httpInterceptor } from 'zimic/interceptor/http';

import githubInterceptor, { githubFixtures } from './github';

httpInterceptor.default.local.onUnhandledRequest = (request) => {
  const url = new URL(request.url);

  return {
    action: 'bypass',
    logWarning: url.host !== window.location.host,
  };
};

export async function loadInterceptors() {
  await githubInterceptor.start();
  githubFixtures.apply();
}
