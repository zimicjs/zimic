import { ensureLocalPackagesInLockFile } from './preinstall.mjs';

async function main() {
  await ensureLocalPackagesInLockFile();
}

void main();
