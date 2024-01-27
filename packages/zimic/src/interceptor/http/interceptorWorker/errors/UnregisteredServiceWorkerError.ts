import { SERVICE_WORKER_FILE_NAME } from '@/cli/browser/shared/constants';

class UnregisteredServiceWorkerError extends Error {
  constructor() {
    super(
      `Failed to register the browser service worker: ` +
        `script '${window.location.origin}/${SERVICE_WORKER_FILE_NAME}' not found.\n\n` +
        'Did you forget to run "npx zimic browser init <public-directory>"?',
    );
    this.name = 'UnregisteredServiceWorkerError';
  }

  static matchesRawError(error: unknown): error is UnregisteredServiceWorkerError {
    return (
      error instanceof Error &&
      error.message.toLowerCase().startsWith('[msw] failed to register a service worker for scope')
    );
  }
}

export default UnregisteredServiceWorkerError;
