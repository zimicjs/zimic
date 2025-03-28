import fs from 'fs';
import path from 'path';
import color from 'picocolors';

import { logWithPrefix } from '@/utils/console';

import { SERVICE_WORKER_FILE_NAME } from './shared/constants';

const MSW_ROOT_PATH = path.join(require.resolve('msw'), '..', '..', '..');
export const MOCK_SERVICE_WORKER_PATH = path.join(MSW_ROOT_PATH, 'lib', SERVICE_WORKER_FILE_NAME);

interface BrowserServiceWorkerInitOptions {
  publicDirectory: string;
}

async function initializeBrowserServiceWorker({ publicDirectory }: BrowserServiceWorkerInitOptions) {
  const absolutePublicDirectory = path.resolve(publicDirectory);
  await fs.promises.mkdir(absolutePublicDirectory, { recursive: true });

  const destinationPath = path.join(absolutePublicDirectory, SERVICE_WORKER_FILE_NAME);
  await fs.promises.copyFile(MOCK_SERVICE_WORKER_PATH, destinationPath);

  logWithPrefix(`Service worker script saved to ${color.magenta(destinationPath)}!`);
  logWithPrefix('You can now use browser interceptors!');
}

export default initializeBrowserServiceWorker;
