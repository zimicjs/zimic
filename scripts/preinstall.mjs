import fs from 'fs';

const CI = process.env.CI === 'true';

async function ensureLocalPackagesInLockFile() {
  const lockFile = await fs.promises.readFile('pnpm-lock.yaml', 'utf-8');

  const newLockFile = lockFile
    // Replace any @zimic/* references to use local links instead of registry versions.
    .replace(
      /'@zimic\/([^']+)':(\n\s*)specifier: (.*)(\n\s*)version: (?!link:).+/g,
      "'@zimic/$1':$2specifier: $3$4version: link:../zimic-$1",
    )
    // Remove the remaining @zimic/* entries that should no longer be in use after the replacement above.
    .replaceAll(/\n  '@zimic\/[^@]+@[^']+':[\s\S]*?(\n{2,}|$)/g, '\n');

  const isLockFileUsingLocalPackages = newLockFile === lockFile;

  if (isLockFileUsingLocalPackages) {
    return;
  }

  await fs.promises.writeFile('pnpm-lock.yaml', newLockFile, 'utf-8');

  console.error('pnpm-lock.yaml was using @zimic/* packages from the registry instead of local links.');

  if (CI) {
    console.error('Please run `pnpm install` locally and commit the changes to pnpm-lock.yaml.');
  } else {
    console.error(
      'The lock file is now fixed. Please run `pnpm install` again and commit the changes to pnpm-lock.yaml.',
    );
  }

  process.exit(1);
}

async function main() {
  await ensureLocalPackagesInLockFile();
}

void main();
