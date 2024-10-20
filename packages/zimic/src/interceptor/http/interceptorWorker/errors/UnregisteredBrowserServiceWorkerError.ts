import { SERVICE_WORKER_FILE_NAME } from '@/cli/browser/shared/constants';

/**
 * An error thrown when the browser mock service worker is not found.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli‐zimic‐browser#zimic-browser-init `zimic browser init` API reference}
 */
class UnregisteredBrowserServiceWorkerError extends Error {
  constructor() {
    super(
      `Failed to register the browser service worker: ` +
        `script '${window.location.origin}/${SERVICE_WORKER_FILE_NAME}' not found.\n\n` +
        'Did you forget to run `zimic browser init <publicDirectory>`?\n\n' +
        'Learn more: https://github.com/zimicjs/zimic/wiki/getting‐started#client-side-post-install',
    );
    this.name = 'UnregisteredBrowserServiceWorkerError';
  }

  static matchesRawError(error: unknown) {
    return (
      error instanceof Error &&
      error.message.toLowerCase().includes('service worker script does not exist at the given path')
    );
  }
}

export default UnregisteredBrowserServiceWorkerError;
