import filesystem from 'fs/promises';
import path from 'path';

import { getChalk, logWithPrefix } from '../utils/console';
import { SERVICE_WORKER_FILE_NAME } from './shared/constants';

export const MOCK_SERVICE_WORKER_PATH = path.join(require.resolve('msw'), '..', '..', SERVICE_WORKER_FILE_NAME);

async function initializeBrowserServiceWorker(cliArguments: { publicDirectory: string }) {
  const { publicDirectory } = cliArguments;

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
