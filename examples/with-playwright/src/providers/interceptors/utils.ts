export let markInterceptorsAsLoaded: () => void;

const loadInterceptorsPromise = new Promise<void>((resolve) => {
  markInterceptorsAsLoaded = resolve;
});

export async function waitForLoadedInterceptors() {
  if (process.env.NODE_ENV === 'development') {
    await loadInterceptorsPromise;
  }
}
