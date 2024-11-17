import { httpInterceptor } from 'zimic/interceptor/http';

import githubInterceptor, { githubFixtures } from './github';

httpInterceptor.default.local.onUnhandledRequest = (request) => {
  const url = new URL(request.url);
  const isSameHost = url.host === window.location.host;

  if (isSameHost) {
    return { action: 'bypass', log: false };
  }

  return { action: 'reject' };
};

export async function loadInterceptors() {
  await githubInterceptor.start();
  githubFixtures.apply();
}
