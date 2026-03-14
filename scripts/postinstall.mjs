import fs from 'fs';

const CI = process.env.CI === 'true';
const EXIT_ON_NON_LOCAL_PACKAGES = process.env.EXIT_ON_NON_LOCAL_PACKAGES !== 'false';
const ALLOWED_NON_LOCAL_PACKAGES = process.env.ALLOWED_NON_LOCAL_PACKAGES?.split(',') ?? [];

// pnpm sometimes resolves @zimic/* packages to registry versions instead of local links. This is because our examples
// reference @zimic/* packages using `latest` instead of using `workspace:` specifiers, to make them easier to clone and
// run outside of the monorepo. To avoid using registry versions of @zimic/* packages in development, we need to check
// all of their references and change them back to local links if they are not already.
async function ensureLocalPackagesInLockFile() {
  const lockFile = await fs.promises.readFile('pnpm-lock.yaml', 'utf-8');

  const nonLocalZimicExclusionGroups = ALLOWED_NON_LOCAL_PACKAGES.filter((packageName) =>
    packageName.startsWith('@zimic/'),
  ).map((packageName) => `(?!${packageName.replace('@zimic/', '')})`);

  const newLockFile = lockFile
    // Replace any @zimic/* references to use local links instead of registry versions.
    .replace(
      new RegExp(
        `'@zimic/${nonLocalZimicExclusionGroups.join('')}([^']+)':(\\n\\s*)` +
          `specifier: (latest|.*workspace:.+)(\\n\\s*)version: (?!link:).+`,
        'g',
      ),
      "'@zimic/$1':$2specifier: $3$4version: link:../zimic-$1",
    )
    // Remove the remaining @zimic/* entries that should no longer be in use after the replacement above.
    .replaceAll(
      new RegExp(`\n  '@zimic/${nonLocalZimicExclusionGroups.join('')}[^@]+@[^']+':[\\s\\S]*?(\\n{2,}|$)`, 'g'),
      '\n',
    );

  const isLockFileUsingLocalPackages = newLockFile === lockFile;

  if (isLockFileUsingLocalPackages) {
    return;
  }

  console.warn('pnpm-lock.yaml is using @zimic/* packages from the registry instead of local links.');

  if (CI) {
    console.warn('Please run `pnpm install` locally and commit the changes to pnpm-lock.yaml.');
  } else {
    await fs.promises.writeFile('pnpm-lock.yaml', newLockFile, 'utf-8');

    console.warn('pnpm-lock.yaml is now fixed. Please run `pnpm install` again and commit its changes.');
  }

  if (EXIT_ON_NON_LOCAL_PACKAGES) {
    process.exit(1);
  }
}

async function main() {
  await ensureLocalPackagesInLockFile();
}

void main();
