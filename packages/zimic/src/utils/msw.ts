const mswSingleton: {
  node?: typeof import('msw/node');
  browser?: typeof import('msw/browser');
} = {};

export async function importMSWNode() {
  if (mswSingleton.node) {
    return mswSingleton.node;
  }
  mswSingleton.node = await import('msw/node');
  return mswSingleton.node;
}

export async function importMSWBrowser() {
  if (mswSingleton.browser) {
    return mswSingleton.browser;
  }
  mswSingleton.browser = await import('msw/browser');
  return mswSingleton.browser;
}
