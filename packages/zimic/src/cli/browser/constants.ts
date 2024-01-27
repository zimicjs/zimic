import path from 'path';

export const SERVICE_WORKER_FILE_NAME = 'mockServiceWorker.js';

export const MOCK_SERVICE_WORKER_PATH = path.join(require.resolve('msw'), '..', '..', SERVICE_WORKER_FILE_NAME);
