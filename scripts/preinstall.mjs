import fs from 'fs';

export async function ensureLinkedLocalPackagesInLockFile() {
  const lockFile = await fs.promises.readFile('pnpm-lock.yaml', 'utf-8');

  const newLockFile = lockFile
    // Replace any @zimic/* references to use local links instead of registry versions.
    .replace(
      /'@zimic\/([^']+)':(\n\s*)specifier: (.*)(\n\s*)version: (?!link:).+/g,
      "'@zimic/$1':$2specifier: $3$4version: link:../zimic-$1",
    )
    // Remove the remaining @zimic/* entries that should no longer be in use after the replacement above.
    .replaceAll(/\n  '@zimic\/[^@]+@[^']+':[\s\S]*?(\n{2,}|$)/g, '\n');

  if (newLockFile !== lockFile) {
    await fs.promises.writeFile('pnpm-lock.yaml', newLockFile, 'utf-8');
  }
}

async function main() {
  await ensureLinkedLocalPackagesInLockFile();
}

void main();
