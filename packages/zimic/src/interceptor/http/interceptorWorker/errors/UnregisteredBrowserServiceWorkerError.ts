import { SERVICE_WORKER_FILE_NAME } from '@/cli/browser/shared/constants';

/**
 * An error thrown when the browser mock service worker is not found.
 *
 * @see {@link https://github.com/zimicjs/zimic#zimic-browser-init `zimic browser init` API reference}
 */
class UnregisteredBrowserServiceWorkerError extends Error {
  constructor() {
    super(
      `Failed to register the browser service worker: ` +
        `script '${window.location.origin}/${SERVICE_WORKER_FILE_NAME}' not found.\n\n` +
        'Did you forget to run "npx zimic browser init <public-directory>"?\n\n' +
        'Learn more: https://github.com/zimicjs/zimic#browser-post-install',
    );
    this.name = 'UnregisteredBrowserServiceWorkerError';
  }

  static matchesRawError(error: unknown) {
    return (
      error instanceof Error &&
      error.message.toLowerCase().startsWith('[msw] failed to register a service worker for scope')
    );
  }
}

export default UnregisteredBrowserServiceWorkerError;
