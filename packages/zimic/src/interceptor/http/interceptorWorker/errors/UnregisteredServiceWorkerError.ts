class UnregisteredServiceWorkerError extends Error {
  constructor() {
    super(
      `Failed to register a service worker with script '${window.location.origin}/mockServiceWorker.js': service ` +
        'worker script does not exist at the given path.\n\n' +
        'Did you forget to run "npx zimic browser init <PUBLIC_DIR>"?',
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
