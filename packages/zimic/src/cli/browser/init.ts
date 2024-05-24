import filesystem from 'fs/promises';
import path from 'path';

import { getChalk, logWithPrefix } from '../utils/console';
import { SERVICE_WORKER_FILE_NAME } from './shared/constants';

const MSW_ROOT_PATH = path.join(require.resolve('msw'), '..', '..', '..');
export const MOCK_SERVICE_WORKER_PATH = path.join(MSW_ROOT_PATH, 'lib', SERVICE_WORKER_FILE_NAME);

interface BrowserServiceWorkerInitOptions {
  publicDirectory: string;
}

async function initializeBrowserServiceWorker({ publicDirectory }: BrowserServiceWorkerInitOptions) {
  const absolutePublicDirectory = path.resolve(publicDirectory);

  const chalk = await getChalk();
  await logWithPrefix(`Copying the service worker script to ${chalk.yellow(absolutePublicDirectory)}...`);

  await filesystem.mkdir(absolutePublicDirectory, { recursive: true });
  const serviceWorkerDestinationPath = path.join(absolutePublicDirectory, SERVICE_WORKER_FILE_NAME);
  await filesystem.copyFile(MOCK_SERVICE_WORKER_PATH, serviceWorkerDestinationPath);

  await logWithPrefix(`Service worker script saved to ${chalk.yellow(serviceWorkerDestinationPath)}!`);
  await logWithPrefix('You can now use browser interceptors!');
}

export default initializeBrowserServiceWorker;
