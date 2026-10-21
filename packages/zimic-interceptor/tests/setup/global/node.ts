import type { TestProject } from 'vitest/node';

import { setup as sharedSetup, teardown as sharedTeardown } from './shared';

export async function setup(project: TestProject) {
  await sharedSetup(project);
}

export async function teardown() {
  await sharedTeardown();
}
