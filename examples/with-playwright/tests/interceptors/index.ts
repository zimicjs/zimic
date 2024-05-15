import { applyGitHubFixtures } from './github/fixtures';
import githubInterceptor from './github/interceptor';

export const interceptors = [githubInterceptor];

export let markInterceptorsAsLoaded: (() => void) | undefined;

const loadInterceptorsPromise = new Promise<void>((resolve) => {
  markInterceptorsAsLoaded = resolve;
});

export async function waitForLoadedInterceptors() {
  if (process.env.NODE_ENV !== 'production') {
    await loadInterceptorsPromise;
  }
}

export async function loadInterceptors() {
  if (process.env.NODE_ENV !== 'production') {
    for (const interceptor of interceptors) {
      await interceptor.start();
    }
    await applyGitHubFixtures();

    markInterceptorsAsLoaded?.();
  }
}

export async function stopInterceptors() {
  if (process.env.NODE_ENV !== 'production') {
    for (const interceptor of interceptors) {
      await interceptor.stop();
    }
  }
}
