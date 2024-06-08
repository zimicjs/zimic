let mswNodeSingleton: typeof import('msw/node') | undefined;

export async function getMSWNode() {
  if (mswNodeSingleton) {
    return mswNodeSingleton;
  }
  mswNodeSingleton = await import('msw/node');
  return mswNodeSingleton;
}

let mswBrowserSingleton: typeof import('msw/browser') | undefined;

export async function getMSWBrowser() {
  if (mswBrowserSingleton) {
    return mswBrowserSingleton;
  }
  mswBrowserSingleton = await import('msw/browser');
  return mswBrowserSingleton;
}
