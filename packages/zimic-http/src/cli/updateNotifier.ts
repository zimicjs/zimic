import updateNotifier from 'update-notifier';

import { name, version } from '@@/package.json';

export function checkForUpdates() {
  const notifier = updateNotifier({
    pkg: { name, version },
    updateCheckInterval: 1000 * 60 * 60 * 24, // 24 hours
  });

  notifier.notify({
    defer: false,
    isGlobal: false,
  });
}
