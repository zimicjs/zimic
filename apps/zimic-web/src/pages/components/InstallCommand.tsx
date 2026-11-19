import { useSyncExternalStore } from 'react';

import Snippet from './Snippet';

const packageManagers = {
  npm: { command: 'npm install', developmentFlag: '--save-dev' },
  pnpm: { command: 'pnpm add', developmentFlag: '--dev' },
  yarn: { command: 'yarn add', developmentFlag: '--dev' },
};

type PackageManagerName = keyof typeof packageManagers;

function isPackageManagerName(name: string | null): name is PackageManagerName {
  return name !== null && name in packageManagers;
}

// The docs save the selected tab of each `<Tabs groupId>` under this prefix.
const PACKAGE_MANAGER_STORAGE_KEY = 'docusaurus.tab.package-managers';

function subscribeToStorage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function readStoredPackageManagerName() {
  try {
    return localStorage.getItem(PACKAGE_MANAGER_STORAGE_KEY);
  } catch {
    // Browsers may block storage access, such as in private modes.
    return null;
  }
}

interface Props {
  packages: string[];
  isDevelopmentOnly: boolean;
}

/** Shows the install command for the package manager last selected in the docs, or npm when there is none. */
function InstallCommand({ packages, isDevelopmentOnly }: Props) {
  // The server snapshot is `null`, so the static page renders npm and hydrates without a mismatch.
  const selectedName = useSyncExternalStore(subscribeToStorage, readStoredPackageManagerName, () => null);
  const packageManager = packageManagers[isPackageManagerName(selectedName) ? selectedName : 'npm'];

  return (
    <Snippet
      language="bash"
      code={[packageManager.command, ...packages, isDevelopmentOnly && packageManager.developmentFlag]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export default InstallCommand;
