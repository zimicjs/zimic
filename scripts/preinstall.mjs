import fs from 'fs';

export async function ensureLinkedLocalPackagesInLockFile() {
  const lockFile = await fs.promises.readFile('pnpm-lock.yaml', 'utf-8');

  // pnpm mysteriously keeps changing references to local packages to npm references, which breaks type checking in some
  // projects. We are not sure why this happens, but we can work around it by replacing the wrong references here.
  const newLockFile = lockFile.replace(
    /'@zimic\/([^']+)':(\n\s*)specifier: (.*)(\n\s*)version: (?!link:).+/g,
    "'@zimic/$1':$2specifier: $3$4version: link:../zimic-$1",
  );

  if (newLockFile !== lockFile) {
    await fs.promises.writeFile('pnpm-lock.yaml', newLockFile, 'utf-8');
  }
}

async function main() {
  await ensureLinkedLocalPackagesInLockFile();
}

void main();
