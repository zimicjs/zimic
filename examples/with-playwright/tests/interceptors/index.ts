import { applyGitHubFixtures } from './github/fixtures';
import githubInterceptor from './github/interceptor';

export const interceptors = [githubInterceptor];

export let markInterceptorsAsLoaded: (() => void) | undefined;
let areInterceptorsLoaded = false;

const loadInterceptorsPromise = new Promise<void>((resolve) => {
  markInterceptorsAsLoaded = () => {
    areInterceptorsLoaded = true;
    resolve();
  };
});

export async function waitForLoadedInterceptors() {
  if (process.env.NODE_ENV === 'production' || areInterceptorsLoaded) {
    return;
  }

  await loadInterceptorsPromise;
}

export async function loadInterceptors() {
  if (process.env.NODE_ENV === 'production' || areInterceptorsLoaded) {
    return;
  }

  for (const interceptor of interceptors) {
    await interceptor.start();
  }
  await applyGitHubFixtures();

  markInterceptorsAsLoaded?.();
}

export async function stopInterceptors() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  for (const interceptor of interceptors) {
    await interceptor.stop();
  }
}
