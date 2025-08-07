import { ensureLinkedLocalPackagesInLockFile } from './preinstall.mjs';

async function main() {
  await ensureLinkedLocalPackagesInLockFile();
}

void main();
