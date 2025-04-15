import githubInterceptor, { githubFixtures } from './github';

export async function loadInterceptors() {
  await githubInterceptor.start();
  githubFixtures.apply();
}
