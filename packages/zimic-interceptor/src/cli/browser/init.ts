import fs from 'fs';
import path from 'path';
import color from 'picocolors';

import { logger } from '@/utils/logging';

import { SERVICE_WORKER_FILE_NAME } from './shared/constants';

const MSW_ROOT_PATH = path.join(require.resolve('msw'), '..', '..', '..');
export const MOCK_SERVICE_WORKER_PATH = path.join(MSW_ROOT_PATH, 'lib', SERVICE_WORKER_FILE_NAME);

interface BrowserServiceWorkerInitOptions {
  publicDirectory: string;
}

async function initializeBrowserServiceWorker({ publicDirectory }: BrowserServiceWorkerInitOptions) {
  await fs.promises.mkdir(publicDirectory, { recursive: true });

  const destinationPath = path.join(publicDirectory, SERVICE_WORKER_FILE_NAME);
  await fs.promises.copyFile(MOCK_SERVICE_WORKER_PATH, destinationPath);

  logger.info(`Service worker script saved to ${color.magenta(destinationPath)}.`);
}

export default initializeBrowserServiceWorker;
