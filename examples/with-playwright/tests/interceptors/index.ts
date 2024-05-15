import { applyGitHubFixtures } from './github/fixtures';
import githubInterceptor from './github/interceptor';

export const interceptors = [githubInterceptor];

export async function loadInterceptors() {
  for (const interceptor of interceptors) {
    await interceptor.start();
  }
  await applyGitHubFixtures();
}

export async function stopInterceptors() {
  for (const interceptor of interceptors) {
    await interceptor.stop();
  }
}
